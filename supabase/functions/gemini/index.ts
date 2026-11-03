// Supabase Edge Function: `gemini`
// Generates story concepts and 15-scene breakdowns with Google Gemini (structured JSON output).
// Secrets required: GEMINI_API_KEY. Optional: GEMINI_MODEL (default below).
// Single-file on purpose so it can be pasted into the Supabase dashboard editor.
import { createClient } from 'npm:@supabase/supabase-js@2';

const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
const COSTS = { concepts: 1, scenes: 2 } as const;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// ---------- Prompts & schemas ----------

const STYLE_GUIDE = `Genre: "Fruit Drama" — anthropomorphic fruit characters in over-the-top soap-opera stories for TikTok (vertical 9:16).
Visual style for every image prompt: hyper-real 3D fruit characters, glossy subsurface skin, expressive faces, cinematic soft key light, shallow depth of field, vertical 9:16.
Keep content brand-safe (no gore, no sexual content).`;

const characterSchema = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' },
    species: { type: 'STRING', description: 'The fruit or vegetable, e.g. Strawberry' },
    personality: { type: 'STRING' },
    visual_description: { type: 'STRING', description: 'Stable visual traits reused in every scene for consistency' },
  },
  required: ['name', 'species', 'personality', 'visual_description'],
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
          narration: { type: 'STRING', description: 'What happens, one or two sentences' },
          dialogue: { type: 'STRING', nullable: true, description: 'Format: Name: "line". Null if silent.' },
          image_prompt: { type: 'STRING', description: 'Self-contained prompt for the keyframe image, repeating character visual traits' },
          video_prompt: { type: 'STRING', description: 'Camera movement and action for a 3-5s clip' },
          duration_seconds: { type: 'INTEGER', description: 'Between 3 and 5' },
        },
        required: ['title', 'narration', 'image_prompt', 'video_prompt', 'duration_seconds'],
      },
    },
  },
  required: ['scenes'],
};

async function callGemini<T>(prompt: string, schema: unknown): Promise<T> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY secret is not set');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 1 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned an empty response');
  return JSON.parse(text) as T;
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
        `${STYLE_GUIDE}\n\nUser idea: "${idea}"\n\nPropose exactly 3 clearly different series concepts based on this idea (different tones/angles). Each has exactly 2 or 3 main characters. Write in the same language as the user idea.`,
        conceptsSchema,
      );
      result = { concepts: out.concepts.slice(0, 3).map((c, i) => ({ ...c, id: `c${i + 1}` })) };
    } else {
      const count = Math.min(Math.max(Number(body.count) || 15, 5), 30);
      const out = await callGemini<{ scenes: Record<string, unknown>[] }>(
        `${STYLE_GUIDE}\n\nSeries concept (JSON): ${JSON.stringify(body.concept).slice(0, 4000)}\n\nWrite episode 1 as exactly ${count} scenes for a ~60s vertical video: strong hook in scene 1, escalating conflict, a twist around scene 11-13, and a cliffhanger in the last scene. Image prompts must be self-contained and repeat each character's visual traits. Write narration and dialogue in the concept's language; write image/video prompts in English.`,
        scenesSchema,
      );
      result = {
        scenes: out.scenes.slice(0, count).map((s, i) => ({
          ...s,
          position: i + 1,
          dialogue: s.dialogue ?? null,
          duration_seconds: Math.min(Math.max(Number(s.duration_seconds) || 4, 3), 5),
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
