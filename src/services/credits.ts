export { InsufficientCreditsError } from './errors';

/** Story Credit pricing — single source of truth for UI and billing. */
export const CREDIT_COSTS = {
  conceptGeneration: 100,
  sceneBreakdown: 200,
  sceneRender: 2000, // keyframe image + 4–6s talking clip; real cost ≈ $0.47–0.67 (Nov 2026), see README
  sceneRetry: 0,
  publishPack: 100, // titles, captions, hashtags, platform variants, thumbnail prompt
  thumbnail: 200, // one image variant; refunded if generation fails
} as const;

/** Perks must stay true to what the product does. Account/video limits mirror the `plan_limits` table (server-enforced). */
export const PLANS = [
  { id: 'free', name: 'Starter', price: 0, credits: 3000, period: 'once', perks: ['Prompt Studio: script, image and video prompts', '3,000 free credits (2 full projects)', 'Posting to TikTok and Instagram: Creator plan'], perksFr: ['Prompt Studio : script, prompts d’images et de vidéos', '3 000 crédits offerts (2 projets complets)', 'Publication TikTok et Instagram : offre Creator'] },
  { id: 'creator', name: 'Creator', price: 29, compareAt: 45, credits: 43000, period: 'month', perks: ['10 social accounts, grouped as you like', '500 videos in your library', 'Daily rotation campaigns', '43,000 credits / month (28 Prompt Studio projects)'], perksFr: ['10 comptes sociaux, regroupés comme vous voulez', '500 vidéos dans votre bibliothèque', 'Campagnes de rotation quotidienne', '43 000 crédits / mois (28 projets Prompt Studio)'], featured: true },
  { id: 'pro', name: 'Pro', price: 59, credits: 105000, period: 'month', badge: 'Best value', perks: ['Everything in Creator', '30 social accounts', '2,000 videos in your library', '105,000 credits / month (17 animated shorts)'], perksFr: ['Tout ce qu’offre Creator', '30 comptes sociaux', '2 000 vidéos dans votre bibliothèque', '105 000 crédits / mois (17 vidéos animées)'] },
  { id: 'studio', name: 'Studio', price: 99, compareAt: 180, credits: 160000, period: 'month', perks: ['Unlimited accounts and videos', 'Everything in Pro', 'Built for agencies and account networks', '160,000 credits / month'], perksFr: ['Comptes et vidéos illimités', 'Tout ce qu’offre Pro', 'Pensé pour les agences et les réseaux de comptes', '160 000 crédits / mois'] },
] as const;

/** $1 three-day trial on a paid plan (one per account), then the plan at full price. Keep in sync with
 *  supabase/functions/_shared/stripe.ts (TRIAL). */
export const TRIAL = { price: 1, days: 3, credits: 6000 } as const;
/** The $1 trial is closed to new customers (trials already running can still be ended early with TrialUpgrade). */
export const TRIAL_ENABLED = false;

export const estimateEpisodeCost = (sceneCount: number) => sceneCount * CREDIT_COSTS.sceneRender;

export const CREDIT_PACKS = [
  { id: 'pack_100', credits: 10000, price: 12 },
  { id: 'pack_500', credits: 50000, price: 49, badge: 'Best value' },
] as const;

export type ProductKey = 'creator' | 'pro' | 'studio' | (typeof CREDIT_PACKS)[number]['id'];

/** Full episode = concepts + storyboard + render of every scene. */
export const FULL_EPISODE_COST = CREDIT_COSTS.conceptGeneration + CREDIT_COSTS.sceneBreakdown + 15 * CREDIT_COSTS.sceneRender;
export const episodesFor = (credits: number) => Math.floor(credits / FULL_EPISODE_COST);

/** Below this balance the app nudges the user to top up (banner, amber counter). */
export const LOW_CREDITS = 1500;
/** A full Prompt Studio project, charged once at the start; every step after that is included. Must match PROJECT_COST in supabase/functions/prompts. */
export const PROMPT_PROJECT_COST = 1500;
/** One finished animated short (Animated Studio), charged once at "Generate" and refunded if the render fails.
 *  Must match ANIMATED_CREDITS (default 6000) in supabase/functions/_shared/animatedStudio.ts. */
export const ANIMATED_SHORT_COST = 6000;
/** video lengths the customer can pick in the Animated Studio, with their price. Must match LENGTH_COST in
 *  supabase/functions/_shared/animatedStudio.ts. */
export const ANIMATED_LENGTHS = [
  { seconds: 30, label: '30 secondes', credits: 3500 },
  { seconds: 60, label: '1 minute', credits: ANIMATED_SHORT_COST },
  { seconds: 120, label: '2 minutes', credits: 12000 },
] as const;
export type AnimatedLength = (typeof ANIMATED_LENGTHS)[number]['seconds'];
/** video translation: credits per started minute of video. Must match DUB_CREDITS_PER_MIN in supabase/functions/dubbing. */
export const DUB_CREDITS_PER_MIN = 3500;
export const dubCost = (seconds: number) => DUB_CREDITS_PER_MIN * Math.max(1, Math.ceil(seconds / 60));
/** how many 30-second animated videos a credit balance pays for (the figure the landing page shows) */
export const videosFor = (credits: number) => Math.floor(credits / ANIMATED_LENGTHS[0].credits);
export const projectsFor = (credits: number) => Math.floor(credits / PROMPT_PROJECT_COST);
/** credits shown with thousands separators (43,000) */
export const formatCredits = (n: number) => Math.round(n).toLocaleString(typeof navigator !== 'undefined' && /^fr\b/i.test(navigator.language || '') ? 'fr-FR' : 'en-US');
export type CreditLevel = 'ok' | 'low' | 'empty';
export const creditLevel = (balance: number): CreditLevel => (balance <= 0 ? 'empty' : balance <= LOW_CREDITS ? 'low' : 'ok');

/** referral programme: credits the referred friend gets with their first subscription (the webhook's REFERRAL_FRIEND_BONUS) */
export const REFERRAL_FRIEND_BONUS = 10000;
/** qualified friends needed for the big reward, and the months it gives (1 month for each other friend) */
export const REFERRAL_GOAL = 5;
export const REFERRAL_BIG_MONTHS = 6;
