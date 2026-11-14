// Supabase Edge Function: `trends` — daily trend reports ("veille") for the Creative Studio.
// - import { report, day? }  admin only (profiles.is_admin): parses the pasted report and replaces that day's concepts
// - delete { day }           admin only
// Customers read the concepts directly (RLS: signed-in read).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { parseTrendReport } from '../_shared/trends.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const auth = req.headers.get('Authorization') ?? '';
  const { data: u } = await admin.auth.getUser(auth.replace(/^Bearer\s+/, ''));
  if (!u.user) return json({ error: 'Veuillez vous reconnecter.' }, 401);
  const { data: me } = await admin.from('profiles').select('is_admin').eq('id', u.user.id).single();
  if (!me?.is_admin) return json({ error: 'Réservé à l’administrateur.' }, 403);
  let body: { action?: string; report?: string; day?: string };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const day = /^\d{4}-\d{2}-\d{2}$/.test(body.day ?? '') ? body.day! : new Date().toISOString().slice(0, 10);

  if (body.action === 'import') {
    const report = String(body.report ?? '');
    if (report.length < 50) return json({ error: 'Collez le rapport complet.' }, 400);
    if (report.length > 400_000) return json({ error: 'Rapport trop long (400 000 caractères maximum).' }, 400);
    const { insights, concepts } = parseTrendReport(report);
    if (!concepts.length) return json({ error: 'Aucun concept trouvé : chaque concept doit commencer par « #1 — Titre | … ».' }, 400);
    const { error: e1 } = await admin.from('trend_reports').upsert({ day, insights });
    if (e1) return json({ error: e1.message }, 500);
    await admin.from('trend_concepts').delete().eq('day', day);
    const { error: e2 } = await admin.from('trend_concepts').insert(concepts.map((c) => ({ ...c, day })));
    if (e2) return json({ error: e2.message }, 500);
    const missing = concepts.filter((c) => !c.hook).map((c) => c.number);
    return json({ day, concepts: concepts.length, hits: concepts.filter((c) => c.kind === 'hit').length, green: concepts.filter((c) => c.fr_status === 'green').length, without_hook: missing, insights_chars: insights.length });
  }
  if (body.action === 'delete') {
    await admin.from('trend_reports').delete().eq('day', day);
    return json({ ok: true });
  }
  return json({ error: 'Action inconnue' }, 400);
});
