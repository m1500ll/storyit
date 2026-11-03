import type { MediaAsset, Publication, VideoState } from './types';

export const VIDEO_STATE_LABEL: Record<VideoState, string> = {
  available: 'Available', scheduled: 'Scheduled', publishing: 'Publishing', partially_published: 'Partially published',
  published: 'Published on selected accounts', error: 'Error on an account', archived: 'Archived',
};

/** Computes a video's state from its actual publications. */
export function videoState(media: Pick<MediaAsset, 'status'>, pubs: Pick<Publication, 'status'>[]): VideoState {
  if (media.status === 'archived') return 'archived';
  const live = pubs.filter((p) => p.status !== 'cancelled');
  if (!live.length) return 'available';
  if (live.some((p) => p.status === 'failed' || p.status === 'needs_attention')) return 'error';
  if (live.some((p) => ['processing', 'submitted', 'queued'].includes(p.status))) return 'publishing';
  const published = live.filter((p) => p.status === 'published').length;
  if (published === live.length) return 'published';
  if (published > 0) return 'partially_published';
  return 'scheduled';
}
