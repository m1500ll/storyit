// Token storage helpers (service role client only).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
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


/** Valid access token for an account, refreshed when close to expiry. Marks the account expired when it can't. */
export async function accessToken(db: SupabaseClient, account: { id: string; platform: Platform }) {
  const { data: row } = await db.from('social_account_tokens').select('*').eq('account_id', account.id).maybeSingle();
  if (!row) throw new AuthExpiredError('No credentials stored: reconnect the account');
  const soon = row.expires_at && Date.parse(row.expires_at) < Date.now() + 10 * 60_000;
  if (!soon) return decrypt(row.access_token);
  try {
    const fresh = account.platform === 'tiktok'
      ? await tiktok.refresh(await decrypt(row.refresh_token))
      : await instagram.refresh(await decrypt(row.access_token));
    await saveTokens(db, account.id, { ...fresh, refresh_token: fresh.refresh_token ?? (row.refresh_token ? await decrypt(row.refresh_token) : null) });
    return fresh.access_token;
  } catch {
    await db.from('social_accounts').update({ status: 'expired', can_publish: false, last_error: 'Authorization expired or revoked: reconnect the account' }).eq('id', account.id);
    throw new AuthExpiredError('Authorization expired or revoked: reconnect the account');
  }
}
