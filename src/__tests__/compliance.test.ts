import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkState, oauthError, safeReturnOrigin, STATE_TTL_MS } from '@shared/oauth.ts';
import { checkVideo, tiktokDeclaration, tiktokReadiness, type CreatorInfo } from '@shared/platformSpecs.ts';
import { decrypt, encrypt } from '@shared/social.ts';
import { refreshDecision } from '@shared/tokens.ts';

const MB = 1024 * 1024;
const video = (o = {}) => ({ mime: 'video/mp4', size_bytes: 20 * MB, duration_seconds: 45, width: 1080, height: 1920, ...o });
const info: CreatorInfo = { creator_nickname: 'Marcel', privacy_level_options: ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'], comment_disabled: false, duet_disabled: false, stitch_disabled: false, max_video_post_duration_sec: 180 };

describe('platform constraints before scheduling', () => {
  it('accepts a normal vertical video on both platforms', () => {
    expect(checkVideo('tiktok', video())).toEqual([]);
    expect(checkVideo('instagram', video())).toEqual([]);
  });
  it('blocks unsupported formats, too short/long videos, and oversize files', () => {
    expect(checkVideo('instagram', video({ mime: 'video/webm' }))[0]!.level).toBe('error');
    expect(checkVideo('tiktok', video({ duration_seconds: 2 }))[0]!.message).toMatch(/shorter than 3/);
    expect(checkVideo('tiktok', video({ duration_seconds: 200 }), 180)[0]).toMatchObject({ level: 'error', source: 'confirmed' });
    expect(checkVideo('instagram', video({ size_bytes: 301 * MB }))[0]!.message).toMatch(/300 MB/);
  });
  it('warns (does not block) on unconfirmed limits and horizontal videos', () => {
    expect(checkVideo('instagram', video({ duration_seconds: 120 }))[0]).toMatchObject({ level: 'warning', source: 'to_verify' });
    expect(checkVideo('tiktok', video({ width: 1920, height: 1080 }))[0]!.level).toBe('warning');
  });
});

describe('TikTok posting form (Content Sharing Guidelines)', () => {
  it('requires an explicit visibility from the account options and the declaration', () => {
    expect(tiktokReadiness({}, info, 30)).toEqual(expect.arrayContaining(['Choose who can view this video', 'Confirm the declaration']));
    expect(tiktokReadiness({ privacy_level: 'FOLLOWER_OF_CREATOR', consented_at: 'x' }, info, 30)).toContain('This visibility is not available for this account');
    expect(tiktokReadiness({ privacy_level: 'SELF_ONLY', consented_at: 'x' }, info, 30)).toEqual([]);
  });
  it('blocks when the disclosure is on with no option selected, and over the max duration', () => {
    expect(tiktokReadiness({ privacy_level: 'SELF_ONLY', consented_at: 'x', commercial: true }, info, 30)[0]).toMatch(/Your brand/);
    expect(tiktokReadiness({ privacy_level: 'SELF_ONLY', consented_at: 'x' }, info, 181)[0]).toMatch(/up to 180/);
  });
  it('uses the exact declaration wording', () => {
    expect(tiktokDeclaration({})).toBe("By posting, you agree to TikTok's Music Usage Confirmation.");
    expect(tiktokDeclaration({ commercial: true, brand_organic: true })).toBe("By posting, you agree to TikTok's Music Usage Confirmation.");
    expect(tiktokDeclaration({ commercial: true, brand_content: true })).toBe("By posting, you agree to TikTok's Branded Content Policy and Music Usage Confirmation.");
  });
  it('without creator info nothing can be approved', () => expect(tiktokReadiness({ privacy_level: 'SELF_ONLY', consented_at: 'x' }, null, 1)).toHaveLength(1));
});

describe('OAuth callback state (CSRF)', () => {
  const now = Date.parse('2026-11-04T10:00:00Z');
  it('accepts a fresh state for the same platform only', () => {
    expect(checkState({ platform: 'tiktok', created_at: '2026-11-04T09:55:00Z' }, 'tiktok', now)).toEqual({ ok: true });
    expect(checkState({ platform: 'instagram', created_at: '2026-11-04T09:55:00Z' }, 'tiktok', now).ok).toBe(false);
    expect(checkState(null, 'tiktok', now).ok).toBe(false); // unknown or already used
    expect(checkState({ platform: 'tiktok', created_at: new Date(now - STATE_TTL_MS - 1).toISOString() }, 'tiktok', now).ok).toBe(false);
  });
  it('sends the user back to the Storyit site they came from, never to another site', () => {
    const app = 'https://storyit.fun';
    expect(safeReturnOrigin('https://storyit-v2jb.vercel.app', app)).toBe('https://storyit-v2jb.vercel.app');
    expect(safeReturnOrigin('http://localhost:5173', app)).toBe('http://localhost:5173');
    expect(safeReturnOrigin('https://www.storyit.fun', app)).toBe('https://www.storyit.fun');
    for (const evil of ['https://evil.com', 'https://storyit.fun.evil.com', 'https://evil.vercel.app', 'https://storyit-v2jb-git-evil.vercel.app', 'javascript:alert(1)', 'not a url', null]) {
      expect(safeReturnOrigin(evil as string | null, app)).toBe('https://storyit.fun');
    }
  });
  it('bounds platform error text', () => expect(oauthError(new URLSearchParams({ error_description: 'x'.repeat(500) }))).toHaveLength(160));
});

describe('token renewal (inactive accounts too)', () => {
  const now = Date.parse('2026-11-04T10:00:00Z');
  const D = 86_400_000;
  const ig = (expiresInDays: number, ageDays: number) => ({ account_id: 'a', platform: 'instagram' as const, refresh_expires_at: null,
    expires_at: new Date(now + expiresInDays * D).toISOString(), updated_at: new Date(now - ageDays * D).toISOString() });
  it('Instagram: refresh before expiry, only when the token is at least 24 h old (Meta rule)', () => {
    expect(refreshDecision(ig(40, 20), now)).toBe('ok');
    expect(refreshDecision(ig(10, 50), now)).toBe('refresh');
    expect(refreshDecision(ig(10, 0.5), now)).toBe('ok');
    expect(refreshDecision(ig(-1, 61), now)).toBe('expired');
  });
  it('TikTok: renew the 24 h access token; warn before the refresh token ends; expire after', () => {
    const tt = (accessH: number, refreshDays: number) => ({ account_id: 'a', platform: 'tiktok' as const, updated_at: '',
      expires_at: new Date(now + accessH * 3600_000).toISOString(), refresh_expires_at: new Date(now + refreshDays * D).toISOString() });
    expect(refreshDecision(tt(20, 300), now)).toBe('ok');
    expect(refreshDecision(tt(1, 300), now)).toBe('refresh');
    expect(refreshDecision(tt(20, 7), now)).toBe('reconnect_soon');
    expect(refreshDecision(tt(20, -1), now)).toBe('expired');
  });
});

describe('token encryption at rest', () => {
  const key = Buffer.from(new Uint8Array(32).map((_, i) => i)).toString('base64');
  afterEach(() => vi.unstubAllGlobals());
  const withKey = (k?: string) => vi.stubGlobal('Deno', { env: { get: (n: string) => (n === 'TOKEN_ENCRYPTION_KEY' ? k : undefined) } });
  it('round-trips, never stores the token in clear, uses a fresh IV each time', async () => {
    withKey(key);
    const a = await encrypt('secret-token');
    const b = await encrypt('secret-token');
    expect(a).not.toContain('secret-token');
    expect(a).not.toBe(b);
    expect(await decrypt(a)).toBe('secret-token');
  });
  it('fails closed with a wrong or missing key', async () => {
    withKey(key);
    const blob = await encrypt('x');
    withKey(Buffer.from(new Uint8Array(32)).toString('base64'));
    await expect(decrypt(blob)).rejects.toThrow();
    withKey(undefined);
    await expect(encrypt('x')).rejects.toThrow(/TOKEN_ENCRYPTION_KEY/);
    withKey('short');
    await expect(encrypt('x')).rejects.toThrow(/32 bytes/);
  });
});
