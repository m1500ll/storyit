import { mockDb } from '@/data/mockDb';
import { hashScenes } from '@/lib/approval';
import { delay, store } from '../store';
import { InsufficientCreditsError } from '../errors';
import type { Repository } from './types';
import { CREDIT_COSTS } from '../credits';
import type { PublishPack } from '@/lib/publishPack';

const demoPacks = new Map<string, PublishPack>();

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
  getReferrals: async () => ({
    code: 'DEMO7K2X',
    friends: [
      { label: 'Léa', status: 'qualified', reward_months: 1, created_at: '2026-10-02T10:00:00Z', qualified_at: '2026-10-03T09:00:00Z' },
      { label: 'Ma•••', status: 'qualified', reward_months: 1, created_at: '2026-10-12T10:00:00Z', qualified_at: '2026-10-14T18:00:00Z' },
      { label: 'Yanis', status: 'signed_up', reward_months: 0, created_at: '2026-11-01T10:00:00Z', qualified_at: null },
    ],
  }),
  claimReferral: async () => 'ok',

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
      ...c, id: `${id}-c${i}`, story_id: id, voice_style: c.voice_style ?? null, reference_image_url: null, created_at: ts,
    }));
    const story = {
      id, user_id: mockDb.profile.id, title: concept.title, idea, logline: concept.logline, genre: 'Fruit Drama',
      aspect_ratio: '9:16' as const, status: 'scenes_ready' as const, episode_number: 1, series_id: null,
      approved_at: null, approved_hash: null, render_started_at: null, created_at: ts, updated_at: ts, characters,
      scenes: drafts.map((d) => ({
        ...d, id: `${id}-s${d.position}`, story_id: id, status: 'pending' as const, image_url: null, video_url: null,
        character_ids: characters.map((c) => c.id), error_message: null, updated_at: ts,
        stage: 'pending' as const, image_path: null, video_path: null, audio_path: null, operation: null, attempts: 0, claimed_at: null,
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

  async startRender(storyId) {
    const story = mockDb.stories.find((s) => s.id === storyId);
    if (!story) throw new Error('Story not found');
    if (story.status !== 'generating') {
      await this.consumeCredits(story.scenes.length * CREDIT_COSTS.sceneRender, storyId, `${story.title} — ${story.scenes.length} scene renders`);
      story.status = 'generating';
      story.scenes.forEach((s) => Object.assign(s, { status: 'queued', stage: 'image' }));
      store.notify();
    }
    return this.tickRender(storyId);
  },

  /** Demo mode: fakes one scene per tick (no real media). */
  async tickRender(storyId) {
    const story = mockDb.stories.find((s) => s.id === storyId);
    if (!story) throw new Error('Story not found');
    await delay(500 + Math.random() * 400);
    const next = story.scenes.find((s) => s.status === 'queued' || s.status === 'generating');
    if (next) {
      Object.assign(next, next.status === 'queued' ? { status: 'generating' } : { status: 'generated', stage: 'done' });
      const following = story.scenes.find((s) => s.status === 'queued');
      if (next.status === 'generated' && following) following.status = 'generating';
    }
    const done = story.scenes.filter((s) => s.status === 'generated').length;
    const failed = story.scenes.filter((s) => s.status === 'failed').length;
    const finished = done + failed === story.scenes.length;
    if (finished && story.status === 'generating') story.status = 'in_review';
    store.notify();
    return { finished, done, failed, total: story.scenes.length };
  },

  async retryScene(storyId, sceneId) {
    const found = findScene(sceneId);
    if (found) Object.assign(found.scene, { status: 'queued', stage: 'image', error_message: null });
    const story = mockDb.stories.find((s) => s.id === storyId);
    if (story) story.status = 'generating';
    store.notify();
    return this.tickRender(storyId);
  },

  getPublishPack: async (storyId) => ({ pack: demoPacks.get(storyId) ?? null, thumbnails: [] }),

  /** Demo mode: a pack assembled from the story itself (no AI call), clearly labelled as demo. */
  async generatePublishPack(storyId) {
    const story = mockDb.stories.find((s) => s.id === storyId);
    if (!story) throw new Error('Story not found');
    await this.consumeCredits(CREDIT_COSTS.publishPack, storyId, 'Publish pack (demo)');
    await delay(800);
    const names = story.characters.map((c) => c.name);
    const tags = ['#FruitDrama', '#AIFruit', '#Animation3D'];
    demoPacks.set(storyId, {
      story_id: storyId, status: 'ready', error_message: null, selected_title: null, edited_caption: null,
      selected_thumbnail_id: null, approved_hash: story.approved_hash, updated_at: new Date().toISOString(),
      content: {
        titles: (['emotion', 'conflict', 'sacrifice', 'suspense', 'curiosity'] as const).map((angle) => ({ angle, text: `[Demo · ${angle}] ${story.title}` })),
        caption: `[Demo] ${story.logline ?? story.title} — what would you have done? 👇`,
        platforms: {
          tiktok: { caption: `[Demo] ${story.logline ?? ''}`, hook: story.title, hashtags: tags },
          instagram: { caption: `[Demo] ${story.logline ?? ''}`, hashtags: tags },
          youtube: { title: story.title.slice(0, 100), description: `[Demo] ${story.logline ?? ''}`, hashtags: tags.slice(0, 3), tags: ['fruit drama', ...names] },
        },
        thumbnail: {
          thumbnail_type: 'split emotional contrast', aspect_ratio: '9:16', style: 'stylized cinematic 3D animation',
          prompt: `[Demo] ${names.join(' and ')} at the most emotional moment of “${story.title}”.`, negative_prompt: 'text, watermark, off-model characters',
          characters: names, emotional_hook: 'despair vs relief', composition: 'two halves, faces large, strong contrast',
          platform_targets: { tiktok: '9:16 cover', instagram: '9:16 cover', youtube: '16:9 variant' },
        },
      },
    });
    store.notify();
  },

  async generateThumbnail() {
    throw new Error('Thumbnail images need the live backend — demo mode does not generate images.');
  },

  async savePublishChoices(storyId, choices) {
    const pack = demoPacks.get(storyId);
    if (pack) Object.assign(pack, choices);
    await changed(undefined);
  },

  async approveStory(id, hash) {
    const story = mockDb.stories.find((s) => s.id === id);
    if (story) Object.assign(story, { approved_hash: hash, approved_at: new Date().toISOString(), status: 'approved' });
    await changed(undefined);
  },
};
