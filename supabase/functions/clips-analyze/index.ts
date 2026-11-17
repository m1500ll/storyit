// Supabase Edge Function: `clips-analyze` (AI clipping, ported from Clipit)
// Sends a clip project's audio track to Google Gemini, which returns the best moments to clip
// (start/end, title, hook, virality score, timed captions). Saves them as clips and charges
// CLIP_CREDITS_PER_MINUTE Story Credits per started minute of source video, only after success.
// Secrets: GEMINI_API_KEY. Optional: GEMINI_CLIPS_MODEL, GEMINI_CLIPS_FALLBACK_MODEL.
// Single file on purpose so it can be pasted into the Supabase dashboard editor.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';

const MODEL = Deno.env.get('GEMINI_CLIPS_MODEL') ?? 'gemini-3.8-flash';
const FALLBACK_MODEL = Deno.env.get('GEMINI_CLIPS_FALLBACK_MODEL') ?? 'gemini-3.8-flash-lite';
const RETRYABLE = new Set([429, 500, 503, 504]);
// Supabase stops a function after ~150 s (free plan): stay below it.
const TOTAL_BUDGET_MS = 120_000;
const REQUEST_TIMEOUT_MS = 90_000;
const MAX_SECONDS = 30 * 60 + 30; // keep in sync with MAX_SOURCE_SECONDS in src/types/domain.ts
const AUDIO_BITRATE = 24_000; // bits/s, set by the browser when extracting audio
const LENGTHS = { short: [15, 30], medium: [30, 60], long: [60, 90] } as const;
/** keep in sync with CREDIT_COSTS.clipMinute in src/services/credits.ts */
const CLIP_CREDITS_PER_MINUTE = 100;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// ---------- Gemini ----------

interface RawClip { start: number; end: number; title: string; hook: string; reason: string; score: number; captions: { start: number; end: number; text: string }[] }

const schema = {
  type: 'OBJECT',
  properties: {
    clips: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          start: { type: 'NUMBER', description: 'Clip start, seconds from the beginning of the audio' },
          end: { type: 'NUMBER', description: 'Clip end, seconds from the beginning of the audio' },
          title: { type: 'STRING', description: 'Scroll-stopping title, max 60 characters, no hashtags' },
          hook: { type: 'STRING', description: 'The opening line of the clip, verbatim' },
          reason: { type: 'STRING', description: 'One sentence: why this moment will perform' },
          score: { type: 'INTEGER', description: 'Virality potential 0-100' },
          captions: {
            type: 'ARRAY',
            description: 'Verbatim transcript of the clip split into chunks of 1 to 4 words, in order',
            items: {
              type: 'OBJECT',
              properties: { start: { type: 'NUMBER' }, end: { type: 'NUMBER' }, text: { type: 'STRING' } },
              required: ['start', 'end', 'text'],
            },
          },
        },
        required: ['start', 'end', 'title', 'hook', 'reason', 'score', 'captions'],
      },
    },
  },
  required: ['clips'],
};

class GeminiHttpError extends Error {
  constructor(public status: number, body: string) { super(`Gemini error ${status}: ${body.slice(0, 300)}`); }
}

async function requestGemini(model: string, prompt: string, audioB64: string, key: string, timeoutMs: number): Promise<{ clips: RawClip[] }> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ inline_data: { mime_type: 'audio/mp3', data: audioB64 } }, { text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.4 },
    }),
  });
  if (!res.ok) throw new GeminiHttpError(res.status, await res.text());
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('');
  if (!text) throw new Error('Gemini returned an empty response');
  return JSON.parse(text);
}

/** Retries transient errors with backoff, then tries the fallback model. */
async function callGemini(prompt: string, audioB64: string): Promise<{ clips: RawClip[] }> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY secret is not set');
  const models = FALLBACK_MODEL && FALLBACK_MODEL !== 'none' && FALLBACK_MODEL !== MODEL ? [MODEL, FALLBACK_MODEL] : [MODEL];
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  let lastError: unknown;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining < 15_000) break;
      try {
        return await requestGemini(model, prompt, audioB64, key, Math.min(REQUEST_TIMEOUT_MS, remaining));
      } catch (e) {
        lastError = e;
        const timedOut = e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError');
        const retryable = timedOut || (e instanceof GeminiHttpError ? RETRYABLE.has(e.status) : e instanceof SyntaxError);
        if (!retryable) {
          if (model !== MODEL && e instanceof GeminiHttpError && e.status === 404) break;
          throw e;
        }
        console.warn(`Gemini ${model} attempt ${attempt + 1} failed:`, e instanceof Error ? e.message : e);
        await sleep(1500 * 2 ** attempt);
      }
    }
  }
  const transient = lastError === undefined || lastError instanceof DOMException
    || (lastError instanceof GeminiHttpError && RETRYABLE.has(lastError.status));
  if (transient) throw new Error('L’IA est très demandée en ce moment. Réessayez dans une minute.');
  if (lastError instanceof GeminiHttpError && [401, 402, 403].includes(lastError.status)) {
    console.error('clips-analyze billing/key', lastError.message);
    throw new Error('L’analyse est momentanément indisponible. Réessayez un peu plus tard.');
  }
  throw lastError;
}

const num = (v: unknown, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Keeps clips inside the video, at a sensible length, non-overlapping, best first. */
function cleanClips(raw: RawClip[], duration: number, [min, max]: readonly [number, number]) {
  const out: RawClip[] = [];
  for (const c of [...raw].sort((a, b) => num(b.score) - num(a.score))) {
    const start = Math.max(0, num(c.start));
    let end = Math.min(duration, num(c.end));
    if (end - start > max * 1.25) end = start + max;
    if (end - start < Math.min(min * 0.5, duration * 0.9) || end <= start) continue;
    if (out.some((o) => start < o.end - 2 && end > o.start + 2)) continue; // overlaps a better clip
    const captions = (Array.isArray(c.captions) ? c.captions : [])
      .map((k) => ({ start: round2(num(k.start)), end: round2(num(k.end)), text: String(k.text ?? '').trim().slice(0, 80) }))
      .filter((k) => k.text && k.end > k.start && k.end > start - 1 && k.start < end + 1);
    out.push({
      start: round2(start), end: round2(end), captions,
      title: String(c.title ?? '').trim().slice(0, 100) || 'Clip sans titre',
      hook: String(c.hook ?? '').trim().slice(0, 300),
      reason: String(c.reason ?? '').trim().slice(0, 300),
      score: Math.round(Math.min(100, Math.max(0, num(c.score, 50)))),
    });
  }
  return out.slice(0, 10);
}

// ---------- Handler ----------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: auth } = await userClient.auth.getUser();
  const user = auth.user;
  if (!user) return json({ error: 'Veuillez vous reconnecter.' }, 401);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let projectId: string;
  try { projectId = String((await req.json()).projectId ?? ''); } catch { return json({ error: 'Invalid JSON body' }, 400); }

  const { data: project } = await admin.from('clip_projects').select('*').eq('id', projectId).eq('user_id', user.id).maybeSingle();
  if (!project) return json({ error: 'Projet introuvable.' }, 404);
  if (project.status === 'ready') return json({ ok: true });
  if (project.status === 'analyzing' && Date.now() - new Date(project.updated_at).getTime() < 3 * 60_000) {
    return json({ error: 'Cette vidéo est déjà en cours d’analyse.' }, 409);
  }

  const audioPath = `${user.id}/${projectId}.mp3`;
  const fail = async (message: string, status = 502) => {
    await admin.from('clip_projects').update({ status: 'failed', error_message: message }).eq('id', projectId);
    await admin.storage.from('clip-audio').remove([audioPath]); // a retry uploads it again
    return json({ error: message }, status);
  };

  const { data: audio, error: dlError } = await admin.storage.from('clip-audio').download(audioPath);
  if (dlError || !audio) return fail('Le son de la vidéo n’a pas été reçu. Réessayez : aucun crédit n’a été utilisé.', 400);
  const bytes = new Uint8Array(await audio.arrayBuffer());

  // Bill on the real audio length (constant bitrate), not on what the browser claims.
  const duration = Math.max(num(project.duration_seconds), (bytes.length * 8) / AUDIO_BITRATE * 0.97);
  if (duration > MAX_SECONDS) return fail('Les vidéos sont limitées à 30 minutes pour l’instant. Raccourcissez-la et réessayez : aucun crédit n’a été utilisé.', 400);
  const cost = Math.max(1, Math.ceil(duration / 60)) * CLIP_CREDITS_PER_MINUTE;

  const { data: profile } = await admin.from('profiles').select('credit_balance').eq('id', user.id).single();
  if (!profile || profile.credit_balance < cost) {
    return fail(`Crédits insuffisants : cette vidéo demande ${cost} crédits. Aucun crédit n’a été utilisé.`, 402);
  }

  await admin.from('clip_projects').update({ status: 'analyzing', error_message: null }).eq('id', projectId);

  try {
    const [min, max] = LENGTHS[project.clip_length as keyof typeof LENGTHS] ?? LENGTHS.medium;
    const target = Math.min(8, Math.max(2, Math.round(duration / 180) + 2));
    const prompt = `You are a senior short-form video editor (TikTok, YouTube Shorts, Reels).
The audio track of a ${Math.round(duration)}-second video is attached. Find the ${target} best self-contained moments to post as vertical shorts.

Rules:
- Each clip lasts between ${min} and ${max} seconds and makes sense without context.
- Start on a strong hook (a bold claim, a question, a surprise, an emotional line). Never start mid-sentence; end on a complete thought or punchline.
- Clips must not overlap. Prefer fewer, better clips over weak ones (return fewer than ${target} if the content is thin).
- Timestamps are seconds from the start of the audio, with decimals, and must be accurate to ±0.3 s.
- captions: verbatim transcript of everything said inside the clip, in the spoken language, split into consecutive chunks of 1 to 4 words with their own start/end timestamps. Keep the speaker's words; fix only obvious transcription errors.
- title: catchy, max 60 characters, in the spoken language.
- score: honest 0-100 estimate of how well the clip would perform.`;

    const out = await callGemini(prompt, encodeBase64(bytes));
    const clips = cleanClips(Array.isArray(out?.clips) ? out.clips : [], duration, [min, max]);
    if (clips.length === 0) throw new Error('L’IA n’a pas trouvé de moment clair à découper (y a-t-il de la parole dans cette vidéo ?)');

    await admin.from('clips').delete().eq('project_id', projectId);
    const { error: insertError } = await admin.from('clips').insert(clips.map((c, i) => ({
      project_id: projectId, user_id: user.id, position: i + 1,
      start_s: c.start, end_s: c.end, title: c.title, hook: c.hook, reason: c.reason, score: c.score, captions: c.captions,
    })));
    if (insertError) throw new Error(insertError.message);

    // Charge only after success.
    const { error: chargeError } = await admin.rpc('charge_credits', {
      p_user_id: user.id, p_amount: cost, p_clip_project_id: projectId, p_description: `Clips IA — ${project.title}`.slice(0, 120),
    });
    if (chargeError) {
      await admin.from('clips').delete().eq('project_id', projectId);
      return fail(`Crédits insuffisants : cette vidéo demande ${cost} crédits. Aucun crédit n’a été utilisé.`, 402);
    }

    await admin.from('clip_projects').update({ status: 'ready', error_message: null }).eq('id', projectId);
    await admin.storage.from('clip-audio').remove([audioPath]);
    return json({ ok: true, clips: clips.length, cost });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : 'L’analyse a échoué';
    return fail(`${message.replace(/[.!?]?$/, '.')} Aucun crédit n’a été utilisé.`);
  }
});
