import { storedLang } from '@/lib/lang';
export { InsufficientCreditsError } from './errors';
import { VIDEO_PRICES } from '@shared/promptVideo.ts';

/** Story Credit pricing — single source of truth for UI and billing. */
export const CREDIT_COSTS = {
  conceptGeneration: 100,
  sceneBreakdown: 200,
  sceneRender: 2000, // keyframe image + 4–6s talking clip; real cost ≈ $0.47–0.67 (Nov 2026), see README
  sceneRetry: 0,
  publishPack: 100, // titles, captions, hashtags, platform variants, thumbnail prompt
  thumbnail: 200, // one image variant; refunded if generation fails
  clipMinute: 100, // AI clipping: per started minute of source video, charged only if clips are found (mirrored in supabase/functions/clips-analyze)
} as const;

/** AI clipping cost of a source video: CREDIT_COSTS.clipMinute per started minute. */
export const clipCostFor = (seconds: number) => Math.max(1, Math.ceil(seconds / 60)) * CREDIT_COSTS.clipMinute;

/** Perks must stay true to what the product does. Account/video limits mirror the `plan_limits` table (server-enforced). */
export const PLANS = [
  { id: 'free', name: 'Gratuit', price: 0, credits: 1000, period: 'once', perks: ['Creative Studio: script, image and video prompts', 'Free stories (story, dialogue and scenes) + 1,000 credits to start', 'Posting to TikTok and Instagram: Creator plan'], perksFr: ['Creative Studio : script, prompts d’images et de vidéos', 'Histoires gratuites (histoire, dialogues, scènes) + 1 000 crédits pour démarrer', 'Publication TikTok et Instagram : offre Creator'] },
  { id: 'starter', name: 'Starter', price: 9, credits: 12000, period: 'month', perks: ['Your first finished videos: voices, subtitles, music', 'AI clips', '2 social accounts, 100 videos in your library', '12,000 credits / month: up to 3 videos (2 of 1 minute)'], perksFr: ['Tes premières vidéos finies : voix, sous-titres, musique', 'Clips IA', '2 comptes sociaux, 100 vidéos dans ta bibliothèque', '12 000 crédits / mois : jusqu’à 3 vidéos (2 d’1 minute)'] },
  { id: 'creator', name: 'Creator', price: 29, compareAt: 45, credits: 50000, yearly: 279, period: 'month', perks: ['AI clips: turn long videos into TikTok clips', '10 social accounts, grouped as you like', '500 videos in your library', 'Daily rotation campaigns', '50,000 credits / month: up to 14 videos (8 of 1 minute)'], perksFr: ['Clips IA : tes longues vidéos en clips TikTok', '10 comptes sociaux, regroupés comme vous voulez', '500 vidéos dans votre bibliothèque', 'Campagnes de rotation quotidienne', '50 000 crédits / mois : jusqu’à 14 vidéos (8 d’1 minute)'], featured: true },
  { id: 'pro', name: 'Pro', price: 59, credits: 90000, yearly: 569, period: 'month', badge: 'Best value', perks: ['Everything in Creator', '30 social accounts', '2,000 videos in your library', '90,000 credits / month: up to 26 videos (15 of 1 minute)'], perksFr: ['Tout ce qu’offre Creator', '30 comptes sociaux', '2 000 vidéos dans votre bibliothèque', '90 000 crédits / mois : jusqu’à 26 vidéos (15 d’1 minute)'] },
  { id: 'studio', name: 'Studio', price: 99, compareAt: 180, credits: 175000, yearly: 949, period: 'month', perks: ['Unlimited accounts and videos', 'Everything in Pro', 'Built for agencies and account networks', '175,000 credits / month: up to 51 videos (29 of 1 minute)'], perksFr: ['Comptes et vidéos illimités', 'Tout ce qu’offre Pro', 'Pensé pour les agences et les réseaux de comptes', '175 000 crédits / mois : jusqu’à 51 vidéos (29 d’1 minute)'] },
] as const;

/** yearly plans: −20 % (prices above, in `yearly`), the 12 months of credits granted at once. Must match YEARLY in
 *  supabase/functions/_shared/stripe.ts. */
export const YEARLY_DISCOUNT = 20;

/** $1 three-day trial on a paid plan (one per account), then the plan at full price. Keep in sync with
 *  supabase/functions/_shared/stripe.ts (TRIAL). */
export const TRIAL = { price: 0, days: 3, credits: 3500, switchAt: 1500 } as const; // enough for ONE 30 s video (3,400), not two
/** The $1 trial is closed to new customers (trials already running can still be ended early with TrialUpgrade). */
export const TRIAL_ENABLED = false;

export const estimateEpisodeCost = (sceneCount: number) => sceneCount * CREDIT_COSTS.sceneRender;

export const CREDIT_PACKS = [
  { id: 'pack_100', credits: 10000, price: 12 },
  { id: 'pack_500', credits: 50000, price: 49, badge: 'Best value' },
] as const;

export type ProductKey = 'starter' | 'creator' | 'pro' | 'studio' | 'creator_year' | 'pro_year' | 'studio_year' | (typeof CREDIT_PACKS)[number]['id'];

/** Full episode = concepts + storyboard + render of every scene. */
export const FULL_EPISODE_COST = CREDIT_COSTS.conceptGeneration + CREDIT_COSTS.sceneBreakdown + 15 * CREDIT_COSTS.sceneRender;
export const episodesFor = (credits: number) => Math.floor(credits / FULL_EPISODE_COST);

/** Below this balance the app nudges the user to top up (banner, amber counter). */
export const LOW_CREDITS = 1500;
/** A full Creative Studio project, charged once at the start; every step after that is included. Must match PROJECT_COST in supabase/functions/prompts. */
export const PROMPT_PROJECT_COST = 0; // the story is free since Nov 22 2026 (the video price includes it); must match PROJECT_COST in supabase/functions/prompts
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
/** Creative Studio finished videos (Eco): what one costs in total, the project included, per length */
export const CREATIVE_VIDEO_LENGTHS = ([30, 45, 60] as const).map((seconds) => ({
  seconds, label: seconds === 60 ? '1 min' : `${seconds} s`, credits: PROMPT_PROJECT_COST + VIDEO_PRICES.eco[seconds],
}));
/** how many 30-second Creative Studio videos (project + video) a credit balance pays for (the figure the landing page shows) */
export const videosFor = (credits: number) => Math.floor(credits / (PROMPT_PROJECT_COST + VIDEO_PRICES.eco[30]));
/** how many finished 30-second videos a balance pays for (the story is free) */
export const projectsFor = (credits: number) => videosFor(credits);
/** how many 1-minute Creative Studio videos (project + video) a credit balance pays for */
export const minuteVideosFor = (credits: number) => Math.floor(credits / (PROMPT_PROJECT_COST + VIDEO_PRICES.eco[60]));
/** what a finished 30-second Creative Studio video costs in total (story included) */
export const VIDEO_30S_TOTAL = PROMPT_PROJECT_COST + VIDEO_PRICES.eco[30];
/** credits shown with thousands separators (43,000) */
export const formatCredits = (n: number) => Math.round(n).toLocaleString(storedLang() === 'en' ? 'en-US' : 'fr-FR');
export type CreditLevel = 'ok' | 'low' | 'empty';
export const creditLevel = (balance: number): CreditLevel => (balance <= 0 ? 'empty' : balance <= LOW_CREDITS ? 'low' : 'ok');

/** referral programme: credits the referred friend gets with their first subscription (the webhook's REFERRAL_FRIEND_BONUS) */
export const REFERRAL_FRIEND_BONUS = 10000;
/** qualified friends needed for the big reward, and the months it gives (1 month for each other friend) */
export const REFERRAL_GOAL = 5;
export const REFERRAL_BIG_MONTHS = 6;

/** automatic top-up: any amount from 5 000 to 200 000 credits (steps of 1 000), at the packs' rate:
 *  $1.20 per 1 000 credits, $0.98 per 1 000 from 50 000 credits. Mirror of supabase/functions/_shared/stripe.ts. */
export const TOPUP = { min: 5000, max: 200000, step: 1000, thresholds: [1000, 3000, 5000, 10000] } as const;
export const topupPriceCents = (credits: number) => Math.round(credits / 1000 * (credits >= 50000 ? 98 : 120));
export const isTopupAmount = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= TOPUP.min && (n as number) <= TOPUP.max && (n as number) % TOPUP.step === 0;
