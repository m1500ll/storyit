// Supabase Edge Function: `gemini`
// Generates story concepts and 15-scene breakdowns with Google Gemini (structured JSON output).
// Secrets required: GEMINI_API_KEY. Optional: GEMINI_MODEL (default below).
// Single-file on purpose so it can be pasted into the Supabase dashboard editor.
import { createClient } from 'npm:@supabase/supabase-js@2';

const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash';
// Used when the main model stays overloaded. Set GEMINI_FALLBACK_MODEL to "none" to disable.
const FALLBACK_MODEL = Deno.env.get('GEMINI_FALLBACK_MODEL') ?? 'gemini-3.5-flash-lite';
const RETRYABLE = new Set([429, 500, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Supabase stops a function after ~150s (free plan) without a usable response, so stay well below it.
const TOTAL_BUDGET_MS = 100_000;
const REQUEST_TIMEOUT_MS = 45_000;
const COSTS = { concepts: 1, scenes: 2 } as const;

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
Visual style for every image/video prompt: 3D Pixar/Disney-style animation, ultra-detailed organic textures, cinematic studio lighting, extreme facial expressions (sobbing, rage, greed, compassion), vertical 9:16.
The story must travel through 6 to 8 different locations (e.g. living room → street curb → luxury car → busy downtown → hospital → outdoor wedding). Never pad: no run of similar scenes in the same room; every scene advances the plot.
The characters speak for themselves on screen (lip-synced). There is NO narrator.
Keep content brand-safe (no gore, no sexual content).`;

const characterSchema = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' },
    species: { type: 'STRING', description: 'The fruit or vegetable, e.g. Strawberry' },
    personality: { type: 'STRING' },
    visual_description: { type: 'STRING', description: 'Stable visual traits reused in every scene for consistency' },
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
          video_prompt: { type: 'STRING', description: 'English: precise camera motion (push-in, whip-pan, tracking…) and character action / micro-expressions / mouth movement for a 4-6s clip' },
          duration_seconds: { type: 'INTEGER', description: 'Between 4 and 6 — long enough to say the line' },
        },
        required: ['title', 'narration', 'image_prompt', 'video_prompt', 'duration_seconds'],
      },
    },
  },
  required: ['scenes'],
};

class GeminiHttpError extends Error {
  constructor(public status: number, body: string) {
    super(`Gemini error ${status}: ${body.slice(0, 300)}`);
  }
}

async function requestGemini<T>(model: string, prompt: string, schema: unknown, key: string, timeoutMs: number): Promise<T> {
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

  let body: { task?: string; idea?: string; concept?: Record<string, unknown>; count?: number };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

  const task = body.task;
  if (task !== 'concepts' && task !== 'scenes') return json({ error: 'Unknown task' }, 400);

  const { data: profile } = await supabase.from('profiles').select('credit_balance').eq('id', auth.user.id).single();
  if (!profile || profile.credit_balance < COSTS[task]) return json({ error: 'Not enough Story Credits.' }, 402);

  try {
    let result: unknown;
    if (task === 'concepts') {
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
      p_amount: COSTS[task], p_story_id: null, p_description: task === 'concepts' ? 'AI concepts (Gemini)' : 'AI scene breakdown (Gemini)',
    });
    if (error) return json({ error: error.message.includes('insufficient') ? 'Not enough Story Credits.' : error.message }, 402);

    return json(result);
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : 'Generation failed' }, 502);
  }
});
