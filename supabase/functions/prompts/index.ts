// Supabase Edge Function: `prompts` — Creative Studio + bring-your-own Gemini key.
// - Phases (concepts → script → image JSON → video JSON → pack): the master prompt never leaves the server.
//   With the user's own Gemini key they run on the user's Google account and cost no Storyit credits;
//   otherwise a whole project costs PROJECT_COST credits, charged once when it is created (first concepts, on success);
//   every later step and regeneration of that project is included.
// - Scene images: generated with the user's key only (Google bills the user), stored privately in `renders`.
// - Keys: AES-GCM encrypted (TOKEN_ENCRYPTION_KEY), never returned to the browser.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { DEFAULT_VIDEO_LENGTH, FIX_PROBLEMS, FIX_SCHEMA, isVideoLength, MASTER_PROMPT, PHASES, STYLES, buildFixPrompt, buildPhasePrompt, buildReviewPrompt, normalizePhase, paceProblems, senseProblems, styleOf, type PhaseKey } from '../_shared/promptStudio.ts';
import { classifyGeminiError, GeminiError, KEY_MESSAGES, keyHint, looksLikeGeminiKey } from '../_shared/geminiKey.ts';
import { decrypt, encrypt } from '../_shared/social.ts';
import { backups, backupText, openaiModels } from '../_shared/backupLlm.ts';
import { reserveAi } from '../_shared/aiBudget.ts';

const API = 'https://generativelanguage.googleapis.com/v1beta';
const TEXT_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash';
const TEXT_FALLBACK = Deno.env.get('GEMINI_FALLBACK_MODEL') ?? 'gemini-3.5-flash-lite';
const PROJECT_COST = 1500;


const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

async function callGemini(key: string, model: string, body: unknown, timeoutMs: number) {
  try { await reserveAi('text'); } catch { throw new GeminiError('quota', 429); } // daily ceiling: behaves like a quota
  let res: Response;
  try {
    res = await fetch(`${API}/models/${model}:generateContent`, {
      method: 'POST', signal: AbortSignal.timeout(timeoutMs),
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body),
    });
  } catch {
    throw new GeminiError('overloaded', 0);
  }
  if (!res.ok) {
    const text = await res.text();
    console.error('gemini', model, res.status, text.slice(0, 400)); // Google's reason (never contains the key)
    throw new GeminiError(classifyGeminiError(res.status, text), res.status);
  }
  return await res.json();
}

/** Text phase: one long attempt on the main model, then the fallback; stays under the Edge Function limit. */
// One request must answer before the 150 s gateway limit, or the browser only sees "Failed to send a request".
const REQUEST_BUDGET = 135_000;

async function generateText(key: string, prompt: string, schema: unknown, allowBackup = false, check: (raw: unknown) => unknown = (r) => r, deadline = Date.now() + REQUEST_BUDGET) {
  const started = Date.now();
  const budget = deadline - started;
  let last: GeminiError = new GeminiError('other', 0);
  // ChatGPT (OpenAI API) first when OPENAI_API_KEY is set; then Gemini, then the free backups
  for (const m of openaiModels()) {
    const left = budget - (Date.now() - started);
    if (left < 30_000) break;
    try { await reserveAi('text'); } catch { break; }
    // leave the fallbacks a real chance when ChatGPT is slow
    const out = await backupText(m, MASTER_PROMPT, prompt, schema, Math.min(left - 5_000, 90_000)).catch((e) => { console.error('openai', m.model, e instanceof Error ? e.message : e); return null; });
    console.log('openai', m.model, out ? 'ok' : 'failed', `${Math.round((Date.now() - started) / 1000)}s`);
    if (!out) continue;
    try { return check(out); } catch (e) { console.error('openai invalid', m.model, e instanceof Error ? e.message : e); }
  }
  for (const model of [TEXT_MODEL, TEXT_FALLBACK]) {
    const left = budget - (Date.now() - started);
    if (left < 20_000) break;
    try {
      const out = await callGemini(key, model, {
        systemInstruction: { parts: [{ text: MASTER_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 1, maxOutputTokens: 32768 },
      }, Math.min(left - 5_000, 110_000));
      const text = out?.candidates?.[0]?.content?.parts?.filter((p: { text?: string }) => p.text).map((p: { text: string }) => p.text).join('');
      if (!text) throw new GeminiError('other', 200);
      return check(JSON.parse(text));
    } catch (e) {
      last = e instanceof GeminiError ? e : new GeminiError('other', 0);
      // Only a bad key makes the fallback pointless. Quotas are per model (the free tier of Flash-Lite is separate
      // and larger than Flash), so a 429 "free_tier" on the main model must still try the fallback.
      if (last.problem === 'invalid') break;
    }
  }
  if (allowBackup && last.problem !== 'blocked') {
    for (const bk of backups()) {
      const left = budget - (Date.now() - started);
      if (left < 15_000) break;
      const out = await backupText(bk, MASTER_PROMPT, prompt, schema, left - 5_000).catch(() => null);
      if (!out) continue;
      try { return check(out); } catch (e) { console.error('backup llm invalid', bk.model, e instanceof Error ? e.message : e); }
    }
  }
  throw last;
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const user = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: auth } = await user.auth.getUser();
  if (!auth.user) return json({ error: 'Veuillez vous reconnecter.' }, 401);
  const uid = auth.user.id;
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let body: { action?: string; project_id?: string; phase?: PhaseKey; idea?: string; choice?: number; feedback?: string; key?: string; scene?: number; style?: string; story?: string; part?: number; previous_end?: string; problem?: string; note?: string; length?: number };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const action = body.action ?? 'phase';

  const keyRow = async () => (await admin.from('user_ai_keys').select('*').eq('user_id', uid).maybeSingle()).data as
    { key_enc: string; key_hint: string; status: string; last_error: string | null; last_checked_at: string } | null;
  // Bring-your-own Gemini keys were removed from the product: every generation runs on Storyit's providers.
  const userKey = async (): Promise<string | null> => null;
  const flag = (status: 'invalid' | 'no_billing' | 'valid', err: string | null) =>
    admin.from('user_ai_keys').update({ status, last_error: err, last_checked_at: new Date().toISOString() }).eq('user_id', uid);

  // ---------- Key management ----------
  if (action === 'key_status') {
    const r = await keyRow();
    return json({ connected: Boolean(r), hint: r?.key_hint ?? null, status: r?.status ?? null, last_error: r?.last_error ?? null, checked_at: r?.last_checked_at ?? null });
  }
  if (action === 'key_delete') {
    await admin.from('user_ai_keys').delete().eq('user_id', uid);
    return json({ connected: false });
  }
  if (action === 'key_save') {
    return json({ error: 'Les clés Gemini personnelles ne sont plus utilisées : Storyit génère tout pour vous.' }, 410);
    const key = String(body.key ?? '').trim();
    if (!looksLikeGeminiKey(key)) return json({ error: 'Ce n’est pas une clé Gemini. Copiez la clé complète depuis Google AI Studio → API keys (sans espace).' }, 400);
    try {
      // Free, harmless check: a tiny text request on the user's key.
      await callGemini(key, TEXT_FALLBACK, { contents: [{ role: 'user', parts: [{ text: 'Réponds simplement OK.' }] }], generationConfig: { maxOutputTokens: 5 } }, 30_000);
    } catch (e) {
      const g = e instanceof GeminiError ? e : new GeminiError('other', 0);
      if (g.problem === 'invalid') return json({ error: KEY_MESSAGES.invalid }, 400);
      if (g.problem !== 'no_billing' && g.problem !== 'quota') return json({ error: g.message }, 502);
    }
    const { error } = await admin.from('user_ai_keys').upsert({ user_id: uid, key_enc: await encrypt(key), key_hint: keyHint(key), status: 'valid', last_error: null, last_checked_at: new Date().toISOString() });
    if (error) return json({ error: 'Impossible d’enregistrer la clé.' }, 500);
    console.log(JSON.stringify({ audit: 'ai_key_saved', user: uid }));
    return json({ connected: true, hint: keyHint(key), status: 'valid' });
  }

  // ---------- Project (RLS: only the caller's own) ----------
  let project: { id: string; data: Record<string, any>; idea: string | null; phase: number } | null = null;
  if (body.project_id) {
    const { data } = await user.from('prompt_projects').select('id, data, idea, phase').eq('id', body.project_id).maybeSingle();
    if (!data) return json({ error: 'Projet introuvable' }, 404);
    project = data;
  }

  // Scene image generation was removed from the product (the Animated Studio replaces it).
  if (action === 'image') return json({ error: 'La génération d’images a été retirée de Storyit.' }, 410);

  // Projects made before the V4 studio keep their results but are read-only: the new steps expect the new format.
  if (project && !project.data?.v4 && (action === 'phase' || action === 'fix')) return json({ error: 'Ce projet a été créé avec l’ancienne version du studio : créez un nouveau projet pour utiliser la nouvelle.' }, 409);

  // ---------- Dépannage: the corrected prompt of ONE clip (included in the project) ----------
  if (action === 'review') {
    if (!project?.data?.script) return json({ error: 'Écrivez d’abord le découpage.' }, 400);
    const d = { ...project.data } as Record<string, any>;
    try {
      const fixed: any = await generateText(Deno.env.get('GEMINI_API_KEY') ?? '', buildReviewPrompt(d.script), PHASES.script.schema, true, (r) => normalizePhase('script', r));
      const before = paceProblems(d.script).length + senseProblems(d.script).length;
      if (paceProblems(fixed).length + senseProblems(fixed).length <= before) {
        d.script = fixed;
        delete d.videos; // the Grok prompts follow the dialogue timings: they are written again
      }
      d.script_reviewed = true;
      const saved = await admin.from('prompt_projects').update({ data: d, updated_at: new Date().toISOString() }).eq('id', project.id).eq('user_id', uid).select('*').single();
      if (saved.error) throw new Error('Impossible d’enregistrer le projet');
      return json({ project: saved.data });
    } catch (e) {
      const msg = e instanceof GeminiError ? 'Le service de génération est très demandé en ce moment. Réessayez dans quelques minutes.' : (e instanceof Error ? e.message : 'Échec');
      return json({ error: `${msg} Aucun crédit n’a été utilisé.` }, 502);
    }
  }
  if (action === 'fix') {
    if (!project) return json({ error: 'Projet introuvable' }, 404);
    const d = { ...project.data } as Record<string, any>;
    const i = Number(body.scene);
    if (!d.script?.clips?.[i]) return json({ error: 'Clip introuvable' }, 400);
    if (!(String(body.problem) in FIX_PROBLEMS)) return json({ error: 'Problème inconnu' }, 400);
    try {
      const out: any = await generateText(Deno.env.get('GEMINI_API_KEY') ?? '', buildFixPrompt(d, i, String(body.problem), String(body.note ?? '').slice(0, 400)), FIX_SCHEMA, true,
        (r: any) => { if (!Array.isArray(r?.lines) || !r.lines.length || !Array.isArray(r?.shots) || !r.shots.length) throw new Error('Correction incomplète'); return r; });
      const fixed = normalizePhase('script', { clips: [{ ...d.script.clips[i], lines: out.lines }, ...d.script.clips.slice(0, 3)] }).clips[0];
      d.script = { ...d.script, clips: d.script.clips.map((c: any, k: number) => (k === i ? { ...c, lines: fixed.lines } : c)) };
      if (d.videos?.clips?.[i]) {
        const v = normalizePhase('videos', { clips: [{ head_lock: out.head_lock, look_lock: out.look_lock, shots: out.shots, sound: out.sound }, ...d.videos.clips.slice(0, 4)] }).clips[0];
        d.videos = { ...d.videos, clips: d.videos.clips.map((c: any, k: number) => (k === i ? v : c)) };
      }
      if (d.images?.clips?.[i] && out.image?.setting) {
        const im = normalizePhase('images', { sheet: d.images.sheet, clips: [out.image, ...d.images.clips.slice(0, 4)] }).clips[0];
        d.images = { ...d.images, clips: d.images.clips.map((c: any, k: number) => (k === i ? im : c)) };
      }
      d.fixes = { ...(d.fixes ?? {}), [i]: { problem: body.problem, explanation: String(out.explanation ?? '').slice(0, 400), at: new Date().toISOString() } };
      const saved = await admin.from('prompt_projects').update({ data: d, updated_at: new Date().toISOString() }).eq('id', project.id).eq('user_id', uid).select('*').single();
      if (saved.error) throw new Error('Impossible d’enregistrer le projet');
      return json({ project: saved.data });
    } catch (e) {
      const msg = e instanceof GeminiError ? 'Le service de génération est très demandé en ce moment. Réessayez dans quelques minutes.' : (e instanceof Error ? e.message : 'Échec');
      return json({ error: `${msg} Aucun crédit n’a été utilisé.` }, 502);
    }
  }

  // ---------- Text phases ----------
  if (action !== 'phase') return json({ error: 'Action inconnue' }, 400);
  const phase = body.phase;
  if (!phase || !(phase in PHASES)) return json({ error: 'Étape inconnue' }, 400);
  if (!project && phase !== 'concepts' && phase !== 'script') return json({ error: 'Commencez par votre histoire' }, 400);
  if (!project && phase === 'script' && !String(body.story ?? '').trim()) return json({ error: 'Écrivez votre histoire (même en vrac) ou demandez 3 histoires.' }, 400);

  const ownKey = await userKey();
  const billable = !ownKey && !project; // only a brand-new project is charged
  if (billable) {
    const { data: profile } = await user.from('profiles').select('credit_balance').eq('id', uid).single();
    if (!profile || profile.credit_balance < PROJECT_COST) return json({ error: 'Crédits insuffisants : rechargez votre solde pour continuer.' }, 402);
  }

  const data: Record<string, any> = { ...(project?.data ?? {}) };
  if (!project) {
    data.v4 = true;
    data.style = styleOf(body.style);
    data.story = String(body.story ?? '').trim().slice(0, 3000);
    data.part = Math.max(1, Math.min(20, Number(body.part) || 1));
    data.previous_end = String(body.previous_end ?? '').trim().slice(0, 1500);
    data.length = isVideoLength(body.length) ? body.length : DEFAULT_VIDEO_LENGTH; // 30, 45 (default) or 60 s
  }
  // a new length on an existing project: the story and the script are written again for it
  if (project && isVideoLength(body.length) && (phase === 'concepts' || phase === 'script')) data.length = body.length;
  if (phase === 'script' && typeof body.choice === 'number') {
    if (!data.concepts?.[body.choice]) return json({ error: 'Choisissez une histoire' }, 400);
    data.chosen = body.choice;
  }
  if (PHASES[phase].requires.some((k) => data[k] === undefined)) return json({ error: 'Validez d’abord l’étape précédente' }, 400);

  const idea = String(body.idea ?? body.story ?? project?.idea ?? '').trim().slice(0, 600);
  const deadline = Date.now() + REQUEST_BUDGET; // shared by every generation of this request
  try {
    let trends: unknown;
    if (phase === 'concepts') { // the latest daily trend report inspires the 3 stories (formats that work, not copies)
      const { data: rep } = await admin.from('trend_reports').select('day, insights').order('day', { ascending: false }).limit(1).maybeSingle();
      if (rep) {
        const { data: cs } = await admin.from('trend_concepts').select('title, fr_status, kind, hook, ending, repeat_line, screen_line').eq('day', rep.day).limit(200);
        const pick = [...(cs ?? [])].sort(() => Math.random() - 0.5).sort((a, b) => (a.fr_status === 'green' ? 0 : 1) - (b.fr_status === 'green' ? 0 : 1)).slice(0, 12);
        trends = { insights: rep.insights, concepts: pick };
      }
    }
    const phasePrompt = buildPhasePrompt(phase, { ...data, trends, feedback: String(body.feedback ?? '').slice(0, 600) });
    const valid = (r: unknown) => normalizePhase(phase, r);
    let raw;
    if (ownKey) {
      // The user's key first (their quota). If Google refuses it (no billing, quota, overload), the user still gets their
      // story: Storyit's own chain takes over at no cost to them (free tiers / backup providers).
      try { raw = await generateText(ownKey, phasePrompt, PHASES[phase].schema, false, valid, deadline); } catch (e) {
        const g = e instanceof GeminiError ? e : null;
        if (g?.problem === 'blocked') throw e;
        if (g?.problem === 'invalid' || g?.problem === 'no_billing') await flag(g.problem, g.message);
        raw = await generateText(Deno.env.get('GEMINI_API_KEY') ?? '', phasePrompt, PHASES[phase].schema, true, valid, deadline);
      }
    } else {
      raw = await generateText(Deno.env.get('GEMINI_API_KEY') ?? '', phasePrompt, PHASES[phase].schema, true, valid, deadline);
    }
    if (phase === 'script') { // relecture: a second AI pass checks that every line makes sense and fixes it
      const before = paceProblems(raw).length + senseProblems(raw).length;
      let reviewed = false;
      console.log('script check', before, 'problems', `${Math.round((deadline - Date.now()) / 1000)}s left`);
      if (deadline - Date.now() > 40_000) {
        try {
          const fixed: any = await generateText(Deno.env.get('GEMINI_API_KEY') ?? '', buildReviewPrompt(raw), PHASES.script.schema, true, valid, deadline);
          if (paceProblems(fixed).length + senseProblems(fixed).length <= before) raw = fixed;
          reviewed = true;
        } catch (e) { console.error('script review', e instanceof Error ? e.message : e); } // the browser asks for the review next
      }
      data.script_reviewed = reviewed;
    }
    data[PHASES[phase].key] = raw; // already normalized and checked by `valid`
    for (const later of PHASES[phase].invalidates) delete data[later];
    if (phase === 'concepts' || phase === 'script' || phase === 'images') delete data.image_files; // images no longer match

    const concept = data.concepts?.[Number(data.chosen ?? 0)];
    const title = data.script?.title ?? concept?.title ?? 'Nouveau mini-drama';
    const row = { user_id: uid, data, idea: idea || null, phase: PHASES[phase].number, title: `${STYLES[styleOf(data.style)].emoji} ${title}${Number(data.part) > 1 ? ` · Partie ${data.part}` : ''}`, updated_at: new Date().toISOString() };
    const saved = project
      ? await admin.from('prompt_projects').update(row).eq('id', project.id).eq('user_id', uid).select('*').single()
      : await admin.from('prompt_projects').insert(row).select('*').single();
    if (saved.error) throw new Error('Impossible d’enregistrer le projet');

    // Text works on Google's free tier too, so a text success says nothing about image billing: status unchanged.
    if (billable) await user.rpc('consume_credits', { p_amount: PROJECT_COST, p_story_id: null, p_description: 'Creative Studio — new project' });
    return json({ project: saved.data, billed_to: ownKey ? 'your_gemini_key' : billable ? 'storyit_credits' : 'included' });
  } catch (e) {
    const g = e instanceof GeminiError ? e : null;
    const msg = g ? (g.problem === 'no_billing' || g.problem === 'quota' ? 'Le service de génération est très demandé en ce moment. Réessayez dans quelques minutes.' : g.message)
      : (e instanceof Error ? e.message : 'Échec de la génération');
    console.error('prompts', phase, msg);
    return json({ error: `${msg} Aucun crédit Storyit n’a été utilisé.` }, 502);
  }
});
