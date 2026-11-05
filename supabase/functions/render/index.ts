// Supabase Edge Function: `render`
// Turns each storyboard scene into: keyframe image (Gemini image) -> 9:16 clip (Veo) -> voice-over (Gemini TTS).
// The browser calls `tick` repeatedly; each call advances scenes as far as it can within a time budget,
// so we never hit the Edge Function wall-clock limit even though Veo takes minutes.
//
// Secrets: GEMINI_API_KEY (required). Optional model overrides (Google renames models often):
//   GEMINI_IMAGE_MODEL, VEO_MODEL, GEMINI_TTS_MODEL, TTS_VOICE, RENDER_CREDITS_PER_SCENE
// Voice-over uses ElevenLabs when ELEVENLABS_API_KEY is set (optional: ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL),
// otherwise falls back to Gemini TTS.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const API = 'https://generativelanguage.googleapis.com/v1beta';
const IMAGE_MODEL = Deno.env.get('GEMINI_IMAGE_MODEL') ?? 'gemini-2.5-flash-image';
const VEO_MODEL = Deno.env.get('VEO_MODEL') ?? 'veo-3.0-fast-generate-001';
const TTS_MODEL = Deno.env.get('GEMINI_TTS_MODEL') ?? 'gemini-2.5-flash-preview-tts';
const TTS_VOICE = Deno.env.get('TTS_VOICE') ?? 'Kore';
const ELEVEN_KEY = Deno.env.get('ELEVENLABS_API_KEY');
const ELEVEN_VOICE = Deno.env.get('ELEVENLABS_VOICE_ID') ?? 'jhQTaVBI6hnd0ESpmfIu';
const ELEVEN_MODEL = Deno.env.get('ELEVENLABS_MODEL') ?? 'eleven_multilingual_v2';
const CREDITS_PER_SCENE = Number(Deno.env.get('RENDER_CREDITS_PER_SCENE') ?? 3); // keep in sync with src/services/credits.ts
const BUDGET_MS = 95_000;
const MAX_ATTEMPTS = 3;
const STALE_CLAIM_MS = 3 * 60_000;
const BUCKET = 'renders';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

type Stage = 'pending' | 'image' | 'video_submit' | 'video_wait' | 'audio' | 'done' | 'failed';
interface SceneRow {
  id: string; story_id: string; position: number; title: string; narration: string; dialogue: string | null;
  image_prompt: string; video_prompt: string; duration_seconds: number; stage: Stage; status: string;
  image_path: string | null; video_path: string | null; audio_path: string | null;
  operation: string | null; attempts: number; claimed_at: string | null;
}
interface Character { name: string; species: string; visual_description: string }

// ---------- Google helpers ----------

const key = () => {
  const k = Deno.env.get('GEMINI_API_KEY');
  if (!k) throw new Error('GEMINI_API_KEY secret is not set');
  return k;
};

async function google(path: string, body?: unknown) {
  const res = await fetch(`${API}/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key() },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Google ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

const b64ToBytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
function bytesToB64(bytes: Uint8Array) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Wraps raw 16-bit mono PCM (what Gemini TTS returns) in a WAV header. */
function pcmToWav(pcm: Uint8Array, sampleRate = 24_000) {
  const header = new DataView(new ArrayBuffer(44));
  const write = (o: number, s: string) => [...s].forEach((c, i) => header.setUint8(o + i, c.charCodeAt(0)));
  write(0, 'RIFF'); header.setUint32(4, 36 + pcm.length, true); write(8, 'WAVE');
  write(12, 'fmt '); header.setUint32(16, 16, true); header.setUint16(20, 1, true); header.setUint16(22, 1, true);
  header.setUint32(24, sampleRate, true); header.setUint32(28, sampleRate * 2, true); header.setUint16(32, 2, true); header.setUint16(34, 16, true);
  write(36, 'data'); header.setUint32(40, pcm.length, true);
  const out = new Uint8Array(44 + pcm.length);
  out.set(new Uint8Array(header.buffer), 0); out.set(pcm, 44);
  return out;
}

const characterSheet = (chars: Character[]) =>
  chars.map((c) => `${c.name} (${c.species}): ${c.visual_description}`).join('\n');

async function generateImage(scene: SceneRow, chars: Character[], reference: Uint8Array | null) {
  const parts: unknown[] = [{
    text: `Vertical 9:16 keyframe for a short AI story video. Keep characters EXACTLY consistent with this character sheet${reference ? ' and with the reference image' : ''}:\n${characterSheet(chars)}\n\nScene ${scene.position}: ${scene.image_prompt}\nNo text, no captions, no watermark.`,
  }];
  if (reference) parts.push({ inlineData: { mimeType: 'image/png', data: bytesToB64(reference) } });
  const out = await google(`models/${IMAGE_MODEL}:generateContent`, {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '9:16' } },
  });
  const img = out?.candidates?.[0]?.content?.parts?.find((p: { inlineData?: { data: string } }) => p.inlineData)?.inlineData;
  if (!img?.data) throw new Error('Image model returned no image (it may have been blocked by safety filters)');
  return { bytes: b64ToBytes(img.data), mime: (img.mimeType as string) ?? 'image/png' };
}

async function submitVideo(scene: SceneRow, image: Uint8Array, mime: string) {
  const out = await google(`models/${VEO_MODEL}:predictLongRunning`, {
    instances: [{ prompt: `${scene.video_prompt}. Smooth cinematic motion, characters stay on-model. No text.`, image: { bytesBase64Encoded: bytesToB64(image), mimeType: mime } }],
    parameters: { aspectRatio: '9:16', personGeneration: 'allow_adult' },
  });
  if (!out?.name) throw new Error('Veo did not return an operation');
  return out.name as string;
}

/** Returns the clip bytes when ready, null while Veo is still working. */
async function pollVideo(operation: string): Promise<Uint8Array | null> {
  const op = await google(operation);
  if (!op.done) return null;
  if (op.error) throw new Error(`Veo: ${op.error.message ?? 'generation failed'}`);
  const uri = op.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
  if (!uri) {
    const reason = op.response?.generateVideoResponse?.raiMediaFilteredReasons?.[0];
    throw new Error(reason ? `Veo blocked the clip: ${reason}` : 'Veo returned no video');
  }
  const res = await fetch(uri, { headers: { 'x-goog-api-key': key() }, redirect: 'follow' });
  if (!res.ok) throw new Error(`Could not download clip (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

/** ElevenLabs returns raw 16-bit mono PCM at 24 kHz with this output format, so the same WAV wrapper works. */
async function elevenLabsVoice(line: string) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE}?output_format=pcm_24000`, {
    method: 'POST',
    headers: { 'xi-api-key': ELEVEN_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: line, model_id: ELEVEN_MODEL }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return pcmToWav(new Uint8Array(await res.arrayBuffer()));
}

async function generateVoice(scene: SceneRow) {
  const line = [scene.narration, scene.dialogue].filter(Boolean).join(' ');
  if (ELEVEN_KEY) return elevenLabsVoice(line);
  const out = await google(`models/${TTS_MODEL}:generateContent`, {
    contents: [{ role: 'user', parts: [{ text: `Read this like an expressive storyteller for a dramatic short video, in the language it is written in:\n${line}` }] }],
    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICE } } } },
  });
  const audio = out?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audio) throw new Error('TTS returned no audio');
  return pcmToWav(b64ToBytes(audio));
}

// ---------- Pipeline ----------

async function upload(admin: SupabaseClient, path: string, bytes: Uint8Array, contentType: string) {
  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Storage: ${error.message}`);
}
async function download(admin: SupabaseClient, path: string) {
  const { data, error } = await admin.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(`Storage: ${error?.message ?? 'missing file'}`);
  return new Uint8Array(await data.arrayBuffer());
}

/** Atomically claims a scene so two ticks (two tabs) never process it twice. */
async function claim(admin: SupabaseClient, scene: SceneRow) {
  const staleBefore = new Date(Date.now() - STALE_CLAIM_MS).toISOString();
  const { data } = await admin.from('scenes').update({ claimed_at: new Date().toISOString() })
    .eq('id', scene.id).eq('stage', scene.stage)
    .or(`claimed_at.is.null,claimed_at.lt.${staleBefore}`)
    .select('id');
  return Boolean(data?.length);
}

const NEXT: Partial<Record<Stage, Stage>> = { image: 'video_submit', video_submit: 'video_wait', video_wait: 'audio', audio: 'done' };

async function advance(admin: SupabaseClient, scene: SceneRow, base: string, chars: Character[], reference: () => Promise<Uint8Array | null>) {
  const pad = String(scene.position).padStart(2, '0');
  const patch: Record<string, unknown> = { claimed_at: null, status: 'generating' };

  switch (scene.stage) {
    case 'image': {
      const img = await generateImage(scene, chars, scene.position === 1 ? null : await reference());
      const path = `${base}/scene-${pad}.png`;
      await upload(admin, path, img.bytes, img.mime);
      Object.assign(patch, { image_path: path, stage: NEXT.image, attempts: 0 });
      break;
    }
    case 'video_submit': {
      const img = await download(admin, scene.image_path!);
      Object.assign(patch, { operation: await submitVideo(scene, img, 'image/png'), stage: NEXT.video_submit, attempts: 0 });
      break;
    }
    case 'video_wait': {
      const clip = await pollVideo(scene.operation!);
      if (!clip) { await admin.from('scenes').update({ claimed_at: null }).eq('id', scene.id); return; }
      const path = `${base}/scene-${pad}.mp4`;
      await upload(admin, path, clip, 'video/mp4');
      Object.assign(patch, { video_path: path, operation: null, stage: NEXT.video_wait, attempts: 0 });
      break;
    }
    case 'audio': {
      const path = `${base}/scene-${pad}.wav`;
      await upload(admin, path, await generateVoice(scene), 'audio/wav');
      Object.assign(patch, { audio_path: path, stage: 'done', status: 'generated', attempts: 0 });
      break;
    }
    default:
      return;
  }
  const { error } = await admin.from('scenes').update(patch).eq('id', scene.id);
  if (error) throw new Error(error.message);
}

async function fail(admin: SupabaseClient, scene: SceneRow, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`scene ${scene.position} [${scene.stage}]`, message);
  const attempts = scene.attempts + 1;
  const exhausted = attempts >= MAX_ATTEMPTS;
  await admin.from('scenes').update({
    attempts, claimed_at: null,
    ...(exhausted ? { stage: 'failed', status: 'failed', error_message: message.slice(0, 300) } : {}),
  }).eq('id', scene.id);
}

async function tick(admin: SupabaseClient, userId: string, storyId: string) {
  const started = Date.now();
  const left = () => BUDGET_MS - (Date.now() - started);
  const base = `${userId}/${storyId}`;

  const { data: chars } = await admin.from('characters').select('name, species, visual_description').eq('story_id', storyId);
  let refCache: Uint8Array | null | undefined;
  const reference = async () => {
    if (refCache !== undefined) return refCache;
    const { data } = await admin.from('scenes').select('image_path').eq('story_id', storyId).eq('position', 1).single();
    refCache = data?.image_path ? await download(admin, data.image_path).catch(() => null) : null;
    return refCache;
  };

  // Several passes so a scene can go image -> submit in the same call when time allows.
  for (let pass = 0; pass < 4 && left() > 20_000; pass++) {
    const { data: scenes } = await admin.from('scenes').select('*').eq('story_id', storyId)
      .in('stage', ['image', 'video_submit', 'video_wait', 'audio']).order('position');
    const work = (scenes ?? []) as SceneRow[];
    if (work.length === 0) break;

    // Scene 1's image is the visual reference for the others: render it first.
    const first = work.find((s) => s.position === 1 && s.stage === 'image');
    const batch = first ? [first] : work.slice(0, 6);
    const claimed: SceneRow[] = [];
    for (const s of batch) if (await claim(admin, s)) claimed.push(s);
    if (claimed.length === 0) break;

    await Promise.all(claimed.map((s) =>
      Promise.race([
        advance(admin, s, base, (chars ?? []) as Character[], reference),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Step timed out')), Math.max(left() - 5_000, 10_000))),
      ]).catch((e) => fail(admin, s, e))));
  }

  const { data: all } = await admin.from('scenes').select('stage').eq('story_id', storyId);
  const stages = (all ?? []).map((s) => s.stage as Stage);
  const finished = stages.length > 0 && stages.every((s) => s === 'done' || s === 'failed');
  if (finished) await admin.from('stories').update({ status: 'in_review' }).eq('id', storyId).eq('status', 'generating');
  return { finished, done: stages.filter((s) => s === 'done').length, failed: stages.filter((s) => s === 'failed').length, total: stages.length };
}

// ---------- HTTP ----------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: auth } = await userClient.auth.getUser();
  if (!auth.user) return json({ error: 'Please sign in again.' }, 401);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let body: { action?: string; story_id?: string; scene_id?: string; from_start?: boolean };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!body.story_id) return json({ error: 'story_id is required' }, 400);

  // Ownership check through RLS: the user client can only see its own stories.
  const { data: story } = await userClient.from('stories').select('id, title, status').eq('id', body.story_id).maybeSingle();
  if (!story) return json({ error: 'Story not found' }, 404);

  try {
    switch (body.action) {
      case 'start': {
        if (story.status === 'generating') return json(await tick(admin, auth.user.id, story.id));
        const { count } = await admin.from('scenes').select('id', { count: 'exact', head: true }).eq('story_id', story.id);
        const cost = (count ?? 0) * CREDITS_PER_SCENE;
        const { error } = await userClient.rpc('consume_credits', { p_amount: cost, p_story_id: story.id, p_description: `${story.title} — ${count} scene renders` });
        if (error) return json({ error: error.message.includes('insufficient') ? 'Not enough Story Credits.' : error.message }, 402);
        await admin.from('scenes').update({ stage: 'image', status: 'queued', attempts: 0, claimed_at: null, error_message: null }).eq('story_id', story.id);
        await admin.from('stories').update({ status: 'generating', render_started_at: new Date().toISOString() }).eq('id', story.id);
        return json(await tick(admin, auth.user.id, story.id));
      }
      case 'tick':
        return json(await tick(admin, auth.user.id, story.id));
      case 'retry': {
        // Free retry: resume from the first missing asset.
        const { data: s } = await admin.from('scenes').select('*').eq('id', body.scene_id ?? '').eq('story_id', story.id).single();
        if (!s) return json({ error: 'Scene not found' }, 404);
        const stage: Stage = body.from_start || !s.image_path ? 'image' : !s.video_path ? 'video_submit' : 'audio';
        const reset = body.from_start ? { image_path: null, video_path: null, audio_path: null } : {};
        await admin.from('scenes').update({ stage, status: 'queued', attempts: 0, claimed_at: null, error_message: null, operation: null, ...reset }).eq('id', s.id);
        await admin.from('stories').update({ status: 'generating' }).eq('id', story.id);
        return json(await tick(admin, auth.user.id, story.id));
      }
      default:
        return json({ error: 'Unknown action' }, 400);
    }
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : 'Render error' }, 500);
  }
});
