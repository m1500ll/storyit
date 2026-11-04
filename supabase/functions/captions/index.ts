// Supabase Edge Function: `captions` — writes one caption variant per publication (video × account × platform).
// Manual edits are never overwritten unless the user explicitly forces a regeneration of that one post.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { generateVariant } from '../_shared/captions.ts';
import { reserveAi } from '../_shared/aiBudget.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return json({ error: 'Please sign in again.' }, 401);
  let body: { publication_ids?: string[]; force?: boolean };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const ids = (body.publication_ids ?? []).slice(0, 50);
  if (!ids.length) return json({ error: 'No publication selected' }, 400);
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) return json({ error: 'AI captions are not configured: write the captions manually.' }, 503);

  // RLS: only the user's own publications come back.
  const { data: pubs } = await db.from('scheduled_publications')
    .select('id, platform, status, caption_edited, media_assets(title, notes, tags), social_accounts(username, editorial)').in('id', ids);
  const results: { id: string; ok: boolean; error?: string; skipped?: string }[] = [];
  for (const p of (pubs ?? []) as any[]) {
    if (!['draft', 'scheduled', 'failed'].includes(p.status)) { results.push({ id: p.id, ok: false, skipped: 'Already being published' }); continue; }
    if (p.caption_edited && !body.force) { results.push({ id: p.id, ok: false, skipped: 'Kept your manual edit' }); continue; }
    try {
      await reserveAi('caption');
      const v = await generateVariant(key, MODEL, p.platform, p.media_assets, p.social_accounts?.editorial ?? {}, p.social_accounts ?? {});
      const { error } = await db.from('scheduled_publications').update({
        caption: v.caption, hook: v.hook, hashtags: v.hashtags, title: v.title, metadata_warnings: v.warnings, metadata_source: 'ai', caption_edited: false, metadata_approved: false,
      }).eq('id', p.id);
      if (error) throw new Error(error.message);
      results.push({ id: p.id, ok: true });
    } catch (e) {
      results.push({ id: p.id, ok: false, error: e instanceof Error ? e.message.slice(0, 160) : 'AI error' });
    }
  }
  return json({ results });
});
