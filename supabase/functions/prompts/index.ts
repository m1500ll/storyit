// Supabase Edge Function: `prompts` — Prompt Studio + bring-your-own Gemini key.
// - Phases (concepts → script → image JSON → video JSON → pack): the master prompt never leaves the server.
//   With the user's own Gemini key they run on the user's Google account and cost no Storyit credits;
//   otherwise a whole project costs PROJECT_COST credits, charged once when it is created (first concepts, on success);
//   every later step and regeneration of that project is included.
// - Scene images: generated with the user's key only (Google bills the user), stored privately in `renders`.
// - Keys: AES-GCM encrypted (TOKEN_ENCRYPTION_KEY), never returned to the browser.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { MASTER_PROMPT, PHASES, buildPhasePrompt, normalizePhase, type PhaseKey } from '../_shared/promptStudio.ts';
import { classifyGeminiError, GeminiError, KEY_MESSAGES, keyHint, looksLikeGeminiKey } from '../_shared/geminiKey.ts';
import { decrypt, encrypt } from '../_shared/social.ts';
import { backups, backupText } from '../_shared/backupLlm.ts';

const API = 'https://generativelanguage.googleapis.com/v1beta';
const TEXT_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash';
const TEXT_FALLBACK = Deno.env.get('GEMINI_FALLBACK_MODEL') ?? 'gemini-3.5-flash-lite';
const IMAGE_MODEL = Deno.env.get('GEMINI_IMAGE_MODEL') ?? 'gemini-3.1-flash-image';
const PROJECT_COST = 15;
const IMAGE_COST = 2; // per scene image, subscribers only. Must match IMAGE_COST in src/services/credits.ts


const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

async function callGemini(key: string, model: string, body: unknown, timeoutMs: number) {
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
async function generateText(key: string, prompt: string, schema: unknown, allowBackup = false, check: (raw: unknown) => unknown = (r) => r) {
  const started = Date.now();
  let last: GeminiError = new GeminiError('other', 0);
  for (const model of [TEXT_MODEL, TEXT_FALLBACK]) {
    const left = 140_000 - (Date.now() - started);
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
      const left = 140_000 - (Date.now() - started);
      if (left < 15_000) break;
      const out = await backupText(bk, MASTER_PROMPT, prompt, schema, left - 5_000).catch(() => null);
      if (!out) continue;
      try { return check(out); } catch (e) { console.error('backup llm invalid', bk.model, e instanceof Error ? e.message : e); }
    }
  }
  throw last;
}

const b64 = (u: Uint8Array) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const user = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: auth } = await user.auth.getUser();
  if (!auth.user) return json({ error: 'Veuillez vous reconnecter.' }, 401);
  const uid = auth.user.id;
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let body: { action?: string; project_id?: string; phase?: PhaseKey; idea?: string; choice?: number; feedback?: string; key?: string; scene?: number };
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

  // ---------- Scene image (user's key only) ----------
  if (action === 'image') {
    if (!project) return json({ error: 'Projet introuvable' }, 404);
    const images = project.data.images as { scene_number: number; prompt: string; style: string; location_environment: string }[] | undefined;
    const scene = images?.find((s) => s.scene_number === Number(body.scene));
    if (!scene) return json({ error: 'Générez d’abord les prompts image.' }, 400);
    const { data: profile } = await user.from('profiles').select('plan, credit_balance').eq('id', uid).single();
    if (!profile || profile.plan === 'free') return json({ error: 'La génération d’images est incluse dans les abonnements Creator et Studio.', code: 'plan_required' }, 402);
    if (profile.credit_balance < IMAGE_COST) return json({ error: 'Not enough Story Credits.' }, 402);

    const files: Record<string, string> = { ...(project.data.image_files ?? {}) };
    const parts: unknown[] = [{ text: `Image verticale 9:16. ${scene.style}. Lieu : ${scene.location_environment}. ${scene.prompt}\nAucun texte, aucune légende, aucun filigrane.${files['1'] && scene.scene_number !== 1 ? '\nGarde exactement les mêmes personnages (forme, couleurs, vêtements, accessoires) que sur l’image de référence.' : ''}` }];
    if (files['1'] && scene.scene_number !== 1) {
      const { data: ref } = await admin.storage.from('renders').download(files['1']);
      if (ref) parts.push({ inlineData: { mimeType: ref.type || 'image/png', data: b64(new Uint8Array(await ref.arrayBuffer())) } });
    }
    try {
      let bytes: Uint8Array | null = null;
      // 1) Gemini on Storyit's key (best quality, keeps the characters with the reference image).
      try {
        const out = await callGemini(Deno.env.get('GEMINI_API_KEY') ?? '', IMAGE_MODEL, { contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '9:16' } } }, 90_000);
        const img = out?.candidates?.[0]?.content?.parts?.find((p: { inlineData?: { data: string } }) => p.inlineData)?.inlineData;
        if (img?.data) bytes = unb64(img.data);
      } catch (e) { console.error('image gemini', e instanceof GeminiError ? e.problem : e); }
      // (A free FLUX backup was tested: watermark, characters missing, 1 image / 45 s per server IP. Not good enough.)
      if (!bytes) throw new Error('La génération d’image est momentanément indisponible. Utilisez « Ouvrir dans Gemini » sur la scène, ou réessayez plus tard.');
      const ext = bytes[0] === 0xff ? 'jpg' : 'png';
      const path = `${uid}/prompts/${project.id}/scene-${String(scene.scene_number).padStart(2, '0')}-${Date.now()}.${ext}`;
      const up = await admin.storage.from('renders').upload(path, bytes, { contentType: ext === 'jpg' ? 'image/jpeg' : 'image/png' });
      if (up.error) throw new Error('Impossible d’enregistrer l’image.');
      const old = files[String(scene.scene_number)];
      files[String(scene.scene_number)] = path;
      const saved = await admin.from('prompt_projects').update({ data: { ...project.data, image_files: files }, updated_at: new Date().toISOString() }).eq('id', project.id).eq('user_id', uid).select('*').single();
      if (saved.error) throw new Error('Impossible d’enregistrer le projet.');
      if (old) await admin.storage.from('renders').remove([old]);
      await user.rpc('consume_credits', { p_amount: IMAGE_COST, p_story_id: null, p_description: `Prompt Studio — image scène ${scene.scene_number}` });
      return json({ project: saved.data });
    } catch (e) {
      return json({ error: `${e instanceof Error ? e.message : 'Échec de la génération'} Aucun crédit n’a été utilisé.` }, 502);
    }
  }

  // ---------- Text phases ----------
  if (action !== 'phase') return json({ error: 'Action inconnue' }, 400);
  const phase = body.phase;
  if (!phase || !(phase in PHASES)) return json({ error: 'Étape inconnue' }, 400);
  if (!project && phase !== 'concepts') return json({ error: 'Commencez par les concepts' }, 400);

  const ownKey = await userKey();
  const billable = !ownKey && !project; // only a brand-new project is charged
  if (billable) {
    const { data: profile } = await user.from('profiles').select('credit_balance').eq('id', uid).single();
    if (!profile || profile.credit_balance < PROJECT_COST) return json({ error: 'Not enough Story Credits.' }, 402);
  }

  const data: Record<string, any> = { ...(project?.data ?? {}) };
  if (phase === 'script') {
    if (typeof body.choice !== 'number' || !data.concepts?.[body.choice]) return json({ error: 'Choisissez un concept' }, 400);
    data.chosen = body.choice;
  }
  if (PHASES[phase].requires.some((k) => data[k] === undefined)) return json({ error: 'Validez d’abord l’étape précédente' }, 400);

  const idea = String(body.idea ?? project?.idea ?? '').trim().slice(0, 600);
  try {
    const phasePrompt = buildPhasePrompt(phase, { ...data, idea, feedback: String(body.feedback ?? '').slice(0, 600) });
    const valid = (r: unknown) => normalizePhase(phase, r);
    let raw;
    if (ownKey) {
      // The user's key first (their quota). If Google refuses it (no billing, quota, overload), the user still gets their
      // story: Storyit's own chain takes over at no cost to them (free tiers / backup providers).
      try { raw = await generateText(ownKey, phasePrompt, PHASES[phase].schema, false, valid); } catch (e) {
        const g = e instanceof GeminiError ? e : null;
        if (g?.problem === 'blocked') throw e;
        if (g?.problem === 'invalid' || g?.problem === 'no_billing') await flag(g.problem, g.message);
        raw = await generateText(Deno.env.get('GEMINI_API_KEY') ?? '', phasePrompt, PHASES[phase].schema, true, valid);
      }
    } else {
      raw = await generateText(Deno.env.get('GEMINI_API_KEY') ?? '', phasePrompt, PHASES[phase].schema, true, valid);
    }
    data[PHASES[phase].key] = raw; // already normalized and checked by `valid`
    for (const later of PHASES[phase].invalidates) delete data[later];
    if (phase === 'concepts' || phase === 'script' || phase === 'images') delete data.image_files; // images no longer match

    const concept = data.concepts?.[Number(data.chosen ?? 0)];
    const row = { user_id: uid, data, idea: idea || null, phase: PHASES[phase].number, title: concept?.title ?? 'Nouveau projet', updated_at: new Date().toISOString() };
    const saved = project
      ? await admin.from('prompt_projects').update(row).eq('id', project.id).eq('user_id', uid).select('*').single()
      : await admin.from('prompt_projects').insert(row).select('*').single();
    if (saved.error) throw new Error('Impossible d’enregistrer le projet');

    // Text works on Google's free tier too, so a text success says nothing about image billing: status unchanged.
    if (billable) await user.rpc('consume_credits', { p_amount: PROJECT_COST, p_story_id: null, p_description: 'Prompt Studio — new project' });
    return json({ project: saved.data, billed_to: ownKey ? 'your_gemini_key' : billable ? 'storyit_credits' : 'included' });
  } catch (e) {
    const g = e instanceof GeminiError ? e : null;
    const msg = g ? (g.problem === 'no_billing' || g.problem === 'quota' ? 'Le service de génération est très demandé en ce moment. Réessayez dans quelques minutes.' : g.message)
      : (e instanceof Error ? e.message : 'Échec de la génération');
    console.error('prompts', phase, msg);
    return json({ error: `${msg} Aucun crédit Storyit n’a été utilisé.` }, 502);
  }
});
