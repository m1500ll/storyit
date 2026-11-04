// Supabase Edge Function: `publisher` — server-side distribution worker, called every minute by pg_cron.
// 1) plans rotation campaigns (today + tomorrow, local time), 2) claims due publications atomically,
// 3) publishes through the official APIs, 4) polls asynchronous processing until the platform confirms.
// Only the service role may call it.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  addDays, BLOCKING, destKey, localDate, planRotationDay,
  type DestinationKey, type RotationConfig, type TargetAccount,
} from '../_shared/distribution.ts';
import { generateVariant } from '../_shared/captions.ts';
import { instagram, tiktok } from '../_shared/social.ts';
import { accessToken, refreshDueTokens } from '../_shared/tokens.ts';
import { poll, start, type WorkerDeps } from '../_shared/worker.ts';

const deps: WorkerDeps = { accessToken, tiktok, instagram, fetchFile: (url, range) => fetch(url, { ...(range ? { headers: { Range: range } } : {}), signal: AbortSignal.timeout(120_000) }) };

const BUDGET_MS = 100_000;
const WORKER = `w-${crypto.randomUUID().slice(0, 8)}`;
function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

type Pub = Record<string, any>;


// ---------- 1. Rotation planner ----------

async function planCampaigns(db: SupabaseClient) {
  const { data: campaigns } = await db.from('campaigns').select('*').eq('mode', 'rotation').eq('status', 'active');
  for (const c of campaigns ?? []) {
    const today = localDate(new Date(), c.timezone);
    const horizon = addDays(today, 1);
    let day = c.planned_until && c.planned_until >= today ? addDays(c.planned_until, 1) : today;
    if (day > horizon) continue;
    const cfg = c.config as RotationConfig & { auto_approve?: boolean };

    // Independent reads in parallel.
    const [{ data: targets }, { data: lib }] = await Promise.all([
      db.from('campaign_targets').select('bucket, social_accounts!inner(id, platform, status, can_publish, username, editorial)').eq('campaign_id', c.id),
      db.from('media_assets').select('id, created_at, tags, title, notes').eq('user_id', c.user_id).eq('status', 'available'),
    ]);
    const accounts = (targets ?? []).map((t: any) => ({ ...t.social_accounts, bucket: t.bucket }))
      .filter((a: any) => a.status === 'connected');
    const ids = accounts.map((a: any) => a.id);
    const { data: prior } = ids.length
      ? await db.from('scheduled_publications').select('media_id, account_id').in('account_id', ids).in('status', BLOCKING)
      : { data: [] };
    const existing = new Set<DestinationKey>((prior ?? []).map((p: Pub) => destKey(p.media_id, p.account_id)));

    let alert: string | null = null;
    let paused = false;
    for (; day <= horizon; day = addDays(day, 1)) {
      const plan = planRotationDay(c.id, day, cfg, accounts as TargetAccount[], lib ?? [], existing, c.timezone);
      for (const p of plan.planned) {
        const account = accounts.find((a: any) => a.id === p.account_id)!;
        const video = (lib ?? []).find((v: Pub) => v.id === p.media_id)!;
        const row: Pub = { ...p, user_id: c.user_id, campaign_id: c.id, status: 'scheduled' };
        if (p.platform === 'tiktok') {
          // TikTok requires the user to choose visibility/disclosure and accept the declaration for each post.
          row.metadata_warnings = ['TikTok: confirm visibility, disclosure and declaration, then approve this post'];
        } else if (cfg.auto_approve) {
          try {
            const v = await generateVariant(Deno.env.get('GEMINI_API_KEY') ?? '', Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash', p.platform,
              { title: video.title, notes: video.notes, tags: video.tags }, account.editorial ?? {}, account);
            Object.assign(row, { caption: v.caption, hook: v.hook, hashtags: v.hashtags, title: v.title, metadata_warnings: v.warnings, metadata_source: 'ai', metadata_approved: true });
          } catch (e) {
            row.metadata_warnings = [`Caption not generated (${e instanceof Error ? e.message.slice(0, 80) : 'AI error'}): write it and approve this post`];
          }
        }
        // Idempotent: the idempotency key and the one-per-destination index make re-planning harmless.
        const { error } = await db.from('scheduled_publications').insert(row);
        if (error && error.code !== '23505') console.error('plan insert', error.message);
      }
      if (plan.shortfall > 0 && plan.reason?.startsWith('Not enough')) {
        alert = `Library ran short on ${day}: ${plan.videosUsed.length}/${cfg.videos_per_day} new videos available. Old videos are never reposted automatically.`;
        if (cfg.empty_policy === 'pause' && plan.videosUsed.length === 0) { paused = true; break; }
      }
      if (plan.reason === 'No account selected') alert = 'No connected account left in this campaign.';
    }
    await db.from('campaigns').update({ planned_until: paused ? c.planned_until : horizon, alert, ...(paused ? { status: 'paused' } : {}) }).eq('id', c.id);
  }
}

// ---------- 2-4. Execute publications ----------

Deno.serve(async (req) => {
  // Only the scheduler may call this: a dedicated random token, kept in the function secrets and in the database Vault.
  const token = Deno.env.get('PUBLISHER_CRON_TOKEN');
  const given = req.headers.get('Authorization') ?? '';
  if (!token || token.length < 32 || !timingSafeEqual(given, `Bearer ${token}`)) return json({ error: 'Forbidden' }, 403);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const started = Date.now();
  const stats = { started: 0, polled: 0 };

  // Emergency stop without touching the database: set the secret PUBLISHER_DISABLED=true.
  if (Deno.env.get('PUBLISHER_DISABLED') === 'true') return json({ ok: true, disabled: true });
  const tokens = await refreshDueTokens(db).catch((e) => { console.error('token refresh', e); return null; });
  await planCampaigns(db).catch((e) => console.error('planner', e));
  while (Date.now() - started < BUDGET_MS - 30_000) {
    const { data: batch, error } = await db.rpc('claim_publications', { p_worker: WORKER, p_limit: 5 });
    if (error) { console.error('claim', error.message); break; }
    if (!batch?.length) break;
    await Promise.all((batch as Pub[]).map(async (p) => {
      if (p.status === 'submitted') { stats.polled++; return poll(db, p, deps); }
      stats.started++; return start(db, p, deps);
    }));
  }
  return json({ ok: true, ...stats, tokens, worker: WORKER });
});

