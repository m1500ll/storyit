// Publication worker steps (start upload, poll status, handle errors). Dependencies are injected so the
// exact same code runs in the `publisher` Edge Function and in automated tests with fake platforms.
import { backoffMs, classifyHttp } from './distribution.ts';
import { finalCaption } from './captions.ts';
import { PlatformError, type instagram as IG, type tiktok as TT } from './social.ts';
import { checkVideo } from './platformSpecs.ts';

// deno-lint-ignore no-explicit-any
export type Db = any;
// deno-lint-ignore no-explicit-any
export type Pub = Record<string, any>;
export class AuthExpiredError extends Error {}
export interface WorkerDeps {
  accessToken: (db: Db, account: { id: string; platform: 'tiktok' | 'instagram' }) => Promise<string>;
  tiktok: Pick<typeof TT, 'submit' | 'poll'>;
  instagram: Pick<typeof IG, 'submit' | 'poll' | 'publish'>;
  /** Fetches the video (optionally a byte range) from a short-lived signed URL. */
  fetchFile: (url: string, range?: string) => Promise<Response>;
}

const POLL_EVERY_MS = 45_000;
const SUBMITTED_TIMEOUT_MS = 3 * 3600_000;

export async function event(db: Db, pub: Pub, type: string, detail: Record<string, unknown> = {}) {
  await db.from('publication_events').insert({ publication_id: pub.id, user_id: pub.user_id, type, detail });
}
export const set = (db: Db, id: string, patch: Record<string, unknown>) =>
  db.from('scheduled_publications').update({ locked_at: null, locked_by: null, ...patch }).eq('id', id);

export async function fail(db: Db, pub: Pub, e: unknown, sent: boolean) {
  const msg = (e instanceof Error ? e.message : String(e)).slice(0, 300);
  if (e instanceof AuthExpiredError) {
    await set(db, pub.id, { status: 'failed', last_error: `${msg}. After reconnecting, use "Retry".`, send_started_at: null });
    return;
  }
  // Adapters know precisely whether the platform may have received the video (e.sent); for any other
  // unexpected error after the upload started, assume it might have and never resend.
  const kind = e instanceof PlatformError ? classifyHttp(e.status, e.sent) : classifyHttp(null, sent);
  if (kind === 'uncertain') {
    // The platform may have received the video: never re-send automatically.
    const ref = e instanceof PlatformError && e.code?.startsWith('publish_id:') ? { external_id: e.code.slice(11) } : {};
    await set(db, pub.id, { ...ref, status: 'needs_attention', last_error: `Uncertain result (${msg}). Check the account before doing anything: the video may already be posted.` });
    return;
  }
  const retry = (kind === 'retryable' || kind === 'rate_limited') && pub.attempts < pub.max_attempts;
  await set(db, pub.id, retry
    ? { status: 'scheduled', next_attempt_at: new Date(Date.now() + backoffMs(pub.attempts) * (kind === 'rate_limited' ? 4 : 1)).toISOString(), last_error: msg, send_started_at: null }
    : { status: 'failed', last_error: msg, send_started_at: null });
}

export async function start(db: Db, pub: Pub, deps: WorkerDeps) {
  const { accessToken, tiktok, instagram } = deps;
  // A previous worker died after starting the upload → uncertain.
  if (pub.send_started_at && !pub.external_id) {
    await set(db, pub.id, { status: 'needs_attention', last_error: 'The upload was interrupted. Check the account: the video may already be posted.' });
    return;
  }
  await db.from('scheduled_publications').update({ attempts: pub.attempts + 1 }).eq('id', pub.id);
  pub.attempts += 1;

  const [{ data: media }, { data: account }] = await Promise.all([
    db.from('media_assets').select('*').eq('id', pub.media_id).single(),
    db.from('social_accounts').select('*').eq('id', pub.account_id).single(),
  ]);
  if (!media || media.user_id !== pub.user_id || media.status !== 'available') return set(db, pub.id, { status: 'failed', last_error: 'Video is not available any more' });
  if (!account || account.user_id !== pub.user_id) return set(db, pub.id, { status: 'failed', last_error: 'Account not found' });
  if (account.status !== 'connected') return set(db, pub.id, { status: 'failed', last_error: `Account ${account.status}: reconnect it, then retry` });
  if (!account.can_publish) return set(db, pub.id, { status: 'failed', last_error: account.publish_restriction ?? 'This account cannot publish through the API' });
  const text = finalCaption(pub.caption, pub.hashtags ?? []);
  if (text.length > 2200) return set(db, pub.id, { status: 'failed', last_error: 'Caption is longer than 2200 characters' });
  const specErrors = checkVideo(account.platform, media).filter((i) => i.level === 'error');
  if (specErrors.length) return set(db, pub.id, { status: 'failed', last_error: specErrors.map((i) => i.message).join(' · ') });
  const tt = pub.platform_options ?? {};
  if (account.platform === 'tiktok' && (!tt.privacy_level || !tt.consented_at)) {
    return set(db, pub.id, { status: 'failed', last_error: 'TikTok settings (visibility, disclosure, declaration) were not confirmed: open the post, confirm them, then retry' });
  }
  // Belt and braces on top of the unique index.
  const { count } = await db.from('scheduled_publications').select('id', { count: 'exact', head: true })
    .eq('media_id', pub.media_id).eq('account_id', pub.account_id).in('status', ['published', 'submitted', 'needs_attention']).neq('id', pub.id);
  if (count) return set(db, pub.id, { status: 'cancelled', last_error: 'Duplicate: this video is already on this account' });

  let sent = false;
  try {
    const token = await accessToken(db, account);
    const { data: signed } = await db.storage.from('library').createSignedUrl(media.storage_path, 3600);
    if (!signed?.signedUrl) throw new PlatformError('Could not prepare the video file', 500, false);
    await db.from('scheduled_publications').update({ send_started_at: new Date().toISOString() }).eq('id', pub.id);
    sent = true;
    let externalId: string;
    if (account.platform === 'tiktok') {
      const readChunk = async (start: number, end: number) => {
        const r = await deps.fetchFile(signed.signedUrl, `bytes=${start}-${end}`);
        if (r.status !== 206 && !(r.ok && start === 0 && end === Number(media.size_bytes) - 1)) throw new Error(`storage returned ${r.status}`);
        const buf = new Uint8Array(await r.arrayBuffer());
        if (buf.length !== end - start + 1) throw new Error('incomplete chunk');
        return buf;
      };
      externalId = await tiktok.submit(token, { caption: text, size: Number(media.size_bytes), durationSeconds: media.duration_seconds, readChunk, tiktok: tt });
    } else {
      externalId = await instagram.submit(token, account.external_id, { caption: text, size: Number(media.size_bytes), videoUrl: signed.signedUrl });
    }
    await set(db, pub.id, { status: 'submitted', external_id: externalId, next_attempt_at: new Date(Date.now() + POLL_EVERY_MS).toISOString(), last_error: null });
    await event(db, pub, 'submitted', { platform: account.platform });
  } catch (e) {
    await fail(db, pub, e, sent);
  }
}

export async function poll(db: Db, pub: Pub, deps: WorkerDeps) {
  const { accessToken, tiktok, instagram } = deps;
  const { data: account } = await db.from('social_accounts').select('*').eq('id', pub.account_id).single();
  const now = new Date().toISOString();
  try {
    const token = await accessToken(db, account);
    const r = account.platform === 'tiktok' ? await tiktok.poll(token, pub.external_id) : await instagram.poll(token, pub.external_id);
    if (r.state === 'ready_to_publish') {
      // Instagram step 2. A timeout here is uncertain (the post may be live) → needs_attention via fail().
      const done = await instagram.publish(token, account.external_id, pub.external_id).catch((e) => { throw Object.assign(e, { sent: true }); });
      await set(db, pub.id, { status: 'published', published_at: now, external_post_id: done.postId, external_url: done.url, last_checked_at: now, last_error: null });
    } else if (r.state === 'published') {
      await set(db, pub.id, { status: 'published', published_at: now, external_post_id: r.postId ?? null, external_url: r.url ?? null, last_checked_at: now, last_error: r.note ?? null });
    } else if (r.state === 'failed') {
      await set(db, pub.id, { status: 'failed', last_error: r.reason, last_checked_at: now });
    } else if (Date.now() - Date.parse(pub.updated_at) > SUBMITTED_TIMEOUT_MS) {
      await set(db, pub.id, { status: 'needs_attention', last_error: 'The platform is still processing after 3 hours. Check the account.', last_checked_at: now });
    } else {
      await set(db, pub.id, { status: 'submitted', last_checked_at: now, next_attempt_at: new Date(Date.now() + POLL_EVERY_MS).toISOString() });
    }
  } catch (e) {
    if (e instanceof PlatformError && e.sent) return fail(db, pub, e, true);
    // Status check failed: keep waiting, it's safe to ask again.
    await set(db, pub.id, { status: 'submitted', last_checked_at: now, last_error: `Status check failed: ${(e as Error).message?.slice(0, 120)}`, next_attempt_at: new Date(Date.now() + 2 * POLL_EVERY_MS).toISOString() });
  }
}

