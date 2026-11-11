import { describe, expect, it } from 'vitest';
import { mockDb } from '@/data/mockDb';
import { hashScenes } from '@/lib/approval';
import { CREDIT_COSTS } from '@/services/credits';
import { InsufficientCreditsError } from '@/services/errors';
import { mockRepository as repo } from '@/services/repository/mockRepository';
import type { SceneDraft, StoryConcept } from '@/types/domain';

const concept = {
  id: 'c1', title: 'Le sacrifice de Marcel', logline: 'Un père citron…', tone: 'drame', hook: 'Tempête',
  characters: [
    { name: 'Marcel', species: 'Lemon', personality: 'Brave', visual_description: 'Yellow lemon, raincoat', voice_style: 'Deep tired male voice' },
    { name: 'Lina', species: 'Fig', personality: 'Sweet', visual_description: 'Purple fig, yellow dress', voice_style: 'Small girl voice' },
  ],
} as unknown as StoryConcept;
const drafts = [1, 2, 3].map((position) => ({
  position, title: `S${position}`, narration: 'Marcel runs in the storm.', dialogue: 'Marcel (crying): "Lina !"',
  image_prompt: 'img', video_prompt: 'vid', duration_seconds: 5,
})) as SceneDraft[];

describe('mock repository: production workflow', () => {
  it('persists the selected concept, characters (with voices) and scenes', async () => {
    const story = await repo.createStory('idée', concept, drafts);
    expect(story.characters.map((c) => c.voice_style)).toEqual(['Deep tired male voice', 'Small girl voice']);
    expect(story.scenes).toHaveLength(3);
    expect(story.scenes.every((s) => s.character_ids.length === 2)).toBe(true);
    expect(await repo.getStory(story.id)).toBe(story);
  });

  it('debits the render price once, not again on later ticks', async () => {
    const story = await repo.createStory('idée', concept, drafts);
    mockDb.profile.credit_balance = 50000;
    await repo.startRender(story.id);
    expect(mockDb.profile.credit_balance).toBe(50000 - 3 * CREDIT_COSTS.sceneRender);
    await repo.startRender(story.id); // already generating: must not charge twice
    expect(mockDb.profile.credit_balance).toBe(50000 - 3 * CREDIT_COSTS.sceneRender);
  });

  it('refuses work without enough credits and leaves the balance untouched', async () => {
    const story = await repo.createStory('idée', concept, drafts);
    mockDb.profile.credit_balance = 1;
    await expect(repo.startRender(story.id)).rejects.toBeInstanceOf(InsufficientCreditsError);
    expect(mockDb.profile.credit_balance).toBe(1);
  });

  it('revokes approval when an approved scene is edited', async () => {
    const story = await repo.createStory('idée', concept, drafts);
    await repo.approveStory(story.id, hashScenes(story.scenes));
    await repo.updateScene(story.id, story.scenes[0]!.id, { dialogue: 'Marcel: "Non !"' });
    expect(story.approved_at).toBeNull();
    expect(story.status).toBe('in_review');
  });
});

describe('mock repository: phase 5', () => {
  it('generates, saves and reloads the publish pack, charging its price', async () => {
    const story = await repo.createStory('idée', concept, drafts);
    mockDb.profile.credit_balance = 1000;
    await repo.generatePublishPack(story.id);
    expect(mockDb.profile.credit_balance).toBe(1000 - CREDIT_COSTS.publishPack);
    const { pack } = await repo.getPublishPack(story.id);
    expect(pack?.status).toBe('ready');
    const content = pack!.content as unknown as { titles: unknown[]; thumbnail: Record<string, unknown> };
    expect(content.titles).toHaveLength(5);
    for (const k of ['thumbnail_type', 'aspect_ratio', 'style', 'prompt', 'negative_prompt', 'characters', 'emotional_hook', 'composition', 'platform_targets']) {
      expect(content.thumbnail).toHaveProperty(k);
    }
    await repo.savePublishChoices(story.id, { selected_title: 'Mon titre', edited_caption: 'Ma légende' });
    const again = await repo.getPublishPack(story.id);
    expect(again.pack?.selected_title).toBe('Mon titre');
    expect(again.pack?.edited_caption).toBe('Ma légende');
  });

  it('never fakes a thumbnail image in demo mode', async () => {
    const story = await repo.createStory('idée', concept, drafts);
    await expect(repo.generateThumbnail(story.id, '9:16')).rejects.toThrow(/demo mode/);
    expect((await repo.getPublishPack(story.id)).thumbnails).toEqual([]);
  });
});
