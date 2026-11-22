// Supabase Edge Function `outreach` (owner only): the creators to invite into the partner programme and the TikTok
// messages written for them. Messages are sent by hand (copy + open the profile): TikTok forbids automated DMs.
// Actions: list, add { handles: string[] (links or @names), niche? }, update { id, patch }, remove { id },
//          draft { id, kind: 'first' | 'follow_up' } (AI message, saved on the creator).
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const STATUSES = ['to_contact', 'contacted', 'replied', 'partner', 'declined'];
const COLS = 'id, handle, display_name, followers, niche, notes, status, message, follow_up_count, contacted_at, last_message_at, created_at';

/** "@name", "name", "https://www.tiktok.com/@name?..." → "name" (lower case), or null */
export function handleOf(raw: string): string | null {
  const s = raw.trim();
  const m = s.match(/tiktok\.com\/@([A-Za-z0-9._]{2,30})/i) ?? s.match(/^@?([A-Za-z0-9._]{2,30})$/);
  return m ? m[1].toLowerCase() : null;
}

const PROGRAMME = `Storyit (storyit.fun) creates AI fruit videos ("Fruit Drama") in one click: the story, the characters, the voices, the subtitles and the music, ready for TikTok. It also cuts long videos into clips.
Partner programme: the creator gets a personal link; every person who subscribes through it within 7 days earns the creator 15 % of that first payment. Nothing to pay, no obligation.`;

function prompt(c: any, kind: 'first' | 'follow_up') {
  const who = [`TikTok account @${c.handle}`, c.display_name && `name: ${c.display_name}`, c.followers && `${c.followers.toLocaleString('fr-FR')} followers`,
    c.niche && `niche: ${c.niche}`, c.notes && `owner's notes: ${c.notes}`].filter(Boolean).join(', ');
  return kind === 'first'
    ? `You write a first TikTok direct message from the Storyit team to a creator, in French, to offer a partnership.
${PROGRAMME}
Creator: ${who}.
Rules: 300 to 500 characters. Casual and respectful ("tu"), like a real person, no corporate tone. Open with a sincere, specific compliment on their content (their niche; use the notes if any), then why Storyit fits their audience, then the 15 % partnership in one sentence, then a simple question to start the conversation (e.g. "ça te dit que je t'envoie ton lien ?"). No links, no hashtags, at most 1 emoji, no false promises, no invented numbers. Sign "L'équipe Storyit". Return only the message.`
    : `You write a short, friendly TikTok follow-up message in French from the Storyit team to a creator who did not answer a partnership offer a few days ago.
${PROGRAMME}
Creator: ${who}.
Rules: 150 to 280 characters, "tu", no pressure, remind the offer in a few words (15 % on subscribers from their link), end with an easy yes/no question. No links, at most 1 emoji. Sign "L'équipe Storyit". Return only the message.`;
}

async function write(text: string): Promise<string> {
  const gemini = Deno.env.get('GEMINI_API_KEY');
  for (const model of ['gemini-3.8-flash', 'gemini-3.5-flash']) {
    if (!gemini) break;
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', signal: AbortSignal.timeout(40_000), headers: { 'Content-Type': 'application/json', 'x-goog-api-key': gemini },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text }] }], generationConfig: { temperature: 0.9, maxOutputTokens: 4096 } }),
      });
      const d = await r.json();
      const out = (d?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? '').join('').trim();
      if (out) return out;
    } catch (e) { console.warn('outreach gemini', model, e instanceof Error ? e.message : e); }
  }
  const openai = Deno.env.get('OPENAI_API_KEY');
  if (openai) {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', signal: AbortSignal.timeout(40_000), headers: { Authorization: `Bearer ${openai}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-5-mini', reasoning_effort: 'low', messages: [{ role: 'user', content: text }] }),
    });
    const d = await r.json();
    const out = String(d?.choices?.[0]?.message?.content ?? '').trim();
    if (out) return out;
  }
  throw new Error('Le message n’a pas pu être écrit. Réessaie.');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const header = req.headers.get('Authorization') ?? '';
  const cron = Deno.env.get('PUBLISHER_CRON_TOKEN') ?? '';
  const operator = cron.length >= 32 && header === `Bearer ${cron}`;
  if (!operator) {
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: header } } });
    const { data: auth } = await userClient.auth.getUser();
    if (!auth.user) return json({ error: 'Veuillez vous reconnecter.' }, 401);
    const { data: me } = await admin.from('profiles').select('is_admin').eq('id', auth.user.id).single();
    if (!me?.is_admin) return json({ error: 'Réservé à l’administrateur.' }, 403);
  }
  const body = await req.json().catch(() => ({}));

  if (body.action === 'list') {
    const { data, error } = await admin.from('outreach_creators').select(COLS).order('created_at', { ascending: false }).limit(2000);
    if (error) return json({ error: error.message }, 500);
    const { data: partners } = await admin.from('affiliates').select('code, name');
    return json({ creators: data ?? [], partners: partners ?? [] });
  }

  if (body.action === 'add') {
    const handles = [...new Set((Array.isArray(body.handles) ? body.handles : String(body.handles ?? '').split(/[\s,;]+/)).map((h: string) => handleOf(String(h))).filter(Boolean))] as string[];
    if (!handles.length) return json({ error: 'Aucun compte TikTok reconnu. Colle des liens ou des @pseudos.' }, 400);
    const niche = typeof body.niche === 'string' && body.niche.trim() ? body.niche.trim().slice(0, 60) : 'Fruits IA';
    const { data, error } = await admin.from('outreach_creators').upsert(handles.slice(0, 200).map((handle) => ({ handle, niche })), { onConflict: 'handle', ignoreDuplicates: true }).select('id');
    if (error) return json({ error: error.message }, 500);
    return json({ added: data?.length ?? 0, recognised: handles.length });
  }

  if (typeof body.id !== 'string' || !/^[0-9a-f-]{36}$/.test(body.id)) return json({ error: 'Créateur inconnu.' }, 400);

  if (body.action === 'update') {
    const p = body.patch ?? {};
    const patch: Record<string, unknown> = {};
    if (typeof p.status === 'string' && STATUSES.includes(p.status)) {
      patch.status = p.status;
      if (p.status === 'contacted') { patch.contacted_at = new Date().toISOString(); patch.last_message_at = new Date().toISOString(); }
    }
    if (p.sent_follow_up === true) { patch.last_message_at = new Date().toISOString(); }
    if (typeof p.notes === 'string') patch.notes = p.notes.slice(0, 1000);
    if (typeof p.niche === 'string') patch.niche = p.niche.slice(0, 60);
    if (typeof p.display_name === 'string') patch.display_name = p.display_name.slice(0, 80);
    if (typeof p.message === 'string') patch.message = p.message.slice(0, 2000);
    if (p.followers === null || Number.isFinite(Number(p.followers))) patch.followers = p.followers === null || p.followers === '' ? null : Math.max(0, Math.round(Number(p.followers)));
    const { data, error } = await admin.from('outreach_creators').update(patch).eq('id', body.id).select(COLS).single();
    if (p.sent_follow_up === true && data) await admin.from('outreach_creators').update({ follow_up_count: (data.follow_up_count ?? 0) + 1 }).eq('id', body.id);
    if (error) return json({ error: error.message }, 500);
    return json({ creator: data });
  }

  if (body.action === 'remove') {
    await admin.from('outreach_creators').delete().eq('id', body.id);
    return json({ ok: true });
  }

  if (body.action === 'draft') {
    const { data: c } = await admin.from('outreach_creators').select(COLS).eq('id', body.id).single();
    if (!c) return json({ error: 'Créateur inconnu.' }, 404);
    const kind = body.kind === 'follow_up' ? 'follow_up' : 'first';
    try {
      const message = await write(prompt(c, kind));
      await admin.from('outreach_creators').update({ message }).eq('id', c.id);
      return json({ message });
    } catch (e) { return json({ error: e instanceof Error ? e.message : 'Erreur' }, 502); }
  }
  return json({ error: 'Action inconnue.' }, 400);
});
