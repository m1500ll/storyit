/**
 * Official platform adapters (server-side only). Endpoints from the public docs:
 *  - TikTok Login Kit v2 + Content Posting API (Direct Post, FILE_UPLOAD):
 *    https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
 *  - Instagram API with Instagram Login (Business/Creator accounts), Reels container → publish:
 *    https://developers.facebook.com/docs/instagram-platform/content-publishing
 * Verify field names against these pages when the platforms change their APIs.
 */
import type { Platform } from './distribution.ts';
import type { CreatorInfo, TikTokOptions } from './platformSpecs.ts';

const env = (k: string) => (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env.get(k);
export const IG_VERSION = env('IG_API_VERSION') ?? 'v23.0';
const TIMEOUT = 45_000;

export class PlatformError extends Error {
  constructor(message: string, public status: number | null, public sent: boolean, public code?: string) { super(message); }
}

async function call(url: string, init: RequestInit & { sent?: boolean } = {}) {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT) });
  } catch (e) {
    throw new PlatformError(`Network error: ${e instanceof Error ? e.message : e}`, null, Boolean(init.sent));
  }
  const text = await res.text();
  let body: Record<string, any> = {};
  try { body = text ? JSON.parse(text) : {}; } catch { /* non-JSON */ }
  // TikTok returns 200 with error.code != "ok" for some failures.
  const ttErr = body?.error && typeof body.error === 'object' && body.error.code && body.error.code !== 'ok' ? body.error : null;
  if (!res.ok || ttErr) {
    const msg = ttErr?.message || body?.error?.message || body?.error_description || body?.error_message || text.slice(0, 200);
    throw new PlatformError(String(msg), res.ok ? 400 : res.status, Boolean(init.sent), ttErr?.code ?? body?.error?.code);
  }
  return body;
}

// ---------- Token encryption (AES-GCM, key = TOKEN_ENCRYPTION_KEY, 32 bytes base64) ----------

async function aesKey() {
  const raw = env('TOKEN_ENCRYPTION_KEY');
  if (!raw) throw new Error('TOKEN_ENCRYPTION_KEY secret is not set');
  let bytes = new Uint8Array(0);
  try { bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)); } catch { /* invalid base64 */ }
  if (bytes.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
export async function encrypt(plain: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(), new TextEncoder().encode(plain)));
  return `v1:${b64(iv)}:${b64(ct)}`;
}
export async function decrypt(blob: string) {
  const [v, iv, ct] = blob.split(':');
  if (v !== 'v1' || !iv || !ct) throw new Error('Unreadable token');
  const dec = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: dec(iv) }, await aesKey(), dec(ct)));
}

// ---------- Shared types ----------

export interface TokenSet { access_token: string; refresh_token?: string | null; expires_at?: string | null; refresh_expires_at?: string | null }
export interface Profile {
  external_id: string; username: string | null; display_name: string | null; avatar_url: string | null;
  scopes: string[]; account_type?: string | null; can_publish: boolean; publish_restriction: string | null;
}
export interface SubmitInput {
  caption: string; size: number; durationSeconds?: number | null;
  /** Reads bytes [start, end] of the video (inclusive): only one chunk is ever in memory. */
  readChunk?: (start: number, end: number) => Promise<Uint8Array>;
  videoUrl?: string;
  tiktok?: TikTokOptions;
}
const MB = 1024 * 1024;
/** TikTok FILE_UPLOAD chunking: ≤10 MB in one piece; otherwise 10 MB chunks, the last one absorbs the remainder (< 20 MB). */
export function tiktokChunks(size: number) {
  if (size <= 10 * MB) return { chunkSize: size, count: 1 };
  return { chunkSize: 10 * MB, count: Math.floor(size / (10 * MB)) };
}
export type PollResult = { state: 'pending' } | { state: 'published'; postId?: string | null; url?: string | null; note?: string } | { state: 'failed'; reason: string } | { state: 'ready_to_publish' };

const inSeconds = (s?: number) => (s ? new Date(Date.now() + s * 1000).toISOString() : null);

// ---------- TikTok ----------

const TT = 'https://open.tiktokapis.com/v2';
export const TIKTOK_SCOPES = ['user.info.basic', 'user.info.profile', 'video.publish'];

export const tiktok = {
  configured: () => Boolean(env('TIKTOK_CLIENT_KEY') && env('TIKTOK_CLIENT_SECRET')),
  authorizeUrl(redirectUri: string, state: string) {
    const q = new URLSearchParams({ client_key: env('TIKTOK_CLIENT_KEY')!, response_type: 'code', scope: TIKTOK_SCOPES.join(','), redirect_uri: redirectUri, state });
    return `https://www.tiktok.com/v2/auth/authorize/?${q}`;
  },
  async exchange(code: string, redirectUri: string): Promise<TokenSet & { scopes: string[] }> {
    const b = await call(`${TT}/oauth/token/`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_key: env('TIKTOK_CLIENT_KEY')!, client_secret: env('TIKTOK_CLIENT_SECRET')!, code, grant_type: 'authorization_code', redirect_uri: redirectUri }),
    });
    return { access_token: b.access_token, refresh_token: b.refresh_token, expires_at: inSeconds(b.expires_in), refresh_expires_at: inSeconds(b.refresh_expires_in), scopes: String(b.scope ?? '').split(',').filter(Boolean) };
  },
  async refresh(refreshToken: string): Promise<TokenSet> {
    const b = await call(`${TT}/oauth/token/`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_key: env('TIKTOK_CLIENT_KEY')!, client_secret: env('TIKTOK_CLIENT_SECRET')!, grant_type: 'refresh_token', refresh_token: refreshToken }),
    });
    return { access_token: b.access_token, refresh_token: b.refresh_token, expires_at: inSeconds(b.expires_in), refresh_expires_at: inSeconds(b.refresh_expires_in) };
  },
  async revoke(token: string) {
    await call(`${TT}/oauth/revoke/`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_key: env('TIKTOK_CLIENT_KEY')!, client_secret: env('TIKTOK_CLIENT_SECRET')!, token }),
    }).catch(() => undefined);
  },
  async creatorInfo(token: string) {
    const b = await call(`${TT}/post/publish/creator_info/query/`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' }, body: '{}' });
    const d = b.data ?? {};
    return {
      creator_nickname: d.creator_nickname ?? '', creator_username: d.creator_username, creator_avatar_url: d.creator_avatar_url,
      privacy_level_options: d.privacy_level_options ?? [], comment_disabled: Boolean(d.comment_disabled), duet_disabled: Boolean(d.duet_disabled),
      stitch_disabled: Boolean(d.stitch_disabled), max_video_post_duration_sec: Number(d.max_video_post_duration_sec ?? 600),
    } satisfies CreatorInfo;
  },
  async profile(token: string, scopes: string[]): Promise<Profile> {
    const b = await call(`${TT}/user/info/?fields=open_id,avatar_url,display_name,username`, { headers: { Authorization: `Bearer ${token}` } });
    const u = b.data?.user ?? {};
    const hasPublish = scopes.includes('video.publish');
    const audited = env('TIKTOK_APP_AUDITED') === 'true';
    let options: string[] = [];
    if (hasPublish) options = (await tiktok.creatorInfo(token).catch(() => null))?.privacy_level_options ?? [];
    return {
      external_id: u.open_id, username: u.username ?? null, display_name: u.display_name ?? null, avatar_url: u.avatar_url ?? null, scopes,
      can_publish: hasPublish && options.length > 0,
      publish_restriction: !hasPublish ? 'video.publish permission not granted'
        : !audited ? 'TikTok app not audited yet: TikTok makes every post private (only visible to the account owner)' : null,
    };
  },
  /**
   * Direct Post with FILE_UPLOAD (our storage domain is not verified with TikTok, so PULL_FROM_URL is not usable).
   * The options are the ones the user chose in the TikTok-compliant form; nothing is defaulted here.
   */
  async submit(token: string, input: SubmitInput): Promise<string> {
    const o = input.tiktok ?? {};
    if (!input.readChunk) throw new PlatformError('Video source missing', 400, false);
    if (!o.privacy_level || !o.consented_at) throw new PlatformError('TikTok settings were not confirmed by the user', 400, false);
    // Fresh creator info right before posting (required by TikTok): the account may have changed.
    const info = await tiktok.creatorInfo(token);
    if (!info.privacy_level_options.includes(o.privacy_level)) throw new PlatformError(`Visibility "${o.privacy_level}" is no longer available for this account`, 400, false);
    if (input.durationSeconds != null && input.durationSeconds > info.max_video_post_duration_sec) {
      throw new PlatformError(`This account accepts videos up to ${info.max_video_post_duration_sec} s`, 400, false);
    }
    const size = input.size;
    const { chunkSize, count } = tiktokChunks(size);
    const init = await call(`${TT}/post/publish/video/init/`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        post_info: {
          title: input.caption.slice(0, 2200), privacy_level: o.privacy_level,
          disable_comment: info.comment_disabled || Boolean(o.disable_comment),
          disable_duet: info.duet_disabled || Boolean(o.disable_duet),
          disable_stitch: info.stitch_disabled || Boolean(o.disable_stitch),
          brand_content_toggle: Boolean(o.commercial && o.brand_content),
          brand_organic_toggle: Boolean(o.commercial && o.brand_organic),
        },
        source_info: { source: 'FILE_UPLOAD', video_size: size, chunk_size: chunkSize, total_chunk_count: count },
      }),
    });
    const { publish_id, upload_url } = init.data ?? {};
    if (!publish_id || !upload_url) throw new PlatformError('TikTok did not return an upload URL', 502, false);
    // From here TikTok has a publish_id: any failure is reported with it so it can be reconciled, never re-sent blindly.
    for (let i = 0; i < count; i++) {
      const start = i * chunkSize;
      const end = i === count - 1 ? size - 1 : start + chunkSize - 1;
      const bytes = await input.readChunk(start, end).catch((e) => { throw Object.assign(new PlatformError(`Could not read the video: ${e instanceof Error ? e.message : e}`, null, true), { code: `publish_id:${publish_id}` }); });
      await call(upload_url, {
        method: 'PUT', sent: true,
        headers: { 'Content-Type': 'video/mp4', 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) },
        body: bytes as unknown as BodyInit,
      }).catch((e: PlatformError) => { e.code = `publish_id:${publish_id}`; throw e; });
    }
    return publish_id as string;
  },
  async poll(token: string, publishId: string): Promise<PollResult> {
    const b = await call(`${TT}/post/publish/status/fetch/`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' }, body: JSON.stringify({ publish_id: publishId }),
    });
    const d = b.data ?? {};
    if (d.status === 'PUBLISH_COMPLETE') {
      const id = (d.publicaly_available_post_id ?? d.publicly_available_post_id ?? [])[0];
      return { state: 'published', postId: id ? String(id) : null, url: null, note: id ? undefined : 'Published privately (no public post id)' };
    }
    if (d.status === 'FAILED') return { state: 'failed', reason: d.fail_reason ?? 'TikTok rejected the video' };
    return { state: 'pending' };
  },
};

// ---------- Instagram (Instagram API with Instagram Login) ----------

const IG = `https://graph.instagram.com/${IG_VERSION}`;
export const INSTAGRAM_SCOPES = ['instagram_business_basic', 'instagram_business_content_publish'];

export const instagram = {
  configured: () => Boolean(env('INSTAGRAM_APP_ID') && env('INSTAGRAM_APP_SECRET')),
  authorizeUrl(redirectUri: string, state: string) {
    const q = new URLSearchParams({ client_id: env('INSTAGRAM_APP_ID')!, redirect_uri: redirectUri, response_type: 'code', scope: INSTAGRAM_SCOPES.join(','), state });
    return `https://www.instagram.com/oauth/authorize?${q}`;
  },
  async exchange(code: string, redirectUri: string): Promise<TokenSet & { scopes: string[] }> {
    const short = await call('https://api.instagram.com/oauth/access_token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: env('INSTAGRAM_APP_ID')!, client_secret: env('INSTAGRAM_APP_SECRET')!, grant_type: 'authorization_code', redirect_uri: redirectUri, code }),
    });
    const s = Array.isArray(short.data) ? short.data[0] : short;
    const long = await call(`https://graph.instagram.com/access_token?${new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: env('INSTAGRAM_APP_SECRET')!, access_token: s.access_token })}`);
    const perms = Array.isArray(s.permissions) ? s.permissions : String(s.permissions ?? '').split(',');
    return { access_token: long.access_token, refresh_token: null, expires_at: inSeconds(long.expires_in), scopes: perms.filter(Boolean) };
  },
  /** Long-lived tokens (60 days) are refreshed with themselves; they must be at least 24h old. */
  async refresh(token: string): Promise<TokenSet> {
    const b = await call(`https://graph.instagram.com/refresh_access_token?${new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: token })}`);
    return { access_token: b.access_token, refresh_token: null, expires_at: inSeconds(b.expires_in) };
  },
  async profile(token: string, scopes: string[]): Promise<Profile> {
    const u = await call(`${IG}/me?fields=user_id,username,name,account_type,profile_picture_url&access_token=${encodeURIComponent(token)}`);
    const ok = ['BUSINESS', 'MEDIA_CREATOR'].includes(String(u.account_type ?? '').toUpperCase()) || !u.account_type;
    const hasPublish = scopes.includes('instagram_business_content_publish') || scopes.length === 0;
    return {
      external_id: String(u.user_id ?? u.id), username: u.username ?? null, display_name: u.name ?? null, avatar_url: u.profile_picture_url ?? null,
      scopes, account_type: u.account_type ?? null, can_publish: ok && hasPublish,
      publish_restriction: !ok ? 'Personal Instagram accounts cannot publish through the API: switch to a Professional (Business or Creator) account'
        : !hasPublish ? 'Publishing permission not granted' : null,
    };
  },
  /** Step 1: create the Reels container (Instagram downloads the video from a short-lived signed URL). */
  async submit(token: string, igUserId: string, input: SubmitInput): Promise<string> {
    if (!input.videoUrl) throw new PlatformError('Video URL missing', 400, false);
    const b = await call(`${IG}/${igUserId}/media`, {
      // Creating a container does not publish anything: safe to retry.
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_type: 'REELS', video_url: input.videoUrl, caption: input.caption.slice(0, 2200), share_to_feed: true, access_token: token }),
    });
    return String(b.id);
  },
  /** Step 2: wait for the container, then publish it. */
  async poll(token: string, containerId: string): Promise<PollResult> {
    const c = await call(`${IG}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`);
    if (c.status_code === 'FINISHED') return { state: 'ready_to_publish' };
    if (c.status_code === 'PUBLISHED') return { state: 'published' };
    if (c.status_code === 'ERROR' || c.status_code === 'EXPIRED') return { state: 'failed', reason: c.status ?? `Container ${String(c.status_code).toLowerCase()}` };
    return { state: 'pending' };
  },
  async publish(token: string, igUserId: string, containerId: string): Promise<{ postId: string; url: string | null }> {
    const b = await call(`${IG}/${igUserId}/media_publish`, {
      method: 'POST', sent: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creation_id: containerId, access_token: token }),
    });
    const link = await call(`${IG}/${b.id}?fields=permalink&access_token=${encodeURIComponent(token)}`).catch(() => ({} as Record<string, string>));
    return { postId: String(b.id), url: link.permalink ?? null };
  },
};

export const adapters: Record<Platform, typeof tiktok | typeof instagram> = { tiktok, instagram };
