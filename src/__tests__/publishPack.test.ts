import { describe, expect, it } from 'vitest';
import { packIsStale, platformCopy, productionPhases, validateCopy, type PublishPack, type PublishPackContent } from '@/lib/publishPack';
import type { StoryWithScenes } from '@/types/domain';

const content: PublishPackContent = {
  titles: ['emotion', 'conflict', 'sacrifice', 'suspense', 'curiosity'].map((angle, i) => ({ angle, text: `Titre ${i}` })),
  caption: 'Marcel a tout risqué…',
  platforms: {
    tiktok: { caption: 'Marcel a tout risqué… #FruitDrama', hook: 'Il a tout risqué', hashtags: ['#FruitDrama', '#DrameFamilial'] },
    instagram: { caption: 'Marcel a tout risqué…', hashtags: ['#AIFruit'] },
    youtube: { title: 'Le sacrifice de Marcel', description: 'Un père citron…', hashtags: ['#Shorts'], tags: ['fruit drama', 'histoire touchante'] },
  },
  thumbnail: {
    thumbnail_type: 'split', aspect_ratio: '9:16', style: 's', prompt: 'p', negative_prompt: 'n', characters: ['Marcel', 'Lina'],
    emotional_hook: 'despair vs relief', composition: 'c', platform_targets: { tiktok: '9:16', instagram: '9:16', youtube: '16:9' },
  },
};
const pack = (over: Partial<PublishPack> = {}) => ({
  story_id: 's', content, status: 'ready', error_message: null, selected_title: null, edited_caption: null,
  selected_thumbnail_id: null, approved_hash: 'h1', updated_at: '', ...over,
}) as PublishPack & { content: PublishPackContent };

describe('platformCopy', () => {
  it('adds missing hashtags once and keeps existing ones', () => {
    const tt = platformCopy(pack(), 'tiktok');
    expect(tt.body.match(/#FruitDrama/g)).toHaveLength(1);
    expect(tt.body).toContain('#DrameFamilial');
    expect(tt.title).toBe('Il a tout risqué');
  });
  it('uses the chosen title and edited caption', () => {
    const yt = platformCopy(pack({ selected_title: 'Mon titre', edited_caption: 'Ma légende' }), 'youtube');
    expect(yt.title).toBe('Mon titre');
    expect(yt.body.startsWith('Ma légende')).toBe(true);
    expect(yt.tags).toBe('fruit drama, histoire touchante');
  });
  it('never exceeds the YouTube title limit', () => {
    expect(platformCopy(pack({ selected_title: 'x'.repeat(140) }), 'youtube').title).toHaveLength(100);
  });
});

describe('validateCopy', () => {
  it('accepts valid copy', () => expect(validateCopy('instagram', { title: '', body: 'ok #a', tags: '' })).toEqual([]));
  it('flags too long captions, empty titles and hashtag spam', () => {
    expect(validateCopy('tiktok', { title: '', body: 'a'.repeat(2201), tags: '' })[0]).toMatch(/2200/);
    expect(validateCopy('youtube', { title: '', body: 'x', tags: '' })).toContain('Title is empty');
    expect(validateCopy('instagram', { title: '', body: Array.from({ length: 31 }, (_, i) => `#t${i}`).join(' '), tags: '' })).toContain('More than 30 hashtags');
  });
});

const story = (over: Partial<StoryWithScenes> = {}, scenes: Partial<StoryWithScenes['scenes'][number]>[] = [{}, {}]) => ({
  id: 's', title: 'T', status: 'in_review', approved_hash: 'h1', characters: [{}, {}],
  scenes: scenes.map((s, i) => ({ position: i + 1, image_path: 'i', video_path: 'v', stage: 'done', status: 'generated', ...s })),
  ...over,
}) as unknown as StoryWithScenes;

describe('productionPhases', () => {
  it('reports the real state of each phase', () => {
    const phases = productionPhases(story({}, [{}, { video_path: null, stage: 'failed', status: 'failed' }]), null);
    expect(phases.map((p) => p.state)).toEqual(['done', 'done', 'done', 'error', 'todo']);
    expect(phases[3]!.detail).toContain('1/2 clips');
  });
  it('marks phase 5 done once the pack is ready', () => {
    expect(productionPhases(story(), pack())[4]!.state).toBe('done');
    expect(productionPhases(story(), pack({ status: 'generating' }))[4]!.state).toBe('active');
  });
  it('detects a pack written for older scenes', () => {
    expect(packIsStale(story({ approved_hash: 'h2' }), pack())).toBe(true);
    expect(packIsStale(story(), pack())).toBe(false);
  });
});
