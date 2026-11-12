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
  captionFr?: string; periodFr?: string;
}

export const RESULTS: ResultProof[] = [
  { image: '/results/tiktok-6290.jpg', platform: 'TikTok', caption: 'Creator Rewards — $6,290 from 8.2M qualified views (RPM $0.76)', period: '30 days', captionFr: 'Programme créateurs — 6 290 $ pour 8,2 M de vues qualifiées (RPM 0,76 $)', periodFr: '30 jours' },
  { image: '/results/tiktok-4061.jpg', platform: 'TikTok', caption: 'A single video — $4,061 from 4.4M qualified views (RPM $0.92)', period: 'Oct 2026', captionFr: 'Une seule vidéo — 4 061 $ pour 4,4 M de vues qualifiées (RPM 0,92 $)', periodFr: 'oct. 2026' },
  { image: '/results/tiktok-video-771k.jpg', platform: 'TikTok', caption: 'One 62-second story: 771K views and 5.7K new followers', period: '3 days', captionFr: 'Une histoire de 62 s : 771 K vues et 5,7 K nouveaux abonnés', periodFr: '3 jours' },
  { image: '/results/tiktok-2479.jpg', platform: 'TikTok', caption: 'Creator Rewards — $2,479 from 3M qualified views (RPM $0.83)', period: '30 days', captionFr: 'Programme créateurs — 2 479 $ pour 3 M de vues qualifiées (RPM 0,83 $)', periodFr: '30 jours' },
];

/** Headline numbers, each backed by one of the screenshots above. */
export const RESULT_HIGHLIGHTS = [
  { value: '$6,290', label: 'earned in 30 days', detail: 'TikTok Creator Rewards · 8.2M qualified views', valueFr: '6 290 $', labelFr: 'gagnés en 30 jours', detailFr: 'Programme créateurs TikTok · 8,2 M de vues qualifiées' },
  { value: '$4,061', label: 'from a single video', detail: 'TikTok Creator Rewards · 4.4M qualified views', valueFr: '4 061 $', labelFr: 'avec une seule vidéo', detailFr: 'Programme créateurs TikTok · 4,4 M de vues qualifiées' },
  { value: '771K', label: 'views on one 62-s story', detail: '+5.7K followers in 3 days', valueFr: '771 K', labelFr: 'vues sur une histoire de 62 s', detailFr: '+5,7 K abonnés en 3 jours' },
] as const;
