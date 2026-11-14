/**
 * Creative Studio → finished video: quality tiers, prices and the frozen generation plan. Pure: used by the
 * `prompt-videos` Edge Function and the tests (the browser mirrors the prices in src/services/credits.ts).
 */
import { castOf, coverPrompt, grokPrompt, imagePrompt, sheetPrompt, type VideoLength } from './promptStudio.ts';
export { DEFAULT_VIDEO_LENGTH, isVideoLength, LENGTH_RANGE, lengthLabel, VIDEO_LENGTHS, type VideoLength } from './promptStudio.ts';

export type VideoQuality = 'eco' | 'standard' | 'premium';
/** generation settings of each quality (the price comes from VIDEO_PRICES) */
export const VIDEO_TIERS: Record<VideoQuality, { image_model: string; image_quality: 'low' | 'medium' | 'high'; video_model: string; resolution: '480p' | '720p' }> = {
  eco: { image_model: 'gpt-image-1.5', image_quality: 'medium', video_model: 'grok-imagine-video-1.5-lite', resolution: '480p' },
  standard: { image_model: 'gpt-image-1.5', image_quality: 'medium', video_model: 'grok-imagine-video', resolution: '720p' },
  premium: { image_model: 'gpt-image-1.5', image_quality: 'high', video_model: 'grok-imagine-video-1.5', resolution: '720p' },
};
export const isQuality = (q: unknown): q is VideoQuality => typeof q === 'string' && q in VIDEO_TIERS;
/** qualities customers can order right now (Standard and Premium are paused: too costly for the price people pay) */
export const AVAILABLE_QUALITIES: VideoQuality[] = ['eco'];
/** fixed price per length and quality: 45 s costs what a minute used to, a minute a bit more */
export const VIDEO_PRICES: Record<VideoQuality, Record<VideoLength, number>> = {
  eco: { 30: 4500, 45: 7000, 60: 9000 },
  standard: { 30: 10000, 45: 15000, 60: 19500 },
  premium: { 30: 20000, 45: 30000, 60: 39000 },
};
/** which length a script of `seconds` belongs to (older 66-75 s scripts count as a minute) */
export const lengthOf = (seconds: number): VideoLength => (seconds <= 38 ? 30 : seconds <= 53 ? 45 : 60);
export const videoCost = (q: VideoQuality, seconds: number) => VIDEO_PRICES[q][lengthOf(seconds)];

/** total length of the project's clips, or 0 */
export const projectSeconds = (d: any): number => (d?.script?.clips ?? []).reduce((s: number, c: any) => s + (Number(c?.seconds) || 0), 0);

/** how many clips from the start fit in `max` seconds (at least one) */
export function firstClips(clips: { seconds: number }[], max: number): number {
  let total = 0, n = 0;
  for (const c of clips) { if (n > 0 && total + Number(c.seconds) > max) break; total += Number(c.seconds); n++; }
  return Math.max(1, n);
}

/** why the project cannot be turned into a video yet (French, for the customer), or null when it can */
export function videoBlocker(d: any): string | null {
  if (!d?.v4) return 'Ce projet a été créé avec l’ancienne version du studio.';
  const n = d?.script?.clips?.length ?? 0;
  if (!n) return 'Générez d’abord le découpage (étape 2).';
  if ((d?.images?.clips?.length ?? 0) < n || !(d?.images?.sheet?.length)) return 'Générez d’abord les prompts image (étape 3).';
  if ((d?.videos?.clips?.length ?? 0) < n) return 'Générez d’abord les prompts Grok (étape 4).';
  return null;
}

export type VideoPlan = {
  quality: VideoQuality; image_model: string; image_quality: string; video_model: string; resolution: string;
  title: string; sheet_prompt: string; cover_prompt: string;
  /** reference sheets of the picked characters ('storage:<path>' or '/characters/<slug>.webp'), turned into links at order time */
  sheet_refs?: string[];
  clips: { seconds: number; image_prompt: string; grok_prompt: string }[];
};

/** every prompt the worker needs, frozen at order time (later edits of the project do not change a running video) */
export function buildVideoPlan(d: any, quality: VideoQuality): VideoPlan {
  const t = VIDEO_TIERS[quality];
  return {
    quality, image_model: t.image_model, image_quality: t.image_quality, video_model: t.video_model, resolution: t.resolution,
    title: String(d?.script?.title ?? 'Vidéo Creative Studio').slice(0, 160),
    sheet_prompt: sheetPrompt(d),
    sheet_refs: castOf(d).map((c) => c.sheet).filter((x): x is string => !!x),
    cover_prompt: d?.pack?.cover ? coverPrompt(d) : '',
    clips: (d.script.clips as any[]).map((c, i) => ({ seconds: Math.min(15, Math.max(1, Number(c.seconds) || 6)), image_prompt: imagePrompt(d, i), grok_prompt: grokPrompt(d, i) })),
  };
}
