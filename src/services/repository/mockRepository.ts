import { mockDb } from '@/data/mockDb';
import { hashScenes } from '@/lib/approval';
import { store } from '../store';
import { InsufficientCreditsError } from '../errors';
import type { Repository } from './types';

const findScene = (sceneId: string) => {
  for (const story of mockDb.stories) {
    const scene = story.scenes.find((s) => s.id === sceneId);
    if (scene) return { story, scene };
  }
  return null;
};

const changed = <T>(value: T): Promise<T> => {
  store.notify();
  return Promise.resolve(value);
};

export const mockRepository: Repository = {
  getProfile: async () => mockDb.profile,
  listTransactions: async () => mockDb.transactions,

  async consumeCredits(amount, storyId, description) {
    const balance = mockDb.profile.credit_balance;
    if (balance < amount) throw new InsufficientCreditsError(amount, balance);
    mockDb.profile.credit_balance = balance - amount;
    mockDb.transactions.unshift({
      id: crypto.randomUUID(), user_id: mockDb.profile.id, type: 'consumption', amount: -amount,
      balance_after: mockDb.profile.credit_balance, story_id: storyId, description, created_at: new Date().toISOString(),
    });
    return changed(mockDb.profile.credit_balance);
  },

  listStories: async () => mockDb.stories,
  getStory: async (id) => mockDb.stories.find((s) => s.id === id) ?? null,

  async createStory(idea, concept, drafts) {
    const id = crypto.randomUUID();
    const ts = new Date().toISOString();
    const characters = concept.characters.map((c, i) => ({
      ...c, id: `${id}-c${i}`, story_id: id, voice_style: null, reference_image_url: null, created_at: ts,
    }));
    const story = {
      id, user_id: mockDb.profile.id, title: concept.title, idea, logline: concept.logline, genre: 'Fruit Drama',
      aspect_ratio: '9:16' as const, status: 'scenes_ready' as const, episode_number: 1, series_id: null,
      approved_at: null, approved_hash: null, created_at: ts, updated_at: ts, characters,
      scenes: drafts.map((d) => ({
        ...d, id: `${id}-s${d.position}`, story_id: id, status: 'pending' as const, image_url: null, video_url: null,
        character_ids: characters.map((c) => c.id), error_message: null, updated_at: ts,
      })),
    };
    mockDb.stories.unshift(story);
    return changed(story);
  },

  async setStoryStatus(id, status) {
    const story = mockDb.stories.find((s) => s.id === id);
    if (story) story.status = status;
    await changed(undefined);
  },

  async updateScene(_storyId, sceneId, patch) {
    const found = findScene(sceneId);
    if (!found) return;
    const { story, scene } = found;
    Object.assign(scene, patch, { updated_at: new Date().toISOString() });
    if (story.approved_hash && story.approved_hash !== hashScenes(story.scenes)) {
      Object.assign(story, { approved_at: null, approved_hash: null, status: 'in_review' });
    }
    await changed(undefined);
  },

  async setSceneStatus(sceneId, status) {
    const found = findScene(sceneId);
    if (found) Object.assign(found.scene, { status, error_message: null });
    await changed(undefined);
  },

  async approveStory(id, hash) {
    const story = mockDb.stories.find((s) => s.id === id);
    if (story) Object.assign(story, { approved_hash: hash, approved_at: new Date().toISOString(), status: 'approved' });
    await changed(undefined);
  },
};
