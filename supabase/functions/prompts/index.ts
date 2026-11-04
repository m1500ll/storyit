// Supabase Edge Function: `prompts` — Prompt Studio + bring-your-own Gemini key.
// - Phases (concepts → script → image JSON → video JSON → pack): the master prompt never leaves the server.
//   With the user's own Gemini key they run on the user's Google account and cost no Storyit credits;
//   otherwise they use Storyit's key and cost 1 credit each (charged only on success).
// - Scene images: generated with the user's key only (Google bills the user), stored privately in `renders`.
// - Keys: AES-GCM encrypted (TOKEN_ENCRYPTION_KEY), never returned to the browser.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { MASTER_PROMPT, PHASES, buildPhasePrompt, normalizePhase, type PhaseKey } from '../_shared/promptStudio.ts';
import { classifyGeminiError, GeminiError, KEY_MESSAGES, keyHint, looksLikeGeminiKey } from '../_shared/geminiKey.ts';
import { decrypt, encrypt } from '../_shared/social.ts';

const API = 'https://generativelanguage.googleapis.com/v1beta';
const TEXT_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash';
const TEXT_FALLBACK = Deno.env.get('GEMINI_FALLBACK_MODEL') ?? 'gemini-3.5-flash-lite';
const IMAGE_MODEL = Deno.env.get('GEMINI_IMAGE_MODEL') ?? 'gemini-3.1-flash-image';
const COST = 1;

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
  if (!res.ok) throw new GeminiError(classifyGeminiError(res.status, await res.text()), res.status);
  return await res.json();
}

/** Text phase: one long attempt on the main model, then the fallback; stays under the Edge Function limit. */
async function generateText(key: string, prompt: string, schema: unknown) {
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
      return JSON.parse(text);
    } catch (e) {
      last = e instanceof GeminiError ? e : new GeminiError('other', 0);
      if (['invalid', 'no_billing'].includes(last.problem)) break; // switching model won't help
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
  const userKey = async () => { const r = await keyRow(); return r && r.status !== 'invalid' ? decrypt(r.key_enc) : null; };
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
    const key = await userKey();
    if (!key) return json({ error: 'Connectez votre clé Gemini pour générer les images.', code: 'no_key' }, 400);

    const files: Record<string, string> = { ...(project.data.image_files ?? {}) };
    const parts: unknown[] = [{ text: `Image verticale 9:16. ${scene.style}. Lieu : ${scene.location_environment}. ${scene.prompt}\nAucun texte, aucune légende, aucun filigrane.${files['1'] && scene.scene_number !== 1 ? '\nGarde exactement les mêmes personnages (forme, couleurs, vêtements, accessoires) que sur l’image de référence.' : ''}` }];
    if (files['1'] && scene.scene_number !== 1) {
      const { data: ref } = await admin.storage.from('renders').download(files['1']);
      if (ref) parts.push({ inlineData: { mimeType: ref.type || 'image/png', data: b64(new Uint8Array(await ref.arrayBuffer())) } });
    }
    try {
      const out = await callGemini(key, IMAGE_MODEL, { contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '9:16' } } }, 120_000);
      const img = out?.candidates?.[0]?.content?.parts?.find((p: { inlineData?: { data: string } }) => p.inlineData)?.inlineData;
      if (!img?.data) throw new GeminiError('blocked', 200);
      const bytes = unb64(img.data);
      const ext = bytes[0] === 0xff ? 'jpg' : 'png';
      const path = `${uid}/prompts/${project.id}/scene-${String(scene.scene_number).padStart(2, '0')}-${Date.now()}.${ext}`;
      const up = await admin.storage.from('renders').upload(path, bytes, { contentType: ext === 'jpg' ? 'image/jpeg' : 'image/png' });
      if (up.error) throw new Error('Impossible d’enregistrer l’image.');
      const old = files[String(scene.scene_number)];
      files[String(scene.scene_number)] = path;
      const saved = await admin.from('prompt_projects').update({ data: { ...project.data, image_files: files }, updated_at: new Date().toISOString() }).eq('id', project.id).eq('user_id', uid).select('*').single();
      if (saved.error) throw new Error('Impossible d’enregistrer le projet.');
      if (old) await admin.storage.from('renders').remove([old]);
      await flag('valid', null);
      return json({ project: saved.data });
    } catch (e) {
      const g = e instanceof GeminiError ? e : null;
      if (g?.problem === 'invalid' || g?.problem === 'no_billing') await flag(g.problem, g.message);
      return json({ error: g?.message ?? (e instanceof Error ? e.message : 'Échec de la génération'), code: g?.problem }, 502);
    }
  }

  // ---------- Text phases ----------
  if (action !== 'phase') return json({ error: 'Action inconnue' }, 400);
  const phase = body.phase;
  if (!phase || !(phase in PHASES)) return json({ error: 'Étape inconnue' }, 400);
  if (!project && phase !== 'concepts') return json({ error: 'Commencez par les concepts' }, 400);

  const ownKey = await userKey();
  if (!ownKey) {
    const { data: profile } = await user.from('profiles').select('credit_balance').eq('id', uid).single();
    if (!profile || profile.credit_balance < COST) return json({ error: 'Not enough Story Credits.' }, 402);
  }

  const data: Record<string, any> = { ...(project?.data ?? {}) };
  if (phase === 'script') {
    if (typeof body.choice !== 'number' || !data.concepts?.[body.choice]) return json({ error: 'Choisissez un concept' }, 400);
    data.chosen = body.choice;
  }
  if (PHASES[phase].requires.some((k) => data[k] === undefined)) return json({ error: 'Validez d’abord l’étape précédente' }, 400);

  const idea = String(body.idea ?? project?.idea ?? '').trim().slice(0, 600);
  try {
    const raw = await generateText(ownKey ?? Deno.env.get('GEMINI_API_KEY') ?? '', buildPhasePrompt(phase, { ...data, idea, feedback: String(body.feedback ?? '').slice(0, 600) }), PHASES[phase].schema);
    data[PHASES[phase].key] = normalizePhase(phase, raw);
    for (const later of PHASES[phase].invalidates) delete data[later];
    if (phase === 'concepts' || phase === 'script' || phase === 'images') delete data.image_files; // images no longer match

    const concept = data.concepts?.[Number(data.chosen ?? 0)];
    const row = { user_id: uid, data, idea: idea || null, phase: PHASES[phase].number, title: concept?.title ?? 'Nouveau projet', updated_at: new Date().toISOString() };
    const saved = project
      ? await admin.from('prompt_projects').update(row).eq('id', project.id).eq('user_id', uid).select('*').single()
      : await admin.from('prompt_projects').insert(row).select('*').single();
    if (saved.error) throw new Error('Impossible d’enregistrer le projet');

    // Text works on Google's free tier too, so a text success says nothing about image billing: status unchanged.
    if (!ownKey) await user.rpc('consume_credits', { p_amount: COST, p_story_id: null, p_description: `Prompt Studio — ${PHASES[phase].label}` });
    return json({ project: saved.data, billed_to: ownKey ? 'your_gemini_key' : 'storyit_credits' });
  } catch (e) {
    const g = e instanceof GeminiError ? e : null;
    if (ownKey && (g?.problem === 'invalid' || g?.problem === 'no_billing')) await flag(g.problem, g.message);
    const msg = g ? (ownKey ? g.message : g.problem === 'no_billing' || g.problem === 'quota' ? 'Les crédits IA de Storyit sont épuisés pour le moment. Connectez votre propre clé Gemini ou réessayez plus tard.' : g.message)
      : (e instanceof Error ? e.message : 'Échec de la génération');
    console.error('prompts', phase, msg);
    return json({ error: `${msg} Aucun crédit Storyit n’a été utilisé.` }, 502);
  }
});
