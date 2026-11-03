import { mockDb } from '@/data/mockDb';
import { hashScenes } from '@/lib/approval';
import type { Scene } from '@/types/database';
import type { SceneDraft, StoryConcept, StoryWithScenes } from '@/types/domain';
import { store } from './store';

export type SceneEditableFields = Pick<Scene, 'narration' | 'dialogue' | 'image_prompt' | 'video_prompt'>;

/** Story repository (mock). Each method maps 1:1 to a future Supabase query. */
export const storyService = {
  list(): StoryWithScenes[] {
    return mockDb.stories;
  },

  get(id: string): StoryWithScenes | undefined {
    return mockDb.stories.find((s) => s.id === id);
  },

  create(idea: string, concept: StoryConcept, drafts: SceneDraft[]): StoryWithScenes {
    const id = crypto.randomUUID();
    const ts = new Date().toISOString();
    const characters = concept.characters.map((c, i) => ({
      ...c, id: `${id}-c${i}`, story_id: id, voice_style: null, reference_image_url: null, created_at: ts,
    }));
    const story: StoryWithScenes = {
      id, user_id: mockDb.profile.id, title: concept.title, idea, logline: concept.logline, genre: 'Fruit Drama',
      aspect_ratio: '9:16', status: 'scenes_ready', episode_number: 1, series_id: null, approved_at: null, approved_hash: null,
      created_at: ts, updated_at: ts, characters,
      scenes: drafts.map((d) => ({
        ...d, id: `${id}-s${d.position}`, story_id: id, status: 'pending', image_url: null, video_url: null,
        character_ids: characters.map((c) => c.id), error_message: null, updated_at: ts,
      })),
    };
    mockDb.stories.unshift(story);
    store.notify();
    return story;
  },

  /** Editing any scene content invalidates a prior approval. */
  updateScene(storyId: string, sceneId: string, patch: Partial<SceneEditableFields>) {
    const story = this.get(storyId);
    const scene = story?.scenes.find((s) => s.id === sceneId);
    if (!story || !scene) return;
    Object.assign(scene, patch, { updated_at: new Date().toISOString() });
    if (story.approved_hash && story.approved_hash !== hashScenes(story.scenes)) {
      story.approved_at = null;
      story.approved_hash = null;
      story.status = 'in_review';
    }
    store.notify();
  },

  approve(storyId: string) {
    const story = this.get(storyId);
    if (!story) return;
    if (story.scenes.some((s) => s.status !== 'generated')) throw new Error('All scenes must be generated before approval.');
    story.approved_hash = hashScenes(story.scenes);
    story.approved_at = new Date().toISOString();
    story.status = 'approved';
    store.notify();
  },

  setSceneStatus(storyId: string, sceneId: string, status: Scene['status']) {
    const scene = this.get(storyId)?.scenes.find((s) => s.id === sceneId);
    if (!scene) return;
    scene.status = status;
    scene.error_message = null;
    store.notify();
  },
};
