// Supabase Edge Function: `prompts` — Prompt Studio.
// Guides the customer through 5 validated phases and returns ready-to-paste JSON prompts
// (Gemini image → Google Flow). The master prompt below never leaves the server.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { MASTER_PROMPT, PHASES, buildPhasePrompt, normalizePhase, type PhaseKey } from '../_shared/promptStudio.ts';

const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash';
const FALLBACK = Deno.env.get('GEMINI_FALLBACK_MODEL') ?? 'gemini-3.5-flash-lite';
const COST = 1; // credits per generated phase (charged only on success)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

async function gemini(model: string, prompt: string, schema: unknown, timeoutMs: number) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', signal: AbortSignal.timeout(timeoutMs),
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': Deno.env.get('GEMINI_API_KEY') ?? '' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: MASTER_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 1, maxOutputTokens: 32768 },
    }),
  });
  if (!res.ok) throw Object.assign(new Error(`AI ${res.status}`), { status: res.status });
  const text = (await res.json())?.candidates?.[0]?.content?.parts?.filter((p: { text?: string }) => p.text).map((p: { text: string }) => p.text).join('');
  if (!text) throw new Error('Empty AI answer');
  return JSON.parse(text);
}

/** One long attempt on the main model, then the fallback; stays under the Edge Function limit. */
async function generate(prompt: string, schema: unknown) {
  const started = Date.now();
  let last: unknown;
  for (const model of [MODEL, FALLBACK]) {
    const left = 140_000 - (Date.now() - started);
    if (left < 20_000) break;
    try { return await gemini(model, prompt, schema, Math.min(left - 5_000, 110_000)); } catch (e) {
      last = e;
      const status = (e as { status?: number }).status;
      if (status === 400 || status === 401 || status === 403) break;
    }
  }
  const status = (last as { status?: number })?.status;
  throw new Error(status === 402 || status === 429 ? 'Les crédits IA sont épuisés pour le moment. Réessayez plus tard. Aucun crédit Storyit n’a été utilisé.'
    : 'L’IA n’a pas répondu à temps. Réessayez dans une minute. Aucun crédit Storyit n’a été utilisé.');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const user = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: auth } = await user.auth.getUser();
  if (!auth.user) return json({ error: 'Veuillez vous reconnecter.' }, 401);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let body: { project_id?: string; phase?: PhaseKey; idea?: string; choice?: number; feedback?: string };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const phase = body.phase;
  if (!phase || !(phase in PHASES)) return json({ error: 'Étape inconnue' }, 400);

  // Load (RLS: only the caller's own project) or create the project.
  let project: { id: string; data: Record<string, unknown>; idea: string | null; phase: number } | null = null;
  if (body.project_id) {
    const { data } = await user.from('prompt_projects').select('id, data, idea, phase').eq('id', body.project_id).maybeSingle();
    if (!data) return json({ error: 'Projet introuvable' }, 404);
    project = data;
  } else if (phase !== 'concepts') {
    return json({ error: 'Commencez par les concepts' }, 400);
  }

  const { data: profile } = await user.from('profiles').select('credit_balance').eq('id', auth.user.id).single();
  if (!profile || profile.credit_balance < COST) return json({ error: 'Not enough Story Credits.' }, 402);

  const data: Record<string, unknown> = { ...(project?.data ?? {}) };
  if (phase === 'script') {
    const concepts = data.concepts as unknown[] | undefined;
    if (typeof body.choice !== 'number' || !concepts?.[body.choice]) return json({ error: 'Choisissez un concept' }, 400);
    data.chosen = body.choice;
  }
  const missing = PHASES[phase].requires.find((k) => data[k] === undefined);
  if (missing) return json({ error: 'Validez d’abord l’étape précédente' }, 400);

  const idea = String(body.idea ?? project?.idea ?? '').trim().slice(0, 600);
  try {
    const raw = await generate(buildPhasePrompt(phase, { ...data, idea, feedback: String(body.feedback ?? '').slice(0, 600) }), PHASES[phase].schema);
    data[PHASES[phase].key] = normalizePhase(phase, raw);
    // Regenerating an earlier phase invalidates what was built on top of it.
    for (const later of PHASES[phase].invalidates) delete data[later];

    const concept = (data.concepts as { title?: string }[] | undefined)?.[Number(data.chosen ?? 0)];
    const row = { user_id: auth.user.id, data, idea: idea || null, phase: PHASES[phase].number, title: concept?.title ?? 'Nouveau projet', updated_at: new Date().toISOString() };
    const saved = project
      ? await admin.from('prompt_projects').update(row).eq('id', project.id).eq('user_id', auth.user.id).select('*').single()
      : await admin.from('prompt_projects').insert(row).select('*').single();
    if (saved.error) throw new Error('Impossible d’enregistrer le projet');

    // Charge only after a successful, saved generation.
    await user.rpc('consume_credits', { p_amount: COST, p_story_id: null, p_description: `Prompt Studio — ${PHASES[phase].label}` });
    return json({ project: saved.data });
  } catch (e) {
    console.error('prompts', phase, e instanceof Error ? e.message : e);
    return json({ error: e instanceof Error ? e.message : 'Échec de la génération' }, 502);
  }
});
