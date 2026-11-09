export { InsufficientCreditsError } from './errors';

/** Story Credit pricing — single source of truth for UI and billing. */
export const CREDIT_COSTS = {
  conceptGeneration: 1,
  sceneBreakdown: 2,
  sceneRender: 20, // keyframe image + 4–6s talking clip; real cost ≈ $0.47–0.67 (Nov 2026), see README
  sceneRetry: 0,
  publishPack: 1, // titles, captions, hashtags, platform variants, thumbnail prompt
  thumbnail: 2, // one image variant; refunded if generation fails
} as const;

/** Perks must stay true to what the product does. Account/video limits mirror the `plan_limits` table (server-enforced). */
export const PLANS = [
  { id: 'free', name: 'Starter', price: 0, credits: 30, period: 'once', perks: ['Prompt Studio: script, image and video prompts', '30 free credits (2 full projects)', 'Posting to TikTok and Instagram: Creator plan'] },
  { id: 'creator', name: 'Creator', price: 29, compareAt: 45, credits: 430, period: 'month', perks: ['10 social accounts, grouped as you like', '500 videos in your library', 'Daily rotation campaigns', '430 credits / month (28 Prompt Studio projects)'], featured: true },
  { id: 'pro', name: 'Pro', price: 59, credits: 1050, period: 'month', badge: 'Best value', perks: ['Everything in Creator', '30 social accounts', '2,000 videos in your library', '1,050 credits / month (17 animated shorts)'] },
  { id: 'studio', name: 'Studio', price: 99, compareAt: 180, credits: 1600, period: 'month', perks: ['Unlimited accounts and videos', 'Everything in Pro', 'Built for agencies and account networks', '1,600 credits / month'] },
] as const;

/** $1 three-day trial on a paid plan (one per account), then the plan at full price. Keep in sync with
 *  supabase/functions/_shared/stripe.ts (TRIAL). */
export const TRIAL = { price: 1, days: 3, credits: 60 } as const;
/** The $1 trial is closed to new customers (trials already running can still be ended early with TrialUpgrade). */
export const TRIAL_ENABLED = false;

export const estimateEpisodeCost = (sceneCount: number) => sceneCount * CREDIT_COSTS.sceneRender;

export const CREDIT_PACKS = [
  { id: 'pack_100', credits: 100, price: 12 },
  { id: 'pack_500', credits: 500, price: 49, badge: 'Best value' },
] as const;

export type ProductKey = 'creator' | 'pro' | 'studio' | (typeof CREDIT_PACKS)[number]['id'];

/** Full episode = concepts + storyboard + render of every scene. */
export const FULL_EPISODE_COST = CREDIT_COSTS.conceptGeneration + CREDIT_COSTS.sceneBreakdown + 15 * CREDIT_COSTS.sceneRender;
export const episodesFor = (credits: number) => Math.floor(credits / FULL_EPISODE_COST);

/** Below this balance the app nudges the user to top up (banner, amber counter). */
export const LOW_CREDITS = 15;
/** A full Prompt Studio project, charged once at the start; every step after that is included. Must match PROJECT_COST in supabase/functions/prompts. */
export const PROMPT_PROJECT_COST = 15;
/** One finished animated short (Animated Studio), charged once at "Generate" and refunded if the render fails.
 *  Must match ANIMATED_CREDITS (default 60) in supabase/functions/_shared/animatedStudio.ts. */
export const ANIMATED_SHORT_COST = 60;
/** video lengths the customer can pick in the Animated Studio, with their price. Must match LENGTH_COST in
 *  supabase/functions/_shared/animatedStudio.ts. */
export const ANIMATED_LENGTHS = [
  { seconds: 30, label: '30 secondes', credits: 35 },
  { seconds: 60, label: '1 minute', credits: ANIMATED_SHORT_COST },
  { seconds: 120, label: '2 minutes', credits: 120 },
] as const;
export type AnimatedLength = (typeof ANIMATED_LENGTHS)[number]['seconds'];
/** how many 30-second animated videos a credit balance pays for (the figure the landing page shows) */
export const videosFor = (credits: number) => Math.floor(credits / ANIMATED_LENGTHS[0].credits);
export const projectsFor = (credits: number) => Math.floor(credits / PROMPT_PROJECT_COST);
export type CreditLevel = 'ok' | 'low' | 'empty';
export const creditLevel = (balance: number): CreditLevel => (balance <= 0 ? 'empty' : balance <= LOW_CREDITS ? 'low' : 'ok');

/** referral programme: credits the referred friend gets with their first subscription (the webhook's REFERRAL_FRIEND_BONUS) */
export const REFERRAL_FRIEND_BONUS = 100;
/** qualified friends needed for the big reward, and the months it gives (1 month for each other friend) */
export const REFERRAL_GOAL = 5;
export const REFERRAL_BIG_MONTHS = 6;
