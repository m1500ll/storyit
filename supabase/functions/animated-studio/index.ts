// Supabase Edge Function: `animated-studio` — the Animated Studio's brief chat and job queue.
// - chat:     one turn of the brief conversation with Claude. Each turn ends with clickable cards (tool
//             present_choices: format, then story, then decor) or the agreed brief (tool brief_ready); the customer's
//             click or typed text goes back as the tool result. A hidden studio note (random seed + ideas already
//             proposed to anyone, table animated_ideas) keeps the options different for every customer.
//             May check facts with web search. Free: the credits are charged once, at generate.
// - generate: charges ANIMATED_COST credits once and queues the project for the render worker
//             (render-engine/worker: VideoSpec by Claude -> ElevenLabs narration -> sound -> 3D render -> upload).
//             The worker refunds the credits if the render fails.
// - list / get: the customer's projects (also readable directly through RLS + Realtime for live progress).
// Secrets: ANTHROPIC_API_KEY (Edge Function secret, never a VITE_ variable).
import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk@1.6.0';
import { ANIMATED_COST, CHAT_SYSTEM, CHAT_TOOLS, DECOR_KEYS, MODEL, seedNote, type Brief, type Choices } from '../_shared/animatedStudio.ts';
import { BudgetError, releaseAi, reserveAi } from '../_shared/aiBudget.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const MAX_TURNS = 30; // a brief that long has lost its way: ask the customer to start a new project

type Line = { role: string; text: string; choices?: Choices; brief?: Brief };
type Row = { id: string; user_id: string; status: string; messages: Anthropic.Beta.BetaMessageParam[]; transcript: Line[]; title: string | null; language: string };
const OUR_TOOLS = new Set(['present_choices', 'brief_ready']);

/** a copy of the conversation whose newest customer turn carries a cache breakpoint, so the whole history (and the
 *  search results in it) is read from the prompt cache on the next turn instead of being billed again in full. The
 *  stored history never keeps breakpoints (the API allows 4 per request: the system prompt uses one). */
function withCacheBreakpoint(messages: Anthropic.Beta.BetaMessageParam[]): Anthropic.Beta.BetaMessageParam[] {
  let i = messages.length - 1;
  while (i >= 0 && messages[i]!.role !== 'user') i--;
  if (i < 0) return messages;
  const m = messages[i]!;
  const blocks = typeof m.content === 'string' ? [{ type: 'text' as const, text: m.content }] : [...m.content];
  if (!blocks.length) return messages;
  blocks[blocks.length - 1] = { ...blocks[blocks.length - 1], cache_control: { type: 'ephemeral' } } as typeof blocks[number];
  return [...messages.slice(0, i), { ...m, content: blocks }, ...messages.slice(i + 1)];
}

/** one Claude turn of the brief chat; server tools (web search) can pause a long turn: continue it, at most 3 times.
 *  The turn ends on our own tool call (cards or brief), which the next customer message answers as its tool result. */
async function chatTurn(client: Anthropic, history: Anthropic.Beta.BetaMessageParam[]) {
  const messages = [...history];
  let reply = '';
  let choices: Choices | undefined, brief: Brief | undefined;
  for (let hop = 0; hop < 4; hop++) {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default', // a safety-classifier decline is retried server-side on Anthropic's recommended model
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' }, // conversational turns: low effort is enough and keeps replies quick
      system: [{ type: 'text', text: CHAT_SYSTEM, cache_control: { type: 'ephemeral' } }],
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 1 }, ...CHAT_TOOLS],
      messages: withCacheBreakpoint(messages),
    });
    if (res.stop_reason === 'refusal') throw new Error('refusal');
    messages.push({ role: 'assistant', content: res.content }); // keep every block (thinking, search results) unchanged
    reply += res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join('');
    for (const b of res.content) {
      if (b.type !== 'tool_use') continue;
      if (b.name === 'present_choices') choices = b.input as Choices;
      if (b.name === 'brief_ready') brief = b.input as Brief;
    }
    console.log(JSON.stringify({ audit: 'animated_chat_usage', model: res.model, usage: res.usage })); // cache_read_input_tokens shows the history cache working
    if (res.stop_reason !== 'pause_turn') break;
  }
  if (choices) choices = { ...choices, options: (choices.options ?? []).slice(0, 4).filter((o) => o?.title) };
  // decor step: only decors the engine can render reach the customer (a card without a known decor key is dropped)
  if (choices?.step === 'decor') {
    const ok = choices.options.filter((o) => o.decor && DECOR_KEYS.includes(o.decor));
    if (ok.length) choices = { ...choices, options: ok };
  }
  return { messages, reply: reply.trim(), choices, brief };
}

/** the customer's turn: a tool result for each of our pending tool calls (cards or brief), else plain text */
function customerTurn(history: Anthropic.Beta.BetaMessageParam[], text: string, note: string): Anthropic.Beta.BetaMessageParam {
  const last = history.at(-1);
  const pending = last?.role === 'assistant' && Array.isArray(last.content)
    ? last.content.filter((b) => b.type === 'tool_use' && OUR_TOOLS.has((b as Anthropic.Beta.BetaToolUseBlock).name)) as Anthropic.Beta.BetaToolUseBlock[]
    : [];
  const noteBlock = { type: 'text' as const, text: note };
  if (!pending.length) return { role: 'user', content: [{ type: 'text', text }, noteBlock] };
  return {
    role: 'user',
    content: [
      ...pending.map((b, i) => ({ type: 'tool_result' as const, tool_use_id: b.id, content: i === 0 ? `Customer: ${text}` : 'Noted.' })),
      noteBlock,
    ],
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const user = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: auth } = await user.auth.getUser();
  if (!auth.user) return json({ error: 'Veuillez vous reconnecter.' }, 401);
  const uid = auth.user.id;
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let body: { action?: string; project_id?: string; message?: string; voice_id?: string; language?: string };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const action = body.action ?? 'chat';
  const load = async (id: string) =>
    (await admin.from('animated_projects').select('*').eq('id', id).eq('user_id', uid).maybeSingle()).data as Row | null;

  if (action === 'list') {
    const { data } = await admin.from('animated_projects')
      .select('id,title,status,progress,video_path,error,created_at,updated_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(50);
    return json({ projects: data ?? [] });
  }
  if (action === 'get') {
    if (!body.project_id) return json({ error: 'project_id manquant' }, 400);
    const p = await load(body.project_id);
    if (!p) return json({ error: 'Projet introuvable.' }, 404);
    const { messages: _m, error_detail: _d, ...rest } = p as Row & { error_detail?: string }; // raw Claude history and stack traces stay on the server
    return json({ project: rest });
  }

  if (action === 'chat') {
    const text = (body.message ?? '').trim();
    if (!text) return json({ error: 'Écrivez un message.' }, 400);
    if (text.length > 4000) return json({ error: 'Message trop long (4 000 caractères maximum).' }, 400);
    const key = Deno.env.get('ANTHROPIC_API_KEY');
    if (!key) return json({ error: "Le studio n'est pas encore configuré. Réessayez plus tard." }, 503);
    let p = body.project_id ? await load(body.project_id) : null;
    if (body.project_id && !p) return json({ error: 'Projet introuvable.' }, 404);
    if (p && p.status !== 'brief') return json({ error: 'Ce projet est déjà lancé. Créez un nouveau projet pour une autre vidéo.' }, 409);
    if (!p) {
      const { data, error } = await admin.from('animated_projects').insert({ user_id: uid, language: body.language ?? 'fr' }).select('*').single();
      if (error || !data) return json({ error: 'Impossible de créer le projet.' }, 500);
      p = data as Row;
    }
    if (p.transcript.length >= MAX_TURNS * 2) return json({ error: 'Cette discussion est très longue : créez un nouveau projet pour repartir de zéro.' }, 409);
    try { await reserveAi('claude_chat'); } catch (e) { return json({ error: e instanceof BudgetError ? e.message : 'Service indisponible.' }, 429); }
    // ideas already proposed to anyone (newest first): Claude must not offer them again
    const { data: taken } = await admin.from('animated_ideas').select('title').order('created_at', { ascending: false }).limit(80);
    const note = seedNote([...new Set((taken ?? []).map((r: { title: string }) => r.title))]);
    const history: Anthropic.Beta.BetaMessageParam[] = [...p.messages, customerTurn(p.messages, text, note)];
    try {
      const out = await chatTurn(new Anthropic({ apiKey: key, timeout: 120_000, maxRetries: 1 }), history);
      const line: Line = { role: 'assistant', text: out.reply || (out.brief ? 'Voici le récapitulatif de votre vidéo.' : '') };
      if (out.choices?.options.length) line.choices = out.choices;
      if (out.brief) line.brief = out.brief;
      const transcript = [...p.transcript, { role: 'user', text }, line];
      const patch: Record<string, unknown> = { messages: out.messages, transcript };
      if (out.brief?.title) patch.title = out.brief.title.slice(0, 120);
      if (out.brief?.language && ['fr', 'en', 'es'].includes(out.brief.language)) patch.language = out.brief.language;
      await admin.from('animated_projects').update(patch).eq('id', p.id);
      if (out.choices?.step === 'story') {
        const theme = (p.transcript.find((l) => l.role === 'user')?.text ?? text).slice(0, 200);
        await admin.from('animated_ideas').insert(out.choices.options.map((o) => ({ theme, step: 'story', title: o.title.slice(0, 160) })));
      }
      return json({ project_id: p.id, reply: line.text, transcript });
    } catch (e) {
      await releaseAi('claude_chat'); // the turn failed: it spent nothing
      if (e instanceof Anthropic.APIError && /credit balance/i.test(e.message)) { console.error('anthropic: out of credit'); return json({ error: "Le studio est momentanément indisponible. Réessayez un peu plus tard. Aucun crédit n'a été utilisé." }, 503); }
      if (e instanceof Anthropic.RateLimitError) return json({ error: 'Le studio est très demandé. Réessayez dans une minute.' }, 429);
      if (e instanceof Anthropic.APIError) { console.error('anthropic', e.status, e.message.slice(0, 300)); return json({ error: 'Le studio ne répond pas. Réessayez dans un instant.' }, 502); }
      if (e instanceof Error && e.message === 'refusal') return json({ error: 'Cette demande ne peut pas être traitée. Essayez une autre idée.' }, 422);
      console.error('animated chat', e);
      return json({ error: 'Erreur inattendue. Réessayez.' }, 500);
    }
  }

  if (action === 'generate') {
    if (!body.project_id) return json({ error: 'project_id manquant' }, 400);
    const p = await load(body.project_id);
    if (!p) return json({ error: 'Projet introuvable.' }, 404);
    if (p.status !== 'brief') return json({ error: 'Cette vidéo est déjà lancée.' }, 409);
    if (p.transcript.filter((m) => m.role === 'assistant').length < 1) return json({ error: "Discutez d'abord de votre idée avec le studio." }, 400);
    if (body.voice_id && !/^[A-Za-z0-9]{16,32}$/.test(body.voice_id)) return json({ error: 'Voix inconnue.' }, 400);
    // charge first (atomic, fails when the balance is too low), then queue; the worker refunds on failure
    const { error: credErr } = await user.rpc('consume_credits', { p_amount: ANIMATED_COST, p_story_id: null, p_description: 'Animated Studio — vidéo animée' });
    if (credErr) return json({ error: `Il vous faut ${ANIMATED_COST} crédits pour générer cette vidéo.`, code: 'insufficient_credits' }, 402);
    const { error } = await admin.from('animated_projects').update({
      status: 'queued', progress: 1, credits_charged: ANIMATED_COST, voice_id: body.voice_id ?? null, language: body.language ?? p.language, error: null,
    }).eq('id', p.id).eq('status', 'brief');
    if (error) {
      await admin.rpc('grant_credits', { p_user_id: uid, p_amount: ANIMATED_COST, p_type: 'refund', p_description: 'Animated Studio — remboursement (file indisponible)' });
      return json({ error: 'Impossible de lancer la vidéo. Vos crédits ont été rendus.' }, 500);
    }
    // wake the render worker (GPU on demand); it also polls, so a failed wake-up only delays the job
    const hook = Deno.env.get('RENDER_WORKER_URL');
    if (hook) fetch(hook, { method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('RENDER_WORKER_TOKEN') ?? ''}` }, signal: AbortSignal.timeout(5000) }).catch(() => {});
    return json({ project_id: p.id, status: 'queued' });
  }

  return json({ error: 'Action inconnue' }, 400);
});
