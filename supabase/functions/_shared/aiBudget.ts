// Daily spending ceiling on Storyit's Google AI key (see migration 0016). Call BEFORE every paid request.
// Secrets: AI_DAILY_BUDGET_USD (default 2). Estimates are deliberately on the high side.
import { createClient } from 'npm:@supabase/supabase-js@2';

export const AI_COST = {
  text: 0.01,     // one Gemini text request (story phase, concepts, captions are cheaper)
  caption: 0.003,
  image: 0.05,    // one generated image
  tts: 0.02,
  video_clip: 1,  // one generated video clip: by far the most expensive call
} as const;
export type AiKind = keyof typeof AI_COST;

export class BudgetError extends Error {
  constructor() { super('La limite de dépense IA du jour est atteinte. Réessayez demain. Aucun crédit n’a été utilisé.'); }
}

let admin: ReturnType<typeof createClient> | null = null;
export async function reserveAi(kind: AiKind, count = 1): Promise<void> {
  admin ??= createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const cap = Number(Deno.env.get('AI_DAILY_BUDGET_USD') ?? '2');
  const { data, error } = await admin.rpc('reserve_ai_spend', { p_kind: kind, p_usd: AI_COST[kind] * count, p_cap: cap });
  if (error) { console.error('ai budget', error.message); throw new BudgetError(); } // fail closed
  if (data !== true) { console.error(JSON.stringify({ audit: 'ai_budget_reached', kind, cap })); throw new BudgetError(); }
}
