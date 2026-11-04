/** Platform adapters against mocked HTTP (no real account involved). */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { instagram, PlatformError, tiktok, tiktokChunks } from '@shared/social.ts';

type Call = { url: string; init?: RequestInit };
function mockFetch(responses: ((c: Call) => Response | Promise<Response>)[]) {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const c = { url: String(url), init };
    calls.push(c);
    const r = responses.shift();
    if (!r) throw new Error('unexpected call ' + url);
    return r(c);
  }));
  return calls;
}
const ok = (body: unknown) => () => new Response(JSON.stringify(body), { status: 200 });
afterEach(() => vi.unstubAllGlobals());

const CREATOR = { creator_nickname: 'Marcel', privacy_level_options: ['SELF_ONLY'], comment_disabled: false, duet_disabled: true, stitch_disabled: false, max_video_post_duration_sec: 60 };
const OPTS = { privacy_level: 'SELF_ONLY', consented_at: '2026-11-04T10:00:00Z', commercial: true, brand_organic: true };
const reader = (log: [number, number][]) => async (a: number, b: number) => { log.push([a, b]); return new Uint8Array(b - a + 1); };

describe('TikTok Direct Post', () => {
  it('re-reads creator info, sends the user\'s choices, uploads in one piece when small', async () => {
    const calls = mockFetch([
      ok({ data: CREATOR, error: { code: 'ok' } }),
      ok({ data: { publish_id: 'p_123', upload_url: 'https://upload.tiktok/x' }, error: { code: 'ok' } }),
      () => new Response('', { status: 201 }),
    ]);
    const reads: [number, number][] = [];
    const id = await tiktok.submit('tok', { caption: 'Hi', size: 3, durationSeconds: 30, readChunk: reader(reads), tiktok: OPTS });
    expect(id).toBe('p_123');
    const init = JSON.parse(String(calls[1]!.init!.body));
    expect(init.post_info).toMatchObject({ privacy_level: 'SELF_ONLY', disable_duet: true, disable_comment: false, brand_organic_toggle: true, brand_content_toggle: false });
    expect(init.source_info).toMatchObject({ source: 'FILE_UPLOAD', video_size: 3, chunk_size: 3, total_chunk_count: 1 });
    expect((calls[2]!.init!.headers as Record<string, string>)['Content-Range']).toBe('bytes 0-2/3');
    expect(reads).toEqual([[0, 2]]);
  });
  it('streams big files in 10 MB chunks (never the whole file in memory); the last chunk takes the remainder', async () => {
    const MB = 1024 * 1024;
    const size = 25 * MB + 123;
    expect(tiktokChunks(size)).toEqual({ chunkSize: 10 * MB, count: 2 });
    mockFetch([ok({ data: CREATOR, error: { code: 'ok' } }), ok({ data: { publish_id: 'p', upload_url: 'https://u' }, error: { code: 'ok' } }), () => new Response('', { status: 206 }), () => new Response('', { status: 201 })]);
    const reads: [number, number][] = [];
    await tiktok.submit('tok', { caption: '', size, durationSeconds: 30, readChunk: reader(reads), tiktok: OPTS });
    expect(reads).toEqual([[0, 10 * MB - 1], [10 * MB, size - 1]]);
    expect(Math.max(...reads.map(([a, b]) => b - a + 1))).toBeLessThan(20 * MB);
  });
  it('refuses to post without the user\'s TikTok choices, before calling TikTok', async () => {
    const calls = mockFetch([]);
    const err = await tiktok.submit('tok', { caption: '', size: 1, readChunk: reader([]), tiktok: {} }).catch((e) => e);
    expect(err).toMatchObject({ sent: false, message: expect.stringMatching(/not confirmed/) });
    expect(calls).toHaveLength(0);
  });
  it('rejects a visibility the account no longer offers, and videos over the account max duration', async () => {
    mockFetch([ok({ data: CREATOR, error: { code: 'ok' } })]);
    await expect(tiktok.submit('t', { caption: '', size: 1, readChunk: reader([]), tiktok: { ...OPTS, privacy_level: 'PUBLIC_TO_EVERYONE' } })).rejects.toMatchObject({ sent: false });
    mockFetch([ok({ data: CREATOR, error: { code: 'ok' } })]);
    await expect(tiktok.submit('t', { caption: '', size: 1, durationSeconds: 61, readChunk: reader([]), tiktok: OPTS })).rejects.toThrow(/up to 60 s/);
  });
  it('an upload failure after init is "sent" and carries the publish_id for reconciliation', async () => {
    mockFetch([
      ok({ data: CREATOR, error: { code: 'ok' } }),
      ok({ data: { publish_id: 'p_9', upload_url: 'https://u' }, error: { code: 'ok' } }),
      () => { throw new TypeError('socket hang up'); },
    ]);
    const err = await tiktok.submit('tok', { caption: '', size: 1, readChunk: reader([]), tiktok: OPTS }).catch((e) => e);
    expect(err).toBeInstanceOf(PlatformError);
    expect(err.sent).toBe(true);
    expect(err.code).toBe('publish_id:p_9');
  });
  it('maps processing statuses; only PUBLISH_COMPLETE counts as published', async () => {
    mockFetch([ok({ data: { status: 'PROCESSING_UPLOAD' }, error: { code: 'ok' } }), ok({ data: { status: 'FAILED', fail_reason: 'duration_check_failed' }, error: { code: 'ok' } }), ok({ data: { status: 'PUBLISH_COMPLETE', publicaly_available_post_id: [42] }, error: { code: 'ok' } })]);
    expect(await tiktok.poll('t', 'p')).toEqual({ state: 'pending' });
    expect(await tiktok.poll('t', 'p')).toEqual({ state: 'failed', reason: 'duration_check_failed' });
    expect(await tiktok.poll('t', 'p')).toMatchObject({ state: 'published', postId: '42' });
  });
  it('treats a 200 with an error code as an error (no false success)', async () => {
    mockFetch([ok({ data: {}, error: { code: 'access_token_invalid', message: 'expired' } })]);
    await expect(tiktok.poll('t', 'p')).rejects.toMatchObject({ code: 'access_token_invalid' });
  });
});

describe('OAuth & profile robustness', () => {
  it('treats a 200 OAuth answer with a string error as a failure (no false connection)', async () => {
    mockFetch([ok({ error: 'invalid_grant', error_description: 'Authorization code is expired.' })]);
    await expect(tiktok.exchange('code', 'https://cb')).rejects.toThrow(/expired/);
  });
  it('does not ask for username when the user unticked the profile scope', async () => {
    const calls = mockFetch([ok({ data: { user: { open_id: 'o1', display_name: 'Hamza' } }, error: { code: 'ok' } })]);
    const p = await tiktok.profile('t', ['user.info.basic']);
    expect(calls[0]!.url).not.toContain('username');
    expect(p).toMatchObject({ external_id: 'o1', can_publish: false, publish_restriction: expect.stringMatching(/video.publish/) });
  });
  it('lists TikTok publishing rights from creator info', async () => {
    const calls = mockFetch([
      ok({ data: { user: { open_id: 'o1', username: 'hamza', display_name: 'Hamza' } }, error: { code: 'ok' } }),
      ok({ data: { privacy_level_options: ['SELF_ONLY'] }, error: { code: 'ok' } }),
    ]);
    const p = await tiktok.profile('t', ['user.info.basic', 'user.info.profile', 'video.publish']);
    expect(calls[0]!.url).toContain('username');
    expect(p).toMatchObject({ username: 'hamza', can_publish: true, publish_restriction: expect.stringMatching(/not audited/) });
  });
  it('Instagram code exchange: short-lived then long-lived token, permissions as array or string', async () => {
    mockFetch([ok({ data: [{ access_token: 's', user_id: 1, permissions: 'instagram_business_basic,instagram_business_content_publish' }] }), ok({ access_token: 'long', expires_in: 5184000 })]);
    const t = await instagram.exchange('c', 'https://cb');
    expect(t).toMatchObject({ access_token: 'long', scopes: ['instagram_business_basic', 'instagram_business_content_publish'] });
  });
});

describe('Instagram Reels', () => {
  it('creates a REELS container from a temporary URL, waits for FINISHED, then publishes', async () => {
    const calls = mockFetch([ok({ id: 'c1' }), ok({ status_code: 'IN_PROGRESS' }), ok({ status_code: 'FINISHED' }), ok({ id: 'm1' }), ok({ permalink: 'https://instagram.com/reel/x' })]);
    expect(await instagram.submit('t', 'ig', { caption: 'Hi', size: 1, videoUrl: 'https://signed/x' })).toBe('c1');
    expect(JSON.parse(String(calls[0]!.init!.body))).toMatchObject({ media_type: 'REELS', video_url: 'https://signed/x' });
    expect(await instagram.poll('t', 'c1')).toEqual({ state: 'pending' });
    expect(await instagram.poll('t', 'c1')).toEqual({ state: 'ready_to_publish' });
    expect(await instagram.publish('t', 'ig', 'c1')).toEqual({ postId: 'm1', url: 'https://instagram.com/reel/x' });
  });
  it('reports container errors as failures', async () => {
    mockFetch([ok({ status_code: 'ERROR', status: 'Unsupported video codec' })]);
    expect(await instagram.poll('t', 'c')).toEqual({ state: 'failed', reason: 'Unsupported video codec' });
  });
  it('flags personal accounts as unable to publish', async () => {
    mockFetch([ok({ user_id: '1', username: 'me', account_type: 'PERSONAL' })]);
    const p = await instagram.profile('t', ['instagram_business_basic', 'instagram_business_content_publish']);
    expect(p.can_publish).toBe(false);
    expect(p.publish_restriction).toMatch(/Professional/);
  });
  it('an expired token is an auth error (401), not a retry', async () => {
    mockFetch([() => new Response(JSON.stringify({ error: { message: 'Session has expired', code: 190 } }), { status: 401 })]);
    await expect(instagram.poll('t', 'c')).rejects.toMatchObject({ status: 401 });
  });
});
