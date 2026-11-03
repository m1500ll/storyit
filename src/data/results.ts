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

export const RESULTS: ResultProof[] = [
  { image: '/results/tiktok-6290.jpg', platform: 'TikTok', caption: 'Creator Rewards — $6,290 from 8.2M qualified views (RPM $0.76)', period: '30 days' },
  { image: '/results/tiktok-4061.jpg', platform: 'TikTok', caption: 'Creator Rewards — $4,061 from 4.4M qualified views (RPM $0.92)', period: 'Oct 2026' },
  { image: '/results/tiktok-video-771k.jpg', platform: 'TikTok', caption: 'One 62-second story: 771K views and 5.7K new followers', period: '3 days' },
  { image: '/results/tiktok-2479.jpg', platform: 'TikTok', caption: 'Creator Rewards — $2,479 from 3M qualified views (RPM $0.83)', period: '30 days' },
];
