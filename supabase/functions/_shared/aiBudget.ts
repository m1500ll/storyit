// Daily spending ceilings (migrations 0016, 0020). Call BEFORE every paid request; release the reservation if the
// provider call fails (it spent nothing). Two pools: Google (Gemini) under AI_DAILY_BUDGET_USD (default 2) and
// Claude (claude_* kinds, the Animated Studio) under AI_DAILY_BUDGET_CLAUDE_USD (default 30). Estimates run high.
import { createClient } from 'npm:@supabase/supabase-js@2';

export const AI_COST = {
  text: 0.01,     // one Gemini text request (story phase, concepts, captions are cheaper)
  caption: 0.003,
  image: 0.05,    // one generated image
  tts: 0.02,
  video_clip: 1,  // one generated video clip: by far the most expensive call
  claude_chat: 0.08, // one Claude Opus 5.5 turn of the animated-studio brief chat (cached system prompt, optional web search)
  claude_spec: 1.5,  // one VideoSpec generation (long structured output with adaptive thinking), incl. one repair turn
  tts_elevenlabs: 0.4, // one ~60 s ElevenLabs narration
} as const;
export type AiKind = keyof typeof AI_COST;

export class BudgetError extends Error {
  constructor() { super('La limite de dépense IA du jour est atteinte. Réessayez demain. Aucun crédit n’a été utilisé.'); }
}

let admin: ReturnType<typeof createClient> | null = null;
export async function reserveAi(kind: AiKind, count = 1): Promise<void> {
  admin ??= createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const claude = kind.startsWith('claude_');
  const cap = Number(claude ? Deno.env.get('AI_DAILY_BUDGET_CLAUDE_USD') ?? '30' : Deno.env.get('AI_DAILY_BUDGET_USD') ?? '2');
  const { data, error } = await admin.rpc('reserve_ai_spend_pool', { p_kind: kind, p_usd: AI_COST[kind] * count, p_cap: cap });
  if (error) { console.error('ai budget', error.message); throw new BudgetError(); } // fail closed
  if (data !== true) { console.error(JSON.stringify({ audit: 'ai_budget_reached', kind, cap })); throw new BudgetError(); }
}

/** gives a reservation back when the provider call failed (nothing was spent); never throws */
export async function releaseAi(kind: AiKind, count = 1): Promise<void> {
  admin ??= createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { error } = await admin.rpc('release_ai_spend', { p_kind: kind, p_usd: AI_COST[kind] * count });
  if (error) console.error('ai budget release', error.message);
}
