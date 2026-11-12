// Supabase Edge Function: `gemini`
// Generates story concepts and 15-scene breakdowns with Google Gemini (structured JSON output).
// Secrets required: GEMINI_API_KEY. Optional: GEMINI_MODEL (default below).
// Single-file on purpose so it can be pasted into the Supabase dashboard editor.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { reserveAi } from '../_shared/aiBudget.ts';

const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash';
// Used when the main model stays overloaded. Set GEMINI_FALLBACK_MODEL to "none" to disable.
const FALLBACK_MODEL = Deno.env.get('GEMINI_FALLBACK_MODEL') ?? 'gemini-3.5-flash-lite';
const RETRYABLE = new Set([429, 500, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Supabase stops a function after ~150s (free plan) without a usable response, so stay well below it.
const TOTAL_BUDGET_MS = 100_000;
const REQUEST_TIMEOUT_MS = 45_000;
const COSTS = { concepts: 100, scenes: 200, publish_pack: 100 } as const;
type Task = keyof typeof COSTS;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// ---------- Prompts & schemas ----------

const STYLE_GUIDE = `Genre: "Fruit Drama" — hyper-dramatic, viral 60s+ TikTok stories starring anthropomorphic 3D fruit/vegetable characters (abusive pears, innocent broccoli, heroic peaches, scheming apples).
Tone: high drama, extreme emotional contrast — betrayal, heartbreak, sacrifice, revenge, redemption, bizarre humour, suspense.
Visual style for every image/video prompt: stylized cinematic 3D animated film still (original art direction), ultra-detailed organic textures, cinematic studio lighting, vertical 9:16.
Characters are REAL animated characters, not plain fruit with a face: full-body anthropomorphic fruits/vegetables with big expressive cartoon eyes, eyebrows, a mouth that can talk, arms, hands, legs and feet, wearing clothes and accessories that fit their role (apron, suit, hospital gown, jewellery…), with extreme facial expressions and body language (sobbing, rage, greed, compassion).
Every scene is alive: characters move, walk, gesture and interact with objects and each other; real environments full of detail (props, background extras, weather).
The story must travel through 6 to 8 different locations (e.g. living room → street curb → luxury car → busy downtown → hospital → outdoor wedding). Never pad: no run of similar scenes in the same room; every scene advances the plot.
The characters speak for themselves on screen (lip-synced). There is NO narrator.
Keep content brand-safe (no gore, no sexual content).`;

const characterSchema = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' },
    species: { type: 'STRING', description: 'The fruit or vegetable, e.g. Strawberry' },
    personality: { type: 'STRING' },
    visual_description: { type: 'STRING', description: 'Full-body stylized 3D character design reused in every scene: fruit/vegetable body, colours, eyes, limbs, outfit, accessories' },
    voice_style: { type: 'STRING', description: 'Distinct voice used in every scene: gender, age, pitch, accent, speaking manner (e.g. "high-pitched young woman, fast and sassy, Parisian accent"). Each character must sound clearly different.' },
  },
  required: ['name', 'species', 'personality', 'visual_description', 'voice_style'],
};

const conceptsSchema = {
  type: 'OBJECT',
  properties: {
    concepts: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          logline: { type: 'STRING', description: 'One sentence' },
          tone: { type: 'STRING', description: '2-3 words, e.g. Telenovela melodrama' },
          hook: { type: 'STRING', description: 'The first 2 seconds that stop the scroll' },
          characters: { type: 'ARRAY', items: characterSchema },
        },
        required: ['title', 'logline', 'tone', 'hook', 'characters'],
      },
    },
  },
  required: ['concepts'],
};

const scenesSchema = {
  type: 'OBJECT',
  properties: {
    scenes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          narration: { type: 'STRING', description: 'Location + what happens, one sentence. Stage direction only — never spoken aloud' },
          dialogue: { type: 'STRING', nullable: true, description: 'Format: Name (voice tone/emotion): "line". ONE character speaking on screen, max 12 words, with gasps/sobs/shouts as punctuation. Null only for a silent reaction shot.' },
          image_prompt: { type: 'STRING', description: 'Self-contained English prompt: location, each visible character with their full visual traits and clothing, facial expression, body language, background, colour palette' },
          video_prompt: { type: 'STRING', description: 'English: precise camera motion (push-in, whip-pan, tracking…), full-body character action and interaction, micro-expressions, mouth movement, plus the ambient sounds and foley of the place (rain, traffic, crowd, footsteps, objects) for a 4-6s clip' },
          duration_seconds: { type: 'INTEGER', description: 'Between 4 and 6 — long enough to say the line' },
        },
        required: ['title', 'narration', 'image_prompt', 'video_prompt', 'duration_seconds'],
      },
    },
  },
  required: ['scenes'],
};

// Phase 5 — thumbnail prompt + social SEO pack, generated from the episode actually produced.
const PLATFORM_LIMITS = 'TikTok caption ≤ 2200 characters. Instagram Reels caption ≤ 2200 characters and at most 30 hashtags (5–10 is better). YouTube Shorts title ≤ 100 characters, description ≤ 5000 characters, tags ≤ 500 characters in total, 3–5 hashtags.';
const str = (description: string) => ({ type: 'STRING', description });
const strList = (description: string) => ({ type: 'ARRAY', items: { type: 'STRING' }, description });
const publishPackSchema = {
  type: 'OBJECT',
  properties: {
    titles: {
      type: 'ARRAY',
      description: 'Exactly 5 titles, each a different narrative angle, faithful to the episode, no false claims',
      items: { type: 'OBJECT', properties: { angle: { type: 'STRING', enum: ['emotion', 'conflict', 'sacrifice', 'suspense', 'curiosity'] }, text: str('Title in the episode language') }, required: ['angle', 'text'] },
    },
    caption: str('Shared caption: presents the conflict without spoiling the ending, sparks emotion or curiosity, invites comments naturally, emojis in moderation, no claims about views or virality'),
    platforms: {
      type: 'OBJECT',
      properties: {
        tiktok: { type: 'OBJECT', properties: { caption: str('TikTok caption including hashtags at the end'), hook: str('Short on-screen hook / title'), hashtags: strList('3-6 relevant hashtags with #') }, required: ['caption', 'hook', 'hashtags'] },
        instagram: { type: 'OBJECT', properties: { caption: str('Reels caption'), hashtags: strList('5-10 relevant hashtags with #') }, required: ['caption', 'hashtags'] },
        youtube: { type: 'OBJECT', properties: { title: str('Shorts title, max 100 characters'), description: str('Description, a few lines'), hashtags: strList('3-5 hashtags with #'), tags: strList('Search keywords without #') }, required: ['title', 'description', 'hashtags', 'tags'] },
      },
      required: ['tiktok', 'instagram', 'youtube'],
    },
    thumbnail: {
      type: 'OBJECT',
      properties: {
        thumbnail_type: str('e.g. split emotional contrast, single close-up reaction, before/after'),
        style: str('Art direction: original stylized cinematic 3D animation'),
        prompt: str('Self-contained English image prompt built from the strongest emotional moment, repeating each character\'s full visual traits; readable at small size; no text'),
        negative_prompt: str('What to avoid (text, watermark, extra limbs, off-model characters, clutter…)'),
        characters: strList('Names of the characters shown'),
        emotional_hook: str('The one emotion/contrast the image sells'),
        composition: str('Framing, focal point, contrast, lighting'),
      },
      required: ['thumbnail_type', 'style', 'prompt', 'negative_prompt', 'characters', 'emotional_hook', 'composition'],
    },
  },
  required: ['titles', 'caption', 'platforms', 'thumbnail'],
};

const clip = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const tags = (v: unknown, max: number) => [...new Set((Array.isArray(v) ? v : []).map((t) => '#' + String(t).replace(/^#+/, '').replace(/\s+/g, '')).filter((t) => t.length > 1))].slice(0, max);

/** Clamps the model output to each platform's limits so the UI never shows unusable text. */
function normalizePack(raw: Record<string, any>) {
  const p = raw.platforms ?? {};
  return {
    titles: (raw.titles ?? []).slice(0, 5).map((t: Record<string, unknown>) => ({ angle: clip(t.angle, 20), text: clip(t.text, 150) })),
    caption: clip(raw.caption, 2000),
    platforms: {
      tiktok: { caption: clip(p.tiktok?.caption, 2200), hook: clip(p.tiktok?.hook, 100), hashtags: tags(p.tiktok?.hashtags, 6) },
      instagram: { caption: clip(p.instagram?.caption, 2000), hashtags: tags(p.instagram?.hashtags, 10) },
      youtube: {
        title: clip(p.youtube?.title, 100), description: clip(p.youtube?.description, 4500), hashtags: tags(p.youtube?.hashtags, 5),
        tags: (Array.isArray(p.youtube?.tags) ? p.youtube.tags : []).map((t: unknown) => clip(t, 30)).filter(Boolean)
          .reduce((acc: string[], t: string) => (acc.join(',').length + t.length < 480 ? [...acc, t] : acc), []),
      },
    },
    thumbnail: {
      ...Object.fromEntries(['thumbnail_type', 'style', 'prompt', 'negative_prompt', 'emotional_hook', 'composition'].map((k) => [k, clip(raw.thumbnail?.[k], 2000)])),
      characters: (raw.thumbnail?.characters ?? []).map((c: unknown) => clip(c, 60)).slice(0, 4),
      aspect_ratio: '9:16',
      platform_targets: { tiktok: '9:16 cover (1080x1920)', instagram: '9:16 cover (1080x1920)', youtube: 'Shorts use a frame or 9:16 cover; 16:9 variant (1280x720) for long-form surfaces' },
    },
  };
}

class GeminiHttpError extends Error {
  constructor(public status: number, body: string) {
    super(`Gemini error ${status}: ${body.slice(0, 300)}`);
  }
}

async function requestGemini<T>(model: string, prompt: string, schema: unknown, key: string, timeoutMs: number): Promise<T> {
  await reserveAi('text');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 1 },
    }),
  });
  if (!res.ok) throw new GeminiHttpError(res.status, await res.text());
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned an empty response');
  return JSON.parse(text) as T;
}

/** Retries transient errors (overload / rate limit) with backoff, then tries the fallback model. */
async function callGemini<T>(prompt: string, schema: unknown): Promise<T> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY secret is not set');

  const models = FALLBACK_MODEL && FALLBACK_MODEL !== 'none' && FALLBACK_MODEL !== MODEL ? [MODEL, FALLBACK_MODEL] : [MODEL];
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  let lastError: unknown;
  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining < 5_000) break;
      try {
        return await requestGemini<T>(model, prompt, schema, key, Math.min(REQUEST_TIMEOUT_MS, remaining));
      } catch (e) {
        lastError = e;
        const timedOut = e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError');
        const retryable = timedOut || (e instanceof GeminiHttpError ? RETRYABLE.has(e.status) : e instanceof SyntaxError);
        if (!retryable) {
          // A missing/retired fallback model should not hide the real overload error.
          if (model !== MODEL && e instanceof GeminiHttpError && e.status === 404) break;
          throw e;
        }
        console.warn(`Gemini ${model} attempt ${attempt + 1} failed:`, e instanceof Error ? e.message : e);
        await sleep(1000 * 2 ** attempt + Math.random() * 500);
      }
    }
  }
  const transient = lastError === undefined || lastError instanceof DOMException
    || (lastError instanceof GeminiHttpError && RETRYABLE.has(lastError.status));
  if (transient) {
    throw new Error('Gemini is overloaded right now. Please try again in a minute — no credits were used.');
  }
  throw lastError;
}

// ---------- Handler ----------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Act as the calling user so RLS and consume_credits apply to them.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return json({ error: 'Please sign in again.' }, 401);

  // The AI episode studio is in private beta: invited accounts only (profiles.beta_access, not editable by users).
  const { data: beta } = await supabase.from('profiles').select('beta_access').eq('id', auth.user.id).maybeSingle();
  if (!beta?.beta_access) return json({ error: 'The AI episode studio is in private beta and not available on your account yet. No credits were used.', code: 'beta_only' }, 403);

  let body: { task?: string; idea?: string; concept?: Record<string, unknown>; count?: number; story_id?: string };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

  const task = body.task;
  if (task !== 'concepts' && task !== 'scenes' && task !== 'publish_pack') return json({ error: 'Unknown task' }, 400);

  const { data: profile } = await supabase.from('profiles').select('credit_balance').eq('id', auth.user.id).single();
  if (!profile || profile.credit_balance < COSTS[task]) return json({ error: 'Crédits insuffisants : rechargez votre solde pour continuer.' }, 402);

  try {
    let result: unknown;
    if (task === 'publish_pack') {
      // Ownership via RLS: the user client only sees its own story.
      const { data: story } = await supabase.from('stories')
        .select('id, title, logline, genre, approved_hash, characters(name, species, personality, visual_description, voice_style), scenes(position, title, narration, dialogue)')
        .eq('id', String(body.story_id ?? '')).maybeSingle();
      if (!story) return json({ error: 'Story not found' }, 404);
      const scenes = [...(story.scenes ?? [])].sort((a, b) => a.position - b.position);
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await admin.from('publish_packs').upsert({ story_id: story.id, user_id: auth.user.id, status: 'generating', error_message: null });
      try {
        const raw = await callGemini<Record<string, any>>(
          `${STYLE_GUIDE}\n\nYou are preparing the publication of this finished episode. Use ONLY what happens in it; never invent events, never promise virality or view counts.\n` +
          `Episode: ${JSON.stringify({ title: story.title, logline: story.logline, characters: story.characters, scenes }).slice(0, 12000)}\n\n` +
          `Produce: 5 distinct titles (emotion, conflict, sacrifice, suspense, curiosity), a shared caption, per-platform metadata, and one high-impact thumbnail concept built on the episode's strongest emotional moment or contrast (e.g. despair vs relief), readable at small size, with no text in the image. ` +
          `Pick hashtags that really match the content, language and platform (mix niche, story and language tags; do not force generic ones). Platform limits: ${PLATFORM_LIMITS} Write titles, captions and hashtags in the language of the episode dialogue; write the thumbnail fields in English.`,
          publishPackSchema,
        );
        result = normalizePack(raw);
        await admin.from('publish_packs').upsert({ story_id: story.id, user_id: auth.user.id, content: result, status: 'ready', error_message: null, approved_hash: story.approved_hash, selected_title: null });
      } catch (e) {
        await admin.from('publish_packs').upsert({ story_id: story.id, user_id: auth.user.id, status: 'error', error_message: (e instanceof Error ? e.message : String(e)).slice(0, 300) });
        throw e;
      }
    } else if (task === 'concepts') {
      const idea = String(body.idea ?? '').trim().slice(0, 400);
      if (idea.length < 10) return json({ error: 'Idea is too short.' }, 400);
      const out = await callGemini<{ concepts: Record<string, unknown>[] }>(
        `${STYLE_GUIDE}\n\nUser idea: "${idea}"\n\nPropose exactly 3 wildly dramatic, clearly different concepts based on this idea, each built for a 15-scene arc across several locations with betrayal, sacrifice, revenge, love and redemption. Each has exactly 2 or 3 main characters. Write in the same language as the user idea.`,
        conceptsSchema,
      );
      result = { concepts: out.concepts.slice(0, 3).map((c, i) => ({ ...c, id: `c${i + 1}` })) };
    } else {
      const count = Math.min(Math.max(Number(body.count) || 15, 5), 30);
      const out = await callGemini<{ scenes: Record<string, unknown>[] }>(
        `${STYLE_GUIDE}\n\nSeries concept (JSON): ${JSON.stringify(body.concept).slice(0, 4000)}\n\nWrite episode 1 as exactly ${count} fast-paced scenes for a 60s+ vertical video: shocking hook in scene 1, escalating conflict across 6-8 locations, a twist around scene 11-13, and an emotional payoff or cliffhanger in the last scene. Almost every scene has one short spoken line by the character on screen (no narrator). Image prompts must be self-contained and repeat each character's visual traits. Write narration and dialogue in the concept's language; write image/video prompts in English.`,
        scenesSchema,
      );
      result = {
        scenes: out.scenes.slice(0, count).map((s, i) => ({
          ...s,
          position: i + 1,
          dialogue: s.dialogue ?? null,
          duration_seconds: Math.min(Math.max(Number(s.duration_seconds) || 5, 4), 6),
        })),
      };
    }

    // Charge only after a successful generation.
    const { error } = await supabase.rpc('consume_credits', {
      p_amount: COSTS[task], p_story_id: task === 'publish_pack' ? String(body.story_id) : null,
      p_description: ({ concepts: 'AI concepts (Gemini)', scenes: 'AI scene breakdown (Gemini)', publish_pack: 'Publish pack: titles, captions, hashtags, thumbnail prompt' } satisfies Record<Task, string>)[task],
    });
    if (error) return json({ error: error.message.includes('insufficient') ? 'Crédits insuffisants : rechargez votre solde pour continuer.' : error.message }, 402);

    return json(result);
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : 'Generation failed' }, 502);
  }
});
