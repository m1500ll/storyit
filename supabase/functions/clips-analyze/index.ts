// Supabase Edge Function: `clips-analyze` (AI clipping, ported from Clipit)
// Sends a clip project's audio track to Google Gemini, which returns the best moments to clip
// (start/end, title, hook, virality score, timed captions). Saves them as clips and charges
// CLIP_CREDITS_PER_MINUTE Story Credits per started minute of source video, only after success.
// Secrets: GEMINI_API_KEY. Optional: GEMINI_CLIPS_MODEL, GEMINI_CLIPS_FALLBACK_MODEL.
// Single file on purpose so it can be pasted into the Supabase dashboard editor.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';

const MODEL = Deno.env.get('GEMINI_CLIPS_MODEL') ?? 'gemini-3.8-flash';
// models that exist on this key (checked Nov 22 2026 with llm-health?gemini_models=1): tried in this order
const FALLBACK_MODELS = (Deno.env.get('GEMINI_CLIPS_FALLBACK_MODEL') ?? 'gemini-3.7-flash,gemini-3.5-flash').split(',').map((m) => m.trim()).filter(Boolean);
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

interface RawClip { start: number; end: number; title: string; hook: string; reason: string; score: number; captions: { start: number; end: number; text: string }[]; keywords?: string[]; reactions?: { start: number; end: number; text: string }[] }

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
          title: { type: 'STRING', description: 'TikTok clipper title: one sentence telling the moment, 40-90 characters, 1-2 key words in CAPITALS, ends with 1-2 emojis, no hashtags' },
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
          keywords: { type: 'ARRAY', description: '3 to 8 punchy words actually spoken in the clip, to show in colour', items: { type: 'STRING' } },
          reactions: {
            type: 'ARRAY',
            description: 'Moments inside the clip where nobody speaks but something happens (laughter, scream, gasp, long awkward silence)',
            items: { type: 'OBJECT', properties: { start: { type: 'NUMBER' }, end: { type: 'NUMBER' }, text: { type: 'STRING' } }, required: ['start', 'end', 'text'] },
          },
        },
        required: ['start', 'end', 'title', 'hook', 'reason', 'score', 'captions', 'keywords', 'reactions'],
      },
    },
  },
  required: ['clips'],
};

/** Second try when Google blocks the answer (RECITATION: the audio contains a song or a copyrighted trailer and the
 *  verbatim transcript quotes its lyrics): the same moments without any transcript. Captions come from Whisper anyway. */
const lightSchema = (() => {
  const items = structuredClone((schema.properties.clips as any).items);
  delete items.properties.captions;
  items.properties.hook = { type: 'STRING', description: 'What happens at the start of the clip, in your own words (never quote lyrics)' };
  items.properties.keywords = { type: 'ARRAY', description: '3 to 8 punchy words spoken by the people in the clip (never song lyrics)', items: { type: 'STRING' } };
  items.required = ['start', 'end', 'title', 'hook', 'reason', 'score', 'keywords', 'reactions'];
  return { type: 'OBJECT', properties: { clips: { type: 'ARRAY', items } }, required: ['clips'] };
})();
/** the answer was blocked by Google's filters (not a temporary failure): switch to the light request */
class BlockedAnswerError extends Error {
  constructor(public reason: string) { super(`Gemini blocked the answer (${reason})`); }
}

class GeminiHttpError extends Error {
  constructor(public status: number, body: string) { super(`Gemini error ${status}: ${body.slice(0, 300)}`); }
}

/** Gemini answered without text (safety filter, recitation, token limit…): worth another try / the fallback model */
class EmptyAnswerError extends Error {
  constructor(public reason: string) { super(`Gemini returned an empty response (${reason})`); }
}
// commentary of games, films or streams talks about weapons, fights and insults: only block what is really harmful
const SAFETY = ['HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_HATE_SPEECH', 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'HARM_CATEGORY_DANGEROUS_CONTENT']
  .map((category) => ({ category, threshold: 'BLOCK_ONLY_HIGH' }));

async function requestGemini(model: string, prompt: string, audioB64: string, key: string, timeoutMs: number, responseSchema: unknown = schema): Promise<{ clips: RawClip[] }> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ inline_data: { mime_type: 'audio/mp3', data: audioB64 } }, { text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema, temperature: 0.4, maxOutputTokens: 65536 },
      safetySettings: SAFETY,
    }),
  });
  if (!res.ok) throw new GeminiHttpError(res.status, await res.text());
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('');
  if (!text) {
    const reason = String(data?.promptFeedback?.blockReason ?? data?.candidates?.[0]?.finishReason ?? 'no candidate');
    console.warn(JSON.stringify({ audit: 'gemini_empty', model, reason }));
    throw new EmptyAnswerError(reason);
  }
  return JSON.parse(text);
}

/** Retries transient errors with backoff, then tries the fallback model. */
async function callGemini(prompt: string, audioB64: string, responseSchema: unknown = schema): Promise<{ clips: RawClip[] }> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY secret is not set');
  const models = [MODEL, ...FALLBACK_MODELS.filter((m) => m !== 'none' && m !== MODEL)];
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  let lastError: unknown;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining < 15_000) break;
      try {
        return await requestGemini(model, prompt, audioB64, key, Math.min(REQUEST_TIMEOUT_MS, remaining), responseSchema);
      } catch (e) {
        lastError = e;
        const timedOut = e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError');
        const retryable = timedOut || e instanceof EmptyAnswerError || (e instanceof GeminiHttpError ? RETRYABLE.has(e.status) : e instanceof SyntaxError);
        if (!retryable) {
          if (e instanceof GeminiHttpError && e.status === 404) break; // a model that does not exist: next one
          throw e;
        }
        console.warn(`Gemini ${model} attempt ${attempt + 1} failed:`, e instanceof Error ? e.message : e);
        if (e instanceof EmptyAnswerError && /SAFETY|PROHIBITED|BLOCK|RECITATION/i.test(e.reason)) throw new BlockedAnswerError(e.reason);
        await sleep(1500 * 2 ** attempt);
      }
    }
  }
  const transient = lastError === undefined || lastError instanceof DOMException
    || (lastError instanceof GeminiHttpError && RETRYABLE.has(lastError.status));
  if (transient) throw new Error('L’IA est très demandée en ce moment. Réessayez dans une minute.');
  if (lastError instanceof EmptyAnswerError) {
    throw new Error(/SAFETY|PROHIBITED|BLOCK|RECITATION/i.test(lastError.reason)
      ? `L’IA n’a pas pu analyser cette vidéo : son contenu a été bloqué par le filtre de Google (${lastError.reason}). Essaie avec une autre vidéo.`
      : `L’IA n’a pas réussi à analyser cette vidéo (${lastError.reason}). Réessaie dans un instant.`);
  }
  if (lastError instanceof GeminiHttpError && lastError.status === 404) {
    console.error('clips-analyze: no model available', lastError.message);
    throw new Error('L’analyse est momentanément indisponible. Réessaie dans quelques minutes.');
  }
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
      keywords: (Array.isArray(c.keywords) ? c.keywords : []).map((k) => String(k).trim()).filter(Boolean).slice(0, 10),
      reactions: (Array.isArray(c.reactions) ? c.reactions : [])
        .map((k) => ({ start: round2(num(k.start)), end: round2(num(k.end)), text: String(k.text ?? '').trim().toLocaleUpperCase().replace(/^\*?(.*?)\*?$/, '*$1*').slice(0, 30) }))
        .filter((k) => k.text.length > 2 && k.end > k.start && k.start >= start - 1 && k.end <= end + 1),
    });
  }
  return out.slice(0, 10);
}


// ---------- Word-accurate captions (OpenAI speech-to-text, word timestamps) ----------

interface Word { w: string; s: number; e: number }

/** The MP3 frames of the browser's audio (MPEG-2 layer III, 16 kHz, constant bitrate: 576 samples a frame), so a
 *  short piece around a clip can be cut out without decoding. `info`: the first frame is LAME's silent Info/Xing frame. */
function mp3Frames(b: Uint8Array) {
  const at: number[] = [];
  let i = b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33 ? 10 + ((b[6] << 21) | (b[7] << 14) | (b[8] << 7) | b[9]) : 0; // skip an ID3 tag
  const RATES = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  while (i < b.length - 4) {
    if (b[i] === 0xff && (b[i + 1] & 0xe0) === 0xe0 && ((b[i + 1] >> 3) & 3) === 2 && ((b[i + 1] >> 1) & 3) === 1 && ((b[i + 2] >> 2) & 3) === 2) {
      const kbps = RATES[(b[i + 2] >> 4) & 15] ?? 0;
      const len = Math.floor((72 * kbps * 1000) / 16000) + ((b[i + 2] >> 1) & 1);
      if (len < 8) { i++; continue; }
      at.push(i); i += len;
    } else i++;
  }
  const head = at.length ? new TextDecoder().decode(b.subarray(at[0], at[0] + 60)) : '';
  return { at, info: /Info|Xing/.test(head) };
}

/** The piece of audio covering [start, end] (seconds) and where it starts in the whole audio. Measured offline with
 *  ffmpeg: a piece cut at frame k decodes from ((k − 1) × 576 − 1105) / 16 000 s, k counted from the Info frame (checked to the millisecond). */
function audioSlice(b: Uint8Array, f: ReturnType<typeof mp3Frames>, start: number, end: number) {
  const base = f.info ? 0 : 1;
  const k0 = Math.max(f.info ? 1 : 0, Math.floor((start * 16000) / 576) + 1 - base);
  const k1 = Math.min(f.at.length - 1, Math.ceil((end * 16000) / 576) + 2 - base);
  if (k1 - k0 < 20) return null;
  return { bytes: b.slice(f.at[k0], f.at[k1]), offset: ((k0 + base - 1) * 576 - 1105) / 16000 };
}

/** every spoken word with its own start/end (seconds), or null if the transcription is unavailable */
async function transcribeWords(bytes: Uint8Array, timeoutMs = 110_000): Promise<Word[] | null> {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) return null;
  try {
    const fd = new FormData();
    fd.append('file', new Blob([bytes], { type: 'audio/mpeg' }), 'audio.mp3');
    fd.append('model', 'whisper-1');
    fd.append('response_format', 'verbose_json');
    fd.append('timestamp_granularities[]', 'word');
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) { console.error('transcribe', res.status, (await res.text()).slice(0, 200)); return null; }
    const d = await res.json();
    const words = (d.words ?? []).map((x: any) => ({ w: String(x.word ?? '').trim(), s: num(x.start), e: num(x.end) })).filter((x: Word) => x.w && x.e >= x.s);
    return words.length ? words : null;
  } catch (e) { console.error('transcribe', e instanceof Error ? e.message : e); return null; }
}

/** caption chunks (1 to 3 words, cut on punctuation and pauses) built from the real word timings, each with its words */
function chunksFromWords(words: Word[], start: number, end: number) {
  const inside = words.filter((w) => w.e > start - 0.05 && w.s < end + 0.05);
  const out: { start: number; end: number; text: string; words: { s: number; e: number; w: string }[] }[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (!cur.length) return;
    out.push({ start: round2(cur[0].s), end: round2(cur[cur.length - 1].e), text: cur.map((w) => w.w).join(' '), words: cur.map((w) => ({ s: round2(w.s), e: round2(w.e), w: w.w })) });
    cur = [];
  };
  for (let i = 0; i < inside.length; i++) {
    const w = inside[i];
    if (cur.length && (cur.length >= 3 || w.s - cur[cur.length - 1].e > 0.35 || cur.map((x) => x.w).join(' ').length + w.w.length > 18)) flush();
    cur.push(w);
    if (/[.!?,;:…]$/.test(w.w)) flush();
  }
  flush();
  // a caption stays on screen until the next one starts (no flicker between chunks)
  for (let i = 0; i < out.length - 1; i++) if (out[i + 1].start - out[i].end < 0.25) out[i].end = out[i + 1].start;
  return out;
}

const norm = (w: string) => w.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]/gu, '');

/** flags the key words (shown in colour); without word timings, the keyword chunks are left as they are */
function markKeywords(captions: any[], keywords: string[]) {
  const keys = new Set(keywords.flatMap((k) => k.split(/\s+/)).map(norm).filter((k) => k.length > 1));
  if (!keys.size) return captions;
  return captions.map((c) => (Array.isArray(c.words) ? { ...c, words: c.words.map((w: any) => (keys.has(norm(w.w)) ? { ...w, hi: true } : w)) } : c));
}

/** reaction tags (*LAUGHS*) placed only where nobody speaks */
function withReactions(captions: any[], reactions: { start: number; end: number; text: string }[]) {
  const out = [...captions];
  for (const r of reactions) {
    const free = !captions.some((c) => c.start < r.end && c.end > r.start);
    if (free && r.end - r.start >= 0.4) out.push({ start: r.start, end: Math.min(r.end, r.start + 2.5), text: r.text, action: true });
  }
  return out.sort((a, b) => a.start - b.start);
}

/** clip edges moved onto word boundaries: never start or end in the middle of a word */
function snapToWords(words: Word[], start: number, end: number) {
  const first = words.find((w) => w.e > start + 0.05);
  const last = [...words].reverse().find((w) => w.s < end - 0.05);
  const s = first && Math.abs(first.s - start) < 1.2 ? Math.max(0, first.s - 0.08) : start;
  const e = last && Math.abs(last.e - end) < 1.2 ? last.e + 0.25 : end;
  return e - s > 3 ? { start: round2(s), end: round2(e) } : { start, end };
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

  // Clipping is for subscribers: free accounts are refused, the $1 trial gets ONE video (keep in sync with clipAccess.ts).
  const refuse = async (error: string, code: string) => {
    await admin.storage.from('clip-audio').remove([`${user.id}/${projectId}.mp3`]);
    return json({ error, code }, 403);
  };
  const { data: who } = await admin.from('profiles').select('plan, trial_ends_at, is_admin').eq('id', user.id).single();
  if (!who?.is_admin) {
    if (!who?.plan || who.plan === 'free') {
      return refuse('Le clipping IA est réservé aux abonnés. Choisis une formule pour l’utiliser.', 'subscription_required');
    }
    if (who.trial_ends_at && new Date(who.trial_ends_at).getTime() > Date.now()) {
      const { count } = await admin.from('clip_projects').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).neq('id', projectId).in('status', ['ready', 'analyzing']);
      if ((count ?? 0) >= 1) {
        return refuse('Pendant l’essai, tu peux découper 1 vidéo. Passe à l’abonnement complet pour continuer.', 'trial_limit');
      }
    }
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
- title: written like the top TikTok clipping accounts, in the spoken language: one sentence that tells what happens ("Kai d*ed in Minecraft and was afraid to tell Speed as they LOST 4 hours of progress 😭💔"), 40 to 90 characters, 1 or 2 key words in CAPITALS, 1 or 2 fitting emojis at the end, swear words censored with * (f*ck, d*ed), no hashtags.
- keywords: 3 to 8 punchy words actually said in the clip (names, numbers, strong words) that deserve to be shown in colour.
- reactions: when nobody talks but something happens (laughs, screams, gasps, an awkward silence), a 1 to 3 word tag in CAPITALS in the spoken language, between asterisks, like *LAUGHS* or *SHOCKED*. Empty if none.
- score: honest 0-100 estimate of how well the clip would perform.`;

    const startedAt = Date.now();
    // the AI picks the moments; the captions come from a speech-to-text with real word timings (in parallel)
    const b64 = encodeBase64(bytes);
    const analyse = async () => {
      try { return await callGemini(prompt, b64); }
      catch (e) {
        if (!(e instanceof BlockedAnswerError)) throw e;
        console.warn(JSON.stringify({ audit: 'clips_blocked_retry_light', reason: e.reason }));
        const light = prompt.replace(/^- captions:.*$/m, '- The audio may contain songs, a film or a game trailer: NEVER transcribe or quote lyrics, music or any copyrighted text. Describe moments in your own words; keywords are only words said by the people talking.');
        try { return await callGemini(light, b64, lightSchema); }
        catch (e2) {
          if (e2 instanceof BlockedAnswerError) throw new Error(`L’IA n’a pas pu analyser cette vidéo : Google bloque son contenu (${e2.reason}, souvent une musique ou une bande-annonce protégée). Essaie avec un passage sans musique.`);
          throw e2;
        }
      }
    };
    const [out, words] = await Promise.all([analyse(), transcribeWords(bytes)]);
    let clips = cleanClips(Array.isArray(out?.clips) ? out.clips : [], duration, [min, max]);
    // Whisper drifts on long audio: each clip is transcribed again on its own short piece (a few seconds of margin),
    // which gives word timings accurate to a few hundredths of a second. Falls back on the whole-file words.
    if (words && Date.now() - startedAt < 75_000) {
      const frames = mp3Frames(bytes);
      const pieces = await Promise.all(clips.map(async (c) => {
        const sl = frames.at.length ? audioSlice(bytes, frames, Math.max(0, c.start - 3), Math.min(duration, c.end + 3)) : null;
        if (!sl) return null;
        const w = await transcribeWords(sl.bytes, 40_000);
        return w ? w.map((x) => ({ ...x, s: round2(x.s + sl.offset), e: round2(x.e + sl.offset) })) : null;
      }));
      clips.forEach((c, i) => {
        const p = pieces[i];
        if (!p) return;
        const lo = Math.max(0, c.start - 2.5), hi = c.end + 2.5;
        const inside = p.filter((x) => x.s >= lo && x.e <= hi);
        const outside = words.filter((x) => x.e < lo || x.s > hi);
        words.splice(0, words.length, ...[...outside, ...inside].sort((a, b) => a.s - b.s));
      });
    }
    if (words) clips = clips.map((c) => { const b = snapToWords(words, c.start, Math.min(duration, c.end)); return { ...c, ...b, end: Math.min(duration, b.end), captions: chunksFromWords(words, b.start, Math.min(duration, b.end)) as RawClip['captions'] }; });
    clips = clips.map((c) => ({ ...c, captions: withReactions(markKeywords(c.captions, c.keywords ?? []), c.reactions ?? []) }));
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
