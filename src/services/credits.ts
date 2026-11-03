export { InsufficientCreditsError } from './errors';

/** Story Credit pricing — single source of truth for UI and billing. */
export const CREDIT_COSTS = {
  conceptGeneration: 1,
  sceneBreakdown: 2,
  sceneRender: 3, // image + video per scene
  sceneRetry: 0,
} as const;

export const PLANS = [
  { id: 'free', name: 'Starter', price: 0, credits: 30, perks: ['1 episode / month', '720p export', 'Watermark'] },
  { id: 'creator', name: 'Creator', price: 29, credits: 300, perks: ['~6 episodes / month', '1080p, no watermark', 'Character consistency lock', 'Priority queue'], featured: true },
  { id: 'studio', name: 'Studio', price: 99, credits: 1200, perks: ['~25 episodes / month', '4K export', 'Series bible & multi-seat', 'API access'] },
] as const;

export const estimateEpisodeCost = (sceneCount: number) => sceneCount * CREDIT_COSTS.sceneRender;
