import type { StoryWithScenes } from '@/types/domain';

export type Platform = 'tiktok' | 'instagram' | 'youtube';
export type TitleAngle = 'emotion' | 'conflict' | 'sacrifice' | 'suspense' | 'curiosity';

export interface ThumbnailSpec {
  thumbnail_type: string;
  aspect_ratio: '9:16' | '16:9';
  style: string;
  prompt: string;
  negative_prompt: string;
  characters: string[];
  emotional_hook: string;
  composition: string;
  platform_targets: Record<Platform, string>;
}

export interface PublishPackContent {
  titles: { angle: TitleAngle | string; text: string }[];
  caption: string;
  platforms: {
    tiktok: { caption: string; hook: string; hashtags: string[] };
    instagram: { caption: string; hashtags: string[] };
    youtube: { title: string; description: string; hashtags: string[]; tags: string[] };
  };
  thumbnail: ThumbnailSpec;
}

export type PackStatus = 'empty' | 'generating' | 'ready' | 'error';

export interface PublishPack {
  story_id: string;
  content: PublishPackContent | Record<string, never>;
  status: PackStatus;
  error_message: string | null;
  selected_title: string | null;
  edited_caption: string | null;
  selected_thumbnail_id: string | null;
  approved_hash: string | null;
  updated_at: string;
}

export interface Thumbnail {
  id: string;
  story_id: string;
  aspect_ratio: '9:16' | '16:9';
  prompt: ThumbnailSpec;
  image_path: string | null;
  image_url?: string | null;
  status: 'generating' | 'ready' | 'error';
  error_message: string | null;
  created_at: string;
}

export const isReadyPack = (p: PublishPack | null | undefined): p is PublishPack & { content: PublishPackContent } =>
  Boolean(p && p.status === 'ready' && (p.content as PublishPackContent).titles?.length);

/**
 * Official limits we validate against (check the platforms' docs when they change):
 * TikTok caption 2200 chars · Instagram caption 2200 chars & 30 hashtags · YouTube title 100 chars,
 * description 5000 chars, tags 500 chars total, >60 hashtags makes YouTube ignore them all.
 */
export const PLATFORM_LIMITS = {
  tiktok: { caption: 2200 },
  instagram: { caption: 2200, hashtags: 30 },
  youtube: { title: 100, description: 5000, tags: 500, hashtags: 60 },
} as const;

export const PLATFORM_LABEL: Record<Platform, string> = { tiktok: 'TikTok', instagram: 'Instagram Reels', youtube: 'YouTube Shorts' };

const withTags = (text: string, tags: string[]) => {
  const missing = tags.filter((t) => !text.toLowerCase().includes(t.toLowerCase()));
  return missing.length ? `${text.trim()}\n\n${missing.join(' ')}` : text.trim();
};

/** The exact text block a creator pastes into each platform (respects the user's edited caption and chosen title). */
export function platformCopy(pack: PublishPack & { content: PublishPackContent }, platform: Platform) {
  const c = pack.content.platforms;
  const caption = pack.edited_caption?.trim() || null;
  const title = pack.selected_title?.trim() || null;
  if (platform === 'youtube') {
    return {
      title: (title ?? c.youtube.title).slice(0, PLATFORM_LIMITS.youtube.title),
      body: withTags(caption ?? c.youtube.description, c.youtube.hashtags),
      tags: c.youtube.tags.join(', '),
    };
  }
  const p = c[platform];
  return { title: platform === 'tiktok' ? (title ?? c.tiktok.hook) : title ?? '', body: withTags(caption ?? p.caption, p.hashtags), tags: '' };
}

/** Problems that would make a platform reject or truncate the post. Empty array = OK. */
export function validateCopy(platform: Platform, copy: { title: string; body: string; tags: string }): string[] {
  const issues: string[] = [];
  const hashtags = (copy.body.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
  if (platform === 'youtube') {
    if (copy.title.length > PLATFORM_LIMITS.youtube.title) issues.push(`Title is over ${PLATFORM_LIMITS.youtube.title} characters`);
    if (!copy.title.trim()) issues.push('Title is empty');
    if (copy.body.length > PLATFORM_LIMITS.youtube.description) issues.push(`Description is over ${PLATFORM_LIMITS.youtube.description} characters`);
    if (copy.tags.length > PLATFORM_LIMITS.youtube.tags) issues.push(`Tags are over ${PLATFORM_LIMITS.youtube.tags} characters`);
    if (hashtags > PLATFORM_LIMITS.youtube.hashtags) issues.push('More than 60 hashtags: YouTube would ignore all of them');
  } else {
    const max = PLATFORM_LIMITS[platform].caption;
    if (copy.body.length > max) issues.push(`Caption is over ${max} characters`);
    if (platform === 'instagram' && hashtags > PLATFORM_LIMITS.instagram.hashtags) issues.push('More than 30 hashtags');
  }
  if (!copy.body.trim()) issues.push('Caption is empty');
  return issues;
}

// ---------- Production phases (Phase 1 → 5), derived from real data ----------

export type PhaseState = 'done' | 'active' | 'todo' | 'error';
export interface Phase { id: 1 | 2 | 3 | 4 | 5; name: string; detail: string; state: PhaseState }

export function productionPhases(story: StoryWithScenes, pack?: PublishPack | null, hasFinalVideo = false): Phase[] {
  const total = story.scenes.length;
  const images = story.scenes.filter((s) => s.image_path || s.image_url).length;
  const clips = story.scenes.filter((s) => s.video_path || s.video_url).length;
  const failed = story.scenes.filter((s) => s.stage === 'failed' || s.status === 'failed').length;
  const rendering = story.status === 'generating';

  const p3: PhaseState = images === total && total > 0 ? 'done' : rendering ? 'active' : failed && images < total ? 'error' : 'todo';
  const p4: PhaseState = clips === total && total > 0 ? 'done' : rendering && images > 0 ? 'active' : failed ? 'error' : 'todo';
  const p5: PhaseState = pack?.status === 'error' ? 'error' : pack?.status === 'generating' ? 'active' : isReadyPack(pack) ? 'done' : 'todo';

  return [
    { id: 1, name: 'Story concept', detail: story.title, state: 'done' },
    { id: 2, name: 'Script & characters', detail: `${total} scenes · ${story.characters.length} characters`, state: total > 0 ? 'done' : 'todo' },
    { id: 3, name: 'Images', detail: `${images}/${total} keyframes`, state: p3 },
    { id: 4, name: 'Video & audio', detail: `${clips}/${total} clips${hasFinalVideo ? ' · final MP4 built' : ''}${failed ? ` · ${failed} failed` : ''}`, state: p4 },
    { id: 5, name: 'Thumbnail & SEO', detail: isReadyPack(pack) ? 'Pack ready' : pack?.status === 'generating' ? 'Writing…' : 'Not generated', state: p5 },
  ];
}

/** True when the publish pack was generated for an older version of the scenes. */
export const packIsStale = (story: StoryWithScenes, pack: PublishPack | null | undefined) =>
  Boolean(pack && pack.approved_hash && story.approved_hash && pack.approved_hash !== story.approved_hash);
