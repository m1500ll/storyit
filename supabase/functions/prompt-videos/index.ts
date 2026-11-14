// Supabase Edge Function: `prompt-videos` — turns a Creative Studio project into a finished video.
// - list { project_id? }: the caller's videos (newest first)
// - create { project_id, quality }: charges the tier's price (credits per minute of clips), freezes the prompts and
//   queues the job for the render worker (render-engine/promptvideo/run.py), which refunds the credits if it fails
// - url { id, download? }: short-lived link to the finished video
// - worker_keys: the image (OpenAI) and video (xAI) keys for the render worker only (Bearer RENDER_WORKER_TOKEN), so
//   these keys live in one place (Edge Function secrets)
// Secrets: OPENAI_API_KEY, XAI_API_KEY, RENDER_WORKER_URL (…/wake; the worker is woken on …/wake-prompt), RENDER_WORKER_TOKEN.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildVideoPlan, firstClips, isQuality, projectSeconds, videoBlocker, videoCost, AVAILABLE_QUALITIES } from '../_shared/promptVideo.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const COLS = 'id,project_id,title,quality,seconds,status,step,progress,error,video_path,cover_path,asset_id,credits_charged,created_at,finished_at';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  let body: { action?: string; id?: string; project_id?: string; quality?: string; download?: string; max_seconds?: number };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  if (body.action === 'worker_keys') {
    const token = Deno.env.get('RENDER_WORKER_TOKEN') ?? '';
    if (token.length < 16 || !same(req.headers.get('Authorization') ?? '', `Bearer ${token}`)) return json({ error: 'Forbidden' }, 403);
    return json({ openai: Deno.env.get('OPENAI_API_KEY') ?? null, xai: Deno.env.get('XAI_API_KEY') ?? null });
  }

  const user = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: auth } = await user.auth.getUser();
  if (!auth.user) return json({ error: 'Veuillez vous reconnecter.' }, 401);
  const uid = auth.user.id;
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  if (body.action === 'list') {
    let q = admin.from('prompt_videos').select(COLS).eq('user_id', uid).order('created_at', { ascending: false }).limit(30);
    if (body.project_id) q = q.eq('project_id', body.project_id);
    const { data } = await q;
    return json({ videos: data ?? [] });
  }

  if (body.action === 'create') {
    if (!body.quality) body.quality = 'eco';
    if (!isQuality(body.quality)) return json({ error: 'Qualité inconnue.' }, 400);
    if (!AVAILABLE_QUALITIES.includes(body.quality)) return json({ error: 'Cette qualité n’est plus proposée : la vidéo se fait en qualité Éco.' }, 400);
    if (!Deno.env.get('OPENAI_API_KEY') || !Deno.env.get('XAI_API_KEY')) return json({ error: 'La génération vidéo n’est pas encore disponible.' }, 503);
    const { data: project } = await admin.from('prompt_projects').select('id, data').eq('id', body.project_id ?? '').eq('user_id', uid).maybeSingle();
    if (!project) return json({ error: 'Projet introuvable.' }, 404);
    const blocker = videoBlocker(project.data);
    if (blocker) return json({ error: blocker }, 409);
    // Free pre-flight: when Storyit's Grok account is out of credits, every API call answers 403. Refuse before charging
    // instead of letting the customer wait for a failure and a refund. A network hiccup here does not block the video.
    const grok = await fetch('https://api.x.ai/v1/models', { headers: { Authorization: `Bearer ${Deno.env.get('XAI_API_KEY')}` }, signal: AbortSignal.timeout(6_000) })
      .then(async (r) => ({ status: r.status, text: r.ok ? '' : await r.text() })).catch(() => ({ status: 0, text: '' }));
    if (grok.status === 403 || grok.status === 401 || grok.status === 429) {
      console.error('grok unavailable', grok.status, grok.text.slice(0, 200));
      return json({ error: 'La vidéo automatique est momentanément indisponible (maintenance de notre fournisseur d’animation). Réessayez un peu plus tard : aucun crédit n’a été utilisé.', code: 'provider_unavailable' }, 503);
    }
    const { count } = await admin.from('prompt_videos').select('id', { count: 'exact', head: true }).eq('user_id', uid).in('status', ['queued', 'working']);
    if ((count ?? 0) >= 2) return json({ error: 'Deux vidéos sont déjà en cours. Attendez qu’une soit terminée.' }, 429);
    let data = project.data;
    if (body.max_seconds) { // admin test: only the first clips that fit in max_seconds
      const { data: me } = await admin.from('profiles').select('is_admin').eq('id', uid).single();
      if (!me?.is_admin) return json({ error: 'Réservé à l’administrateur.' }, 403);
      const clips = firstClips(data.script.clips, Number(body.max_seconds));
      data = { ...data, script: { ...data.script, clips: data.script.clips.slice(0, clips) } };
    }
    const seconds = projectSeconds(data);
    const cost = videoCost(body.quality, seconds);
    const plan = buildVideoPlan(data, body.quality);
    // the picked characters' sheets: links the worker can download (library sheets are public files of the site)
    const refs = plan.sheet_refs ?? [];
    const own = refs.filter((r) => r.startsWith('storage:')).map((r) => r.slice(8));
    const { data: signed } = own.length ? await admin.storage.from('characters').createSignedUrls(own, 3 * 86_400) : { data: [] };
    (plan as Record<string, unknown>).sheet_ref_urls = refs.map((r) => r.startsWith('storage:') ? signed?.find((x) => x.path === r.slice(8))?.signedUrl : `https://www.storyit.fun${r}`).filter(Boolean);
    const { error: credErr } = await user.rpc('consume_credits', { p_amount: cost, p_story_id: null, p_description: `Vidéo Creative Studio (${body.quality}, ${Math.round(seconds)} s)` });
    if (credErr) return json({ error: `Il vous faut ${cost} crédits pour cette vidéo.`, code: 'insufficient_credits', needed: cost }, 402);
    const { data: job, error } = await admin.from('prompt_videos').insert({
      user_id: uid, project_id: project.id, title: plan.title, quality: body.quality, seconds, plan, credits_charged: cost,
    }).select(COLS).single();
    if (error || !job) {
      await admin.rpc('grant_credits', { p_user_id: uid, p_amount: cost, p_type: 'refund', p_description: 'Vidéo Creative Studio — remboursement (file indisponible)' });
      return json({ error: 'Impossible de lancer la vidéo. Vos crédits ont été rendus.' }, 500);
    }
    const hook = Deno.env.get('RENDER_WORKER_URL')?.replace(/\/wake$/, '/wake-prompt');
    if (hook) await fetch(hook, { method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('RENDER_WORKER_TOKEN') ?? ''}` }, signal: AbortSignal.timeout(5000) }).catch(() => {});
    return json({ video: job, credits: cost });
  }

  if (body.action === 'url') {
    const { data: job } = await admin.from('prompt_videos').select('video_path').eq('id', body.id ?? '').eq('user_id', uid).maybeSingle();
    if (!job) return json({ error: 'Vidéo introuvable.' }, 404);
    if (!job.video_path) return json({ error: "La vidéo n'est pas encore prête." }, 409);
    const { data } = await admin.storage.from('library').createSignedUrl(job.video_path, 3600, body.download ? { download: body.download } : undefined);
    return json({ url: data?.signedUrl ?? null });
  }

  return json({ error: 'Action inconnue' }, 400);
});
