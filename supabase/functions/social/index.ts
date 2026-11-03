// Supabase Edge Function: `social` — connects TikTok / Instagram accounts with the platforms' official OAuth.
// Deploy with verify_jwt OFF (the OAuth callback is a browser redirect); every other action checks the user JWT itself.
// Secrets: TOKEN_ENCRYPTION_KEY, APP_URL, TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, [TIKTOK_APP_AUDITED], INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { adapters, decrypt, instagram, tiktok, type Profile } from '../_shared/social.ts';
import { accessToken, saveTokens } from '../_shared/tokens.ts';
import { checkState, oauthError } from '../_shared/oauth.ts';
import type { Platform } from '../_shared/distribution.ts';

const URL_BASE = Deno.env.get('SUPABASE_URL')!;
const APP_URL = Deno.env.get('APP_URL') ?? 'http://localhost:5173';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const redirect = (to: string) => new Response(null, { status: 302, headers: { Location: to } });
const admin = createClient(URL_BASE, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const callbackUri = (p: Platform) => `${URL_BASE}/functions/v1/social/callback/${p}`;
const isPlatform = (p: unknown): p is Platform => p === 'tiktok' || p === 'instagram';

async function audit(userId: string, action: string, detail: Record<string, unknown>) {
  console.log(JSON.stringify({ audit: action, user: userId, ...detail })); // no tokens in here, ever
}

async function callback(platform: Platform, url: URL) {
  const back = (q: Record<string, string>) => redirect(`${APP_URL}/app/accounts?${new URLSearchParams(q)}`);
  const state = url.searchParams.get('state') ?? '';
  const code = url.searchParams.get('code');
  // CSRF: the state must exist, match the platform, be < 10 min old, and is consumed once.
  const { data: st } = await admin.from('oauth_states').delete().eq('state', state).select().maybeSingle();
  const valid = checkState(st, platform);
  if (!valid.ok) return back({ error: valid.reason });
  if (!code) return back({ error: oauthError(url.searchParams) });

  try {
    const tokens = await adapters[platform].exchange(code, callbackUri(platform));
    const profile: Profile = await adapters[platform].profile(tokens.access_token, tokens.scopes);
    if (!profile.external_id) throw new Error('The platform did not return the account id');

    const { data: existing } = await admin.from('social_accounts').select('id, user_id').eq('platform', platform).eq('external_id', profile.external_id).maybeSingle();
    if (existing && existing.user_id !== st.user_id) {
      await audit(st.user_id, 'connect_refused_other_owner', { platform });
      return back({ error: 'This account is already connected to another Storyit workspace.' });
    }
    if (!existing) {
      const { data: limit } = await admin.rpc('plan_limit', { p_user: st.user_id, p_field: 'max_social_accounts' });
      const { count } = await admin.from('social_accounts').select('id', { count: 'exact', head: true }).eq('user_id', st.user_id).neq('status', 'disconnected');
      if (typeof limit === 'number' && (count ?? 0) >= limit) return back({ error: `Your plan allows ${limit} connected accounts.` });
    }
    const row = {
      user_id: st.user_id, platform, external_id: profile.external_id, username: profile.username, display_name: profile.display_name,
      avatar_url: profile.avatar_url, scopes: profile.scopes, account_type: profile.account_type ?? null, status: 'connected',
      can_publish: profile.can_publish, publish_restriction: profile.publish_restriction, last_verified_at: new Date().toISOString(), last_error: null,
    };
    const { data: acc, error } = existing
      ? await admin.from('social_accounts').update(row).eq('id', existing.id).select('id').single()
      : await admin.from('social_accounts').insert(row).select('id').single();
    if (error || !acc) throw new Error('Could not save the account');
    await saveTokens(admin, acc.id, tokens);
    await audit(st.user_id, existing ? 'reconnect' : 'connect', { platform, account: acc.id });
    return back({ connected: profile.username ?? platform });
  } catch (e) {
    console.error('oauth callback', platform, e instanceof Error ? e.message : e);
    return back({ error: `Connection failed: ${e instanceof Error ? e.message.slice(0, 120) : 'unknown error'}` });
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = new URL(req.url);
  const cb = url.pathname.match(/\/social\/callback\/(tiktok|instagram)\/?$/);
  if (cb && req.method === 'GET') return callback(cb[1] as Platform, url);

  const userClient = createClient(URL_BASE, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: auth } = await userClient.auth.getUser();
  if (!auth.user) return json({ error: 'Please sign in again.' }, 401);
  let body: { action?: string; platform?: string; account_id?: string };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  switch (body.action) {
    case 'status':
      return json({ tiktok: tiktok.configured(), instagram: instagram.configured(), encryption: Boolean(Deno.env.get('TOKEN_ENCRYPTION_KEY')), ai: Boolean(Deno.env.get('GEMINI_API_KEY')) });

    case 'start': {
      if (!isPlatform(body.platform)) return json({ error: 'Unknown platform' }, 400);
      if (!adapters[body.platform].configured() || !Deno.env.get('TOKEN_ENCRYPTION_KEY')) {
        return json({ error: `${body.platform === 'tiktok' ? 'TikTok' : 'Instagram'} connection is not configured on this Storyit server yet.` }, 503);
      }
      const state = crypto.randomUUID() + crypto.randomUUID().replaceAll('-', '');
      await admin.from('oauth_states').delete().lt('created_at', new Date(Date.now() - 3600_000).toISOString());
      const { error } = await admin.from('oauth_states').insert({ state, user_id: auth.user.id, platform: body.platform });
      if (error) return json({ error: 'Could not start the connection' }, 500);
      return json({ url: adapters[body.platform].authorizeUrl(callbackUri(body.platform), state) });
    }

    case 'creator_info': {
      // Live TikTok creator info, required right before posting (Content Sharing Guidelines).
      const { data: acc } = await userClient.from('social_accounts').select('id, platform').eq('id', body.account_id ?? '').maybeSingle();
      if (!acc || acc.platform !== 'tiktok') return json({ error: 'TikTok account not found' }, 404);
      try {
        return json(await tiktok.creatorInfo(await accessToken(admin, acc as { id: string; platform: Platform })));
      } catch (e) {
        return json({ error: e instanceof Error ? e.message.slice(0, 200) : 'Could not reach TikTok' }, 502);
      }
    }

    case 'verify':
    case 'disconnect': {
      // Ownership via RLS on the user client.
      const { data: acc } = await userClient.from('social_accounts').select('id, platform, user_id').eq('id', body.account_id ?? '').maybeSingle();
      if (!acc) return json({ error: 'Account not found' }, 404);
      if (body.action === 'disconnect') {
        const { data: tok } = await admin.from('social_account_tokens').select('access_token').eq('account_id', acc.id).maybeSingle();
        if (tok && acc.platform === 'tiktok') await tiktok.revoke(await decrypt(tok.access_token).catch(() => ''));
        await admin.from('social_account_tokens').delete().eq('account_id', acc.id);
        await admin.from('scheduled_publications').update({ status: 'cancelled', last_error: 'Account disconnected' })
          .eq('account_id', acc.id).in('status', ['draft', 'scheduled', 'queued']);
        await admin.from('social_accounts').update({ status: 'disconnected', can_publish: false, last_error: null }).eq('id', acc.id);
        await audit(auth.user.id, 'disconnect', { account: acc.id });
        return json({ ok: true });
      }
      try {
        const token = await accessToken(admin, acc as { id: string; platform: Platform });
        const { data: full } = await admin.from('social_accounts').select('scopes').eq('id', acc.id).single();
        const p = await adapters[acc.platform as Platform].profile(token, full?.scopes ?? []);
        await admin.from('social_accounts').update({
          username: p.username, display_name: p.display_name, avatar_url: p.avatar_url, can_publish: p.can_publish, publish_restriction: p.publish_restriction,
          account_type: p.account_type ?? null, status: 'connected', last_verified_at: new Date().toISOString(), last_error: null,
        }).eq('id', acc.id);
        return json({ ok: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message.slice(0, 200) : 'Verification failed';
        const auth401 = /401|expired|revoked|invalid.*token/i.test(msg);
        await admin.from('social_accounts').update({ status: auth401 ? 'expired' : 'error', last_error: msg, last_verified_at: new Date().toISOString() }).eq('id', acc.id);
        return json({ error: msg }, 502);
      }
    }
    default:
      return json({ error: 'Unknown action' }, 400);
  }
});
