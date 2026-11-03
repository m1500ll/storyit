// Token storage helpers (service role client only).
// deno-lint-ignore-file no-explicit-any
// Typed loosely so this module is also importable by the web app's tests (no Deno `npm:` specifier here).
type SupabaseClient = any;
import type { Platform } from './distribution.ts';
import { decrypt, encrypt, instagram, tiktok, type TokenSet } from './social.ts';
import { AuthExpiredError } from './worker.ts';
export { AuthExpiredError };

export async function saveTokens(db: SupabaseClient, accountId: string, t: TokenSet) {
  const { error } = await db.from('social_account_tokens').upsert({
    account_id: accountId, access_token: await encrypt(t.access_token), refresh_token: t.refresh_token ? await encrypt(t.refresh_token) : null,
    expires_at: t.expires_at ?? null, refresh_expires_at: t.refresh_expires_at ?? null, updated_at: new Date().toISOString(),
  });
  if (error) throw new Error('Could not store the account credentials');
}


const HOUR = 3600_000;
const DAY = 24 * HOUR;

export interface TokenRow { account_id: string; expires_at: string | null; refresh_expires_at: string | null; updated_at: string; platform: 'tiktok' | 'instagram' }
export type RefreshDecision = 'refresh' | 'expired' | 'reconnect_soon' | 'ok';

/**
 * What to do with a stored token, independently of whether the account is used (inactive accounts too).
 * Instagram long-lived token: valid 60 days from issue/refresh; refreshable only when ≥ 24 h old and not expired (Meta docs).
 * TikTok: access token ~24 h, renewed with the refresh token; the refresh token itself expires (refresh_expires_at).
 */
export function refreshDecision(t: TokenRow, now = Date.now()): RefreshDecision {
  const exp = t.expires_at ? Date.parse(t.expires_at) : Infinity;
  if (t.platform === 'instagram') {
    if (exp <= now) return 'expired';
    if (exp - now < 15 * DAY && now - Date.parse(t.updated_at) >= DAY) return 'refresh';
    return 'ok';
  }
  const rexp = t.refresh_expires_at ? Date.parse(t.refresh_expires_at) : Infinity;
  if (rexp <= now) return 'expired';
  if (exp - now < 2 * HOUR) return 'refresh';
  if (rexp - now < 14 * DAY) return 'reconnect_soon';
  return 'ok';
}

async function refreshNow(db: SupabaseClient, account: { id: string; platform: Platform }, row: Record<string, any>) {
  const fresh = account.platform === 'tiktok'
    ? await tiktok.refresh(await decrypt(row.refresh_token))
    : await instagram.refresh(await decrypt(row.access_token));
  await saveTokens(db, account.id, { ...fresh, refresh_token: fresh.refresh_token ?? (row.refresh_token ? await decrypt(row.refresh_token) : null) });
  return fresh.access_token;
}
async function markExpired(db: SupabaseClient, accountId: string, why = 'Authorization expired or revoked: reconnect the account') {
  await db.from('social_accounts').update({ status: 'expired', can_publish: false, last_error: why }).eq('id', accountId);
}

/** Valid access token for an account, refreshed when close to expiry. Marks the account expired when it can't. */
export async function accessToken(db: SupabaseClient, account: { id: string; platform: Platform }) {
  const { data: row } = await db.from('social_account_tokens').select('*').eq('account_id', account.id).maybeSingle();
  if (!row) throw new AuthExpiredError('No credentials stored: reconnect the account');
  const decision = refreshDecision({ ...(row as TokenRow), platform: account.platform });
  if (decision === 'expired') { await markExpired(db, account.id); throw new AuthExpiredError('Authorization expired: reconnect the account'); }
  const soon = row.expires_at && Date.parse(row.expires_at) < Date.now() + 10 * 60_000;
  if (!soon) return decrypt(row.access_token);
  try {
    return await refreshNow(db, account, row);
  } catch {
    await markExpired(db, account.id);
    throw new AuthExpiredError('Authorization expired or revoked: reconnect the account');
  }
}

/** Called by the worker every run: keeps tokens of inactive accounts alive and flags the ones that need a reconnect. */
export async function refreshDueTokens(db: SupabaseClient, limit = 20) {
  const soon = new Date(Date.now() + 15 * DAY).toISOString();
  const { data } = await db.from('social_account_tokens')
    .select('*, social_accounts!inner(id, platform, status)')
    .eq('social_accounts.status', 'connected')
    .or(`expires_at.lt.${soon},refresh_expires_at.lt.${soon}`)
    .limit(limit);
  const stats = { refreshed: 0, expired: 0, warned: 0, failed: 0 };
  for (const row of (data ?? []) as Record<string, any>[]) {
    const account = row.social_accounts as { id: string; platform: Platform };
    const decision = refreshDecision({ ...(row as TokenRow), platform: account.platform });
    try {
      if (decision === 'refresh') { await refreshNow(db, account, row); stats.refreshed++; }
      else if (decision === 'expired') { await markExpired(db, account.id); stats.expired++; }
      else if (decision === 'reconnect_soon') {
        await db.from('social_accounts').update({ last_error: `TikTok authorization ends on ${String(row.refresh_expires_at).slice(0, 10)}: reconnect the account before then` }).eq('id', account.id);
        stats.warned++;
      }
    } catch {
      // A failed refresh does not expire the token by itself; it is retried next run and flagged.
      await db.from('social_accounts').update({ last_error: 'Automatic token renewal failed; it will be retried. Reconnect if this persists.' }).eq('id', account.id);
      stats.failed++;
    }
  }
  return stats;
}
