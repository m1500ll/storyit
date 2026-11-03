/**
 * Monetisation proof from the OWNER's own accounts only. Add screenshots to /public/results
 * and list them here. The section stays hidden while this list is empty.
 * Keep the disclaimer: results are personal, not typical, not guaranteed.
 */
export interface ResultProof {
  image: string;      // e.g. '/results/tiktok-october.jpg'
  platform: 'TikTok' | 'YouTube Shorts' | 'Instagram Reels';
  caption: string;    // e.g. 'Creator Rewards — October 2026'
  period: string;     // e.g. '30 days'
}

export const RESULTS: ResultProof[] = [];
