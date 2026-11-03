/**
 * Publication worker (the code the server runs every minute) with an in-memory database and fake platforms.
 * Simulated: no real TikTok/Instagram account is involved.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformError } from '@shared/social.ts';
import { AuthExpiredError, poll, start, type WorkerDeps } from '@shared/worker.ts';

type Row = Record<string, any>;
/** Tiny subset of the supabase-js query builder used by the worker. */
function fakeDb(tables: Record<string, Row[]>) {
  const from = (t: string) => {
    let rows = () => tables[t] ?? (tables[t] = []);
    const filters: ((r: Row) => boolean)[] = [];
    let patch: Row | null = null;
    let countMode = false;
    const api: any = {
      select: (_c?: string, o?: { count?: string }) => { countMode = Boolean(o?.count); return api; },
      eq: (k: string, v: unknown) => { filters.push((r) => r[k] === v); return api; },
      neq: (k: string, v: unknown) => { filters.push((r) => r[k] !== v); return api; },
      in: (k: string, v: unknown[]) => { filters.push((r) => v.includes(r[k])); return api; },
      update: (p: Row) => { patch = p; return api; },
      insert: (r: Row) => { rows().push(r); return Promise.resolve({ error: null }); },
      single: () => Promise.resolve({ data: run()[0] ?? null }),
      then: (res: (v: unknown) => void) => res(countMode ? { count: run().length } : { data: run(), error: null }),
    };
    const run = () => {
      const hit = rows().filter((r) => filters.every((f) => f(r)));
      if (patch) hit.forEach((r) => Object.assign(r, patch));
      return hit;
    };
    return api;
  };
  return { from, storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: 'https://signed/video' } }) }) } };
}

let tables: Record<string, Row[]>;
let deps: WorkerDeps;
const pub = (over: Row = {}) => ({ id: 'p1', user_id: 'u1', media_id: 'm1', account_id: 'tt', platform: 'tiktok', caption: 'Hello', hashtags: ['#fruit'], status: 'processing', attempts: 0, max_attempts: 3, send_started_at: null, external_id: null, updated_at: new Date().toISOString(), ...over });
const get = (id = 'p1') => tables.scheduled_publications!.find((r) => r.id === id)!;

beforeEach(() => {
  tables = {
    media_assets: [{ id: 'm1', user_id: 'u1', status: 'available', storage_path: 'u1/m1.mp4', size_bytes: 3 }],
    social_accounts: [
      { id: 'tt', user_id: 'u1', platform: 'tiktok', status: 'connected', can_publish: true, editorial: {}, external_id: 'open1' },
      { id: 'ig', user_id: 'u1', platform: 'instagram', status: 'connected', can_publish: true, editorial: {}, external_id: 'ig1' },
      { id: 'ro', user_id: 'u1', platform: 'instagram', status: 'connected', can_publish: false, publish_restriction: 'Personal account', editorial: {}, external_id: 'ig2' },
    ],
    scheduled_publications: [],
    publication_events: [],
  };
  deps = {
    accessToken: vi.fn(async () => 'token'),
    fetchFile: vi.fn(async () => new Response(new Uint8Array([1, 2, 3]))),
    tiktok: { submit: vi.fn(async () => 'publish_1'), poll: vi.fn(async () => ({ state: 'pending' as const })) },
    instagram: { submit: vi.fn(async () => 'container_1'), poll: vi.fn(async () => ({ state: 'pending' as const })), publish: vi.fn(async () => ({ postId: 'media_1', url: 'https://ig/p' })) },
  };
});

const run = async (p: Row, fn = start) => { tables.scheduled_publications!.push(p); await fn(fakeDb(tables), { ...p }, deps); return get(p.id); };

describe('publication worker', () => {
  it('uploads, then waits for the platform: "submitted", not "published"', async () => {
    const r = await run(pub());
    expect(deps.tiktok.submit).toHaveBeenCalledWith('token', expect.objectContaining({ caption: 'Hello\n\n#fruit' }));
    expect(r).toMatchObject({ status: 'submitted', external_id: 'publish_1', attempts: 1 });
  });

  it('marks published only when the platform confirms (async status)', async () => {
    tables.scheduled_publications!.push(pub({ status: 'submitted', external_id: 'publish_1' }));
    await poll(fakeDb(tables), { ...get() }, deps);
    expect(get().status).toBe('submitted');
    (deps.tiktok.poll as any).mockResolvedValueOnce({ state: 'published', postId: '42' });
    await poll(fakeDb(tables), { ...get() }, deps);
    expect(get()).toMatchObject({ status: 'published', external_post_id: '42' });
  });

  it('Instagram: container FINISHED → media_publish → published with permalink', async () => {
    tables.scheduled_publications!.push(pub({ account_id: 'ig', platform: 'instagram', status: 'submitted', external_id: 'container_1' }));
    (deps.instagram.poll as any).mockResolvedValueOnce({ state: 'ready_to_publish' });
    await poll(fakeDb(tables), { ...get() }, deps);
    expect(deps.instagram.publish).toHaveBeenCalledWith('token', 'ig1', 'container_1');
    expect(get()).toMatchObject({ status: 'published', external_url: 'https://ig/p' });
  });

  it('a platform rejection fails that publication only', async () => {
    tables.scheduled_publications!.push(pub({ id: 'ok', account_id: 'ig', platform: 'instagram', status: 'submitted', external_id: 'c' }));
    tables.scheduled_publications!.push(pub({ id: 'bad', status: 'submitted', external_id: 'x' }));
    (deps.tiktok.poll as any).mockResolvedValueOnce({ state: 'failed', reason: 'duration_check_failed' });
    (deps.instagram.poll as any).mockResolvedValueOnce({ state: 'published', postId: 'm' });
    await poll(fakeDb(tables), { ...get('bad') }, deps);
    await poll(fakeDb(tables), { ...get('ok') }, deps);
    expect(get('bad')).toMatchObject({ status: 'failed', last_error: 'duration_check_failed' });
    expect(get('ok').status).toBe('published');
  });

  it('retries a transient error before anything was sent, with backoff, then gives up', async () => {
    (deps.tiktok.submit as any).mockRejectedValue(new PlatformError('busy', 503, false));
    const r = await run(pub());
    expect(r.status).toBe('scheduled');
    expect(Date.parse(r.next_attempt_at)).toBeGreaterThan(Date.now() + 60_000);
    for (let i = 0; i < 2; i++) { r.status = 'processing'; await start(fakeDb(tables), { ...r }, deps); }
    expect(get()).toMatchObject({ status: 'failed', attempts: 3 });
  });

  it('never re-sends when the result is uncertain (timeout after the upload started)', async () => {
    (deps.tiktok.submit as any).mockRejectedValue(Object.assign(new PlatformError('socket hang up', null, true), { code: 'publish_id:p_9' }));
    const r = await run(pub());
    expect(r).toMatchObject({ status: 'needs_attention', external_id: 'p_9' });
    expect(r.last_error).toMatch(/may already be posted/);
  });

  it('a crashed worker mid-upload leads to a manual check, not a second upload', async () => {
    const r = await run(pub({ send_started_at: new Date().toISOString() }));
    expect(r.status).toBe('needs_attention');
    expect(deps.tiktok.submit).not.toHaveBeenCalled();
  });

  it('expired or revoked token: fails clearly, asks to reconnect, nothing sent', async () => {
    (deps.accessToken as any).mockRejectedValue(new AuthExpiredError('Authorization expired or revoked: reconnect the account'));
    const r = await run(pub());
    expect(r.status).toBe('failed');
    expect(r.last_error).toMatch(/reconnect/);
    expect(deps.tiktok.submit).not.toHaveBeenCalled();
  });

  it('refuses to publish on an account without publishing rights', async () => {
    const r = await run(pub({ account_id: 'ro', platform: 'instagram' }));
    expect(r).toMatchObject({ status: 'failed', last_error: 'Personal account' });
    expect(deps.instagram.submit).not.toHaveBeenCalled();
  });

  it('refuses disconnected accounts and unavailable videos', async () => {
    tables.social_accounts![0]!.status = 'expired';
    expect((await run(pub())).last_error).toMatch(/reconnect/);
    tables.social_accounts![0]!.status = 'connected';
    tables.media_assets![0]!.status = 'archived';
    expect((await run(pub({ id: 'p2' }))).last_error).toMatch(/not available/);
  });

  it('cancels a duplicate if the same video is already live on that account', async () => {
    tables.scheduled_publications!.push(pub({ id: 'old', status: 'published' }));
    const r = await run(pub());
    expect(r.status).toBe('cancelled');
    expect(deps.tiktok.submit).not.toHaveBeenCalled();
  });

  it('a stuck platform (3h processing) becomes a manual check', async () => {
    tables.scheduled_publications!.push(pub({ status: 'submitted', external_id: 'x', updated_at: new Date(Date.now() - 4 * 3600_000).toISOString() }));
    await poll(fakeDb(tables), { ...get() }, deps);
    expect(get().status).toBe('needs_attention');
  });
});
