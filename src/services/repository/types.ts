import type { CreditTransaction, Profile, Scene, StoryStatus } from '@/types/database';
import type { SceneDraft, StoryConcept, StoryWithScenes } from '@/types/domain';
import type { PublishPack, Thumbnail } from '@/lib/publishPack';

/** referral programme (migration 0021) */
export interface ReferralFriend { label: string; status: 'signed_up' | 'qualified'; reward_months: number; created_at: string; qualified_at: string | null }
export interface ReferralSummary { code: string; friends: ReferralFriend[] }

export type SceneEditableFields = Pick<Scene, 'narration' | 'dialogue' | 'image_prompt' | 'video_prompt'>;

/** Persistence port. Implemented by an in-memory mock and by Supabase. */
export interface Repository {
  getProfile(): Promise<Profile | null>;
  listTransactions(): Promise<CreditTransaction[]>;
  consumeCredits(amount: number, storyId: string, description: string): Promise<number>;
  /** the caller's referral code (created on first use) and the friends who signed up through it */
  getReferrals(): Promise<ReferralSummary>;
  /** attaches the signed-in account to the owner of `code` (once, never oneself); returns 'ok' or the reason */
  claimReferral(code: string): Promise<string>;

  listStories(): Promise<StoryWithScenes[]>;
  getStory(id: string): Promise<StoryWithScenes | null>;
  createStory(idea: string, concept: StoryConcept, drafts: SceneDraft[]): Promise<StoryWithScenes>;
  setStoryStatus(id: string, status: StoryStatus): Promise<void>;
  /** Content edit. Revokes the story approval if it changes approved content. */
  updateScene(storyId: string, sceneId: string, patch: Partial<SceneEditableFields>): Promise<void>;
  setSceneStatus(sceneId: string, status: Scene['status']): Promise<void>;
  approveStory(id: string, hash: string): Promise<void>;

  // Render pipeline
  /** Debits credits and queues every scene. */
  startRender(storyId: string): Promise<RenderProgress>;
  /** Advances the pipeline; call repeatedly until `finished`. */
  tickRender(storyId: string): Promise<RenderProgress>;
  /** Free retry of one scene; `fromStart` regenerates the image too (after an edit). */
  retryScene(storyId: string, sceneId: string, fromStart?: boolean): Promise<RenderProgress>;

  // Phase 5 — thumbnail & SEO pack
  getPublishPack(storyId: string): Promise<{ pack: PublishPack | null; thumbnails: Thumbnail[] }>;
  /** Writes 5 titles, captions, hashtags, per-platform metadata and the thumbnail prompt (costs credits). */
  generatePublishPack(storyId: string): Promise<void>;
  /** Renders one thumbnail variant from the pack prompt (costs credits, refunded on failure). */
  generateThumbnail(storyId: string, aspect: '9:16' | '16:9'): Promise<void>;
  savePublishChoices(storyId: string, choices: Partial<Pick<PublishPack, 'selected_title' | 'edited_caption' | 'selected_thumbnail_id'>>): Promise<void>;
}

export interface RenderProgress { finished: boolean; done: number; failed: number; total: number }
