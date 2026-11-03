import type { CreditTransaction, Profile, Scene } from '@/types/database';
import type { StoryWithScenes } from '@/types/domain';
import { FRUIT_DRAMA_SCENES } from './fruitDrama';

const USER_ID = 'user-demo';
const now = Date.now();
const iso = (minsAgo: number) => new Date(now - minsAgo * 60_000).toISOString();

const sceneStatuses: Scene['status'][] = ['generated', 'generated', 'generated', 'generated', 'generated', 'generated', 'generated', 'generated', 'generated', 'generated', 'generated', 'generated', 'generating', 'queued', 'failed'];

function makeScenes(storyId: string, statuses: Scene['status'][]): Scene[] {
  return FRUIT_DRAMA_SCENES.map((d, i) => ({
    ...d,
    id: `${storyId}-s${d.position}`,
    story_id: storyId,
    status: statuses[i] ?? 'pending',
    stage: (statuses[i] === 'generated' ? 'done' : 'pending') as Scene['stage'], image_path: null, video_path: null, audio_path: null, operation: null, attempts: 0, claimed_at: null,
    image_url: null,
    video_url: null,
    character_ids: [`${storyId}-c1`, `${storyId}-c2`],
    error_message: statuses[i] === 'failed' ? 'Video provider timeout — retry is free.' : null,
    updated_at: iso(i),
  }));
}

function story(id: string, title: string, status: StoryWithScenes['status'], ep: number, statuses: Scene['status'][], minsAgo: number): StoryWithScenes {
  return {
    id, user_id: USER_ID, title, idea: 'A lovers\' quarrel between a jealous strawberry and an arrogant lemon',
    logline: 'A possessive strawberry suspects her arrogant lemon boyfriend of cheating.', genre: 'Fruit Drama',
    aspect_ratio: '9:16', status, episode_number: ep, series_id: 'series-zest', approved_at: null, approved_hash: null, render_started_at: null,
    created_at: iso(minsAgo), updated_at: iso(minsAgo / 2),
    scenes: makeScenes(id, statuses),
    characters: [
      { id: `${id}-c1`, story_id: id, name: 'Fresa', species: 'Strawberry', personality: 'Jealous, passionate', visual_description: 'Ripe red strawberry with leafy tiara', voice_style: 'Breathless telenovela', reference_image_url: null, created_at: iso(minsAgo) },
      { id: `${id}-c2`, story_id: id, name: 'Limon', species: 'Lemon', personality: 'Arrogant, charming', visual_description: 'Yellow lemon with aviators', voice_style: 'Smooth baritone', reference_image_url: null, created_at: iso(minsAgo) },
    ],
  };
}

export const mockDb = {
  profile: { id: USER_ID, display_name: 'Ana Studio', plan: 'creator', credit_balance: 184, created_at: iso(60 * 24 * 30) } as Profile,
  stories: [
    story('st-3', 'Zest & Jealousy — Ep. 3', 'in_review', 3, sceneStatuses, 90),
    story('st-2', 'Zest & Jealousy — Ep. 2', 'generating', 2, Array(15).fill('generated').fill('generating', 9).fill('queued', 11), 60 * 26),
    story('st-1', 'Zest & Jealousy — Ep. 1', 'published', 1, Array(15).fill('generated'), 60 * 72),
  ] as StoryWithScenes[],
  transactions: [
    { id: 't3', user_id: USER_ID, type: 'consumption', amount: -45, balance_after: 184, story_id: 'st-3', description: 'Episode 3 — 15 scene renders', created_at: iso(90) },
    { id: 't2', user_id: USER_ID, type: 'consumption', amount: -45, balance_after: 229, story_id: 'st-2', description: 'Episode 2 — 15 scene renders', created_at: iso(60 * 26) },
    { id: 't1', user_id: USER_ID, type: 'subscription_grant', amount: 300, balance_after: 274, story_id: null, description: 'Creator plan — monthly credits', created_at: iso(60 * 24 * 3) },
  ] as CreditTransaction[],
};
