// Supabase Edge Function: `dubbing` (video translation)
// - list: the caller's translations
// - create { source_path, language, voice_id?, replace_captions?, seconds, title? }: the video was uploaded by the browser
//   to library/<uid>/dubs/...; charges DUB_CREDITS_PER_MIN credits per started minute (default 15) and queues the job for
//   the render worker (dub/dub.py), which refunds the credits if it fails.
// - url { id, download? }: short-lived link to the finished video
// - delete { id }: removes a finished or failed translation (not the video already added to the library)
// Secrets: RENDER_WORKER_URL (…/wake, the worker is woken on …/wake-dub), RENDER_WORKER_TOKEN, optional DUB_CREDITS_PER_MIN.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

const LANGS = ['fr', 'en', 'es']; // the languages with curated voices (src/services/voices.ts)
const MAX_SECONDS = 180;
const PER_MIN = Number(Deno.env.get('DUB_CREDITS_PER_MIN') ?? '15');
export const dubCost = (seconds: number) => PER_MIN * Math.max(1, Math.ceil(seconds / 60));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const user = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: auth } = await user.auth.getUser();
  if (!auth.user) return json({ error: 'Veuillez vous reconnecter.' }, 401);
  const uid = auth.user.id;
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let body: { action?: string; id?: string; source_path?: string; language?: string; voice_id?: string; replace_captions?: boolean; seconds?: number; title?: string; download?: string };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  if (body.action === 'list') {
    const { data } = await admin.from('dub_jobs').select('id,title,target_language,status,step,progress,error,video_path,seconds,credits_charged,created_at,finished_at')
      .eq('user_id', uid).order('created_at', { ascending: false }).limit(50);
    return json({ jobs: data ?? [] });
  }

  if (body.action === 'create') {
    const path = body.source_path ?? '';
    if (!path.startsWith(`${uid}/dubs/`) || path.includes('..')) return json({ error: 'Fichier invalide.' }, 400);
    if (!LANGS.includes(body.language ?? '')) return json({ error: 'Langue inconnue.' }, 400);
    if (body.voice_id && !/^[A-Za-z0-9]{16,32}$/.test(body.voice_id)) return json({ error: 'Voix inconnue.' }, 400);
    const seconds = Number(body.seconds);
    if (!(seconds > 1)) return json({ error: 'Durée de la vidéo inconnue.' }, 400);
    if (seconds > MAX_SECONDS) return json({ error: 'La vidéo dépasse 3 minutes.' }, 400);
    const { data: obj } = await admin.storage.from('library').list(path.split('/').slice(0, -1).join('/'), { search: path.split('/').pop() });
    if (!obj?.length) return json({ error: "La vidéo n'a pas été trouvée. Réessayez l'envoi." }, 400);
    const cost = dubCost(seconds);
    const { error: credErr } = await user.rpc('consume_credits', { p_amount: cost, p_story_id: null, p_description: `Traduction vidéo (${body.language!.toUpperCase()}, ${Math.ceil(seconds / 60)} min)` });
    if (credErr) return json({ error: `Il vous faut ${cost} crédits pour traduire cette vidéo.`, code: 'insufficient_credits', needed: cost }, 402);
    const { data: job, error } = await admin.from('dub_jobs').insert({
      user_id: uid, source_path: path, target_language: body.language, voice_id: body.voice_id ?? null, replace_captions: body.replace_captions !== false,
      seconds, title: (body.title ?? '').slice(0, 160) || null, credits_charged: cost,
    }).select('id').single();
    if (error || !job) {
      await admin.rpc('grant_credits', { p_user_id: uid, p_amount: cost, p_type: 'refund', p_description: 'Traduction vidéo — remboursement (file indisponible)' });
      return json({ error: 'Impossible de lancer la traduction. Vos crédits ont été rendus.' }, 500);
    }
    const hook = Deno.env.get('RENDER_WORKER_URL')?.replace(/\/wake$/, '/wake-dub');
    if (hook) fetch(hook, { method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('RENDER_WORKER_TOKEN') ?? ''}` }, signal: AbortSignal.timeout(5000) }).catch(() => {});
    return json({ id: job.id, status: 'queued', credits: cost });
  }

  if (body.action === 'url' || body.action === 'delete') {
    if (!body.id) return json({ error: 'id manquant' }, 400);
    const { data: job } = await admin.from('dub_jobs').select('id,status,video_path,source_path,title,target_language').eq('id', body.id).eq('user_id', uid).maybeSingle();
    if (!job) return json({ error: 'Traduction introuvable.' }, 404);
    if (body.action === 'url') {
      if (!job.video_path) return json({ error: "La vidéo n'est pas encore prête." }, 409);
      const opts = body.download ? { download: body.download } : undefined;
      const { data } = await admin.storage.from('library').createSignedUrl(job.video_path, 3600, opts);
      return json({ url: data?.signedUrl ?? null });
    }
    if (job.status === 'queued' || job.status === 'working') return json({ error: 'Cette traduction est en cours.' }, 409);
    await admin.storage.from('library').remove([job.source_path]);
    await admin.from('dub_jobs').delete().eq('id', job.id);
    return json({ ok: true });
  }

  return json({ error: 'Action inconnue' }, 400);
});
