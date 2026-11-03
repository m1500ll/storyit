/** Platform adapters against mocked HTTP (no real account involved). */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { instagram, PlatformError, tiktok } from '@shared/social.ts';

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

describe('TikTok Direct Post', () => {
  it('queries creator info, inits with a privacy level it offers, uploads, returns the publish_id', async () => {
    const calls = mockFetch([
      ok({ data: { privacy_level_options: ['SELF_ONLY'], max_video_post_duration_sec: 600 }, error: { code: 'ok' } }),
      ok({ data: { publish_id: 'p_123', upload_url: 'https://upload.tiktok/x' }, error: { code: 'ok' } }),
      () => new Response('', { status: 201 }),
    ]);
    const id = await tiktok.submit('tok', { caption: 'Hi', size: 3, videoBytes: new Uint8Array([1, 2, 3]) });
    expect(id).toBe('p_123');
    const init = JSON.parse(String(calls[1]!.init!.body));
    expect(init.post_info.privacy_level).toBe('SELF_ONLY'); // unaudited app: private only
    expect(init.source_info).toMatchObject({ source: 'FILE_UPLOAD', video_size: 3, total_chunk_count: 1 });
    expect((calls[2]!.init!.headers as Record<string, string>)['Content-Range']).toBe('bytes 0-2/3');
  });
  it('an upload failure after init is "sent" and carries the publish_id for reconciliation', async () => {
    mockFetch([
      ok({ data: { privacy_level_options: ['SELF_ONLY'] }, error: { code: 'ok' } }),
      ok({ data: { publish_id: 'p_9', upload_url: 'https://u' }, error: { code: 'ok' } }),
      () => { throw new TypeError('socket hang up'); },
    ]);
    const err = await tiktok.submit('tok', { caption: '', size: 1, videoBytes: new Uint8Array([1]) }).catch((e) => e);
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
