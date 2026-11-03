export { InsufficientCreditsError } from './errors';

/** Story Credit pricing — single source of truth for UI and billing. */
export const CREDIT_COSTS = {
  conceptGeneration: 1,
  sceneBreakdown: 2,
  sceneRender: 3, // image + video per scene
  sceneRetry: 0,
} as const;

/** Plans differ only by credits today — perks must stay true to what the product does. */
export const PLANS = [
  { id: 'free', name: 'Starter', price: 0, credits: 30, period: 'once', perks: ['30 credits on signup, no card', 'Try ideas, concepts & storyboards', 'All exports included'] },
  { id: 'creator', name: 'Creator', price: 29, credits: 300, period: 'month', perks: ['Everything in Starter', 'Free scene retries', 'Top up anytime with credit packs'], featured: true },
  { id: 'studio', name: 'Studio', price: 99, credits: 1200, period: 'month', perks: ['Everything in Creator', 'Lowest cost per episode', 'Built for daily posting on several accounts'] },
] as const;

export const estimateEpisodeCost = (sceneCount: number) => sceneCount * CREDIT_COSTS.sceneRender;

export const CREDIT_PACKS = [
  { id: 'pack_100', credits: 100, price: 12 },
  { id: 'pack_500', credits: 500, price: 49, badge: 'Best value' },
] as const;

export type ProductKey = 'creator' | 'studio' | (typeof CREDIT_PACKS)[number]['id'];

/** Full episode = concepts + storyboard + render of every scene. */
export const FULL_EPISODE_COST = CREDIT_COSTS.conceptGeneration + CREDIT_COSTS.sceneBreakdown + 15 * CREDIT_COSTS.sceneRender;
export const episodesFor = (credits: number) => Math.floor(credits / FULL_EPISODE_COST);
