/**
 * Platform constraints checked BEFORE a publication is scheduled/approved, and again by the worker.
 * `confirmed` = read in official docs; `to_verify` = from secondary sources only, applied conservatively.
 */
import type { Platform } from './distribution.ts';

export interface VideoFacts { mime: string; size_bytes: number; duration_seconds: number | null; width: number | null; height: number | null }
export interface SpecIssue { level: 'error' | 'warning'; message: string; source: 'confirmed' | 'to_verify' }

const MB = 1024 * 1024;

export const SPECS = {
  tiktok: {
    mimes: ['video/mp4', 'video/webm', 'video/quicktime'],          // to_verify (secondary sources)
    minSeconds: 3,                                                   // to_verify
    // The real per-account maximum comes from creator_info.max_video_post_duration_sec (confirmed: must be checked).
    defaultMaxSeconds: 600,
    maxBytes: 250 * MB,                                              // Storyit pilot cap (our worker streams 10 MB chunks)
  },
  instagram: {
    mimes: ['video/mp4', 'video/quicktime'],                         // to_verify
    minSeconds: 3,                                                   // to_verify
    maxSeconds: 15 * 60,                                             // to_verify (some sources say 90 s via API)
    safeSeconds: 90,                                                 // warn above this until verified
    maxBytes: 300 * MB,                                              // to_verify
  },
} as const;

export function checkVideo(platform: Platform, v: VideoFacts, tiktokMaxSeconds?: number | null): SpecIssue[] {
  const out: SpecIssue[] = [];
  const s = SPECS[platform];
  if (!(s.mimes as readonly string[]).includes(v.mime)) out.push({ level: 'error', source: 'to_verify', message: `${platform === 'tiktok' ? 'TikTok' : 'Instagram'} does not accept ${v.mime} videos` });
  if (v.size_bytes > s.maxBytes) out.push({ level: 'error', source: 'to_verify', message: `File is larger than ${Math.round(s.maxBytes / MB)} MB` });
  if (v.duration_seconds == null) out.push({ level: 'warning', source: 'to_verify', message: 'Unknown duration: the platform may reject it' });
  else {
    if (v.duration_seconds < s.minSeconds) out.push({ level: 'error', source: 'to_verify', message: `Video is shorter than ${s.minSeconds} s` });
    if (platform === 'tiktok') {
      const max = tiktokMaxSeconds ?? SPECS.tiktok.defaultMaxSeconds;
      if (v.duration_seconds > max) out.push({ level: 'error', source: tiktokMaxSeconds ? 'confirmed' : 'to_verify', message: `This TikTok account accepts videos up to ${max} s` });
    } else {
      if (v.duration_seconds > SPECS.instagram.maxSeconds) out.push({ level: 'error', source: 'to_verify', message: 'Reels longer than 15 minutes are not accepted' });
      else if (v.duration_seconds > SPECS.instagram.safeSeconds) out.push({ level: 'warning', source: 'to_verify', message: 'Reels over 90 s may be refused by the API (limit not confirmed)' });
    }
  }
  if (v.width && v.height && v.height < v.width) out.push({ level: 'warning', source: 'to_verify', message: 'Horizontal video: vertical 9:16 is recommended' });
  return out;
}

// ---------- TikTok Direct Post UX requirements (Content Sharing Guidelines) ----------

export interface CreatorInfo {
  creator_nickname: string; creator_username?: string; creator_avatar_url?: string;
  privacy_level_options: string[]; comment_disabled: boolean; duet_disabled: boolean; stitch_disabled: boolean; max_video_post_duration_sec: number;
}
export interface TikTokOptions {
  privacy_level?: string;            // chosen explicitly by the user, from creator_info options
  disable_comment?: boolean; disable_duet?: boolean; disable_stitch?: boolean;
  commercial?: boolean;              // disclosure toggle, off by default
  brand_organic?: boolean;           // "Your brand" → labelled "Promotional content"
  brand_content?: boolean;           // "Branded content" → labelled "Paid partnership"
  consent_text?: string;             // the exact declaration the user saw
  consented_at?: string;
  creator_nickname?: string;         // the account name the user saw
}

export const PRIVACY_LABEL: Record<string, string> = {
  PUBLIC_TO_EVERYONE: 'Everyone', MUTUAL_FOLLOW_FRIENDS: 'Friends', FOLLOWER_OF_CREATOR: 'Followers', SELF_ONLY: 'Only me',
};

/** Declaration wording required by TikTok depending on the disclosure (confirmed in the guidelines). */
export function tiktokDeclaration(o: TikTokOptions) {
  return o.commercial && o.brand_content
    ? "By posting, you agree to TikTok's Branded Content Policy and Music Usage Confirmation."
    : "By posting, you agree to TikTok's Music Usage Confirmation.";
}

/** Returns what still blocks the "Publish/Approve" button for a TikTok post. Empty = ready. */
export function tiktokReadiness(o: TikTokOptions, info: CreatorInfo | null, durationSeconds: number | null): string[] {
  const issues: string[] = [];
  if (!info) return ['Load the TikTok account info first'];
  if (!o.privacy_level) issues.push('Choose who can view this video');
  else if (!info.privacy_level_options.includes(o.privacy_level)) issues.push('This visibility is not available for this account');
  if (o.commercial && !o.brand_organic && !o.brand_content) issues.push('Select “Your brand” and/or “Branded content”, or turn the disclosure off');
  // Applied conservatively (not confirmed in official docs): branded content should not be private.
  if (o.commercial && o.brand_content && o.privacy_level === 'SELF_ONLY') issues.push('Branded content cannot be set to “Only me”');
  if (durationSeconds != null && durationSeconds > info.max_video_post_duration_sec) issues.push(`This account accepts videos up to ${info.max_video_post_duration_sec} s`);
  if (!o.consented_at) issues.push('Confirm the declaration');
  return issues;
}
