import { describe, expect, it } from 'vitest';
import {
  backoffMs, canTransition, classifyHttp, destKey, planRotationDay, planSimultaneous, rotationSummary, zonedToUtc,
  type DestinationKey, type RotationConfig, type TargetAccount, type Video,
} from '@shared/distribution.ts';
import { finalCaption, normalizeVariant } from '@shared/captions.ts';

const accounts: TargetAccount[] = [
  { id: 'tt1', platform: 'tiktok' }, { id: 'tt2', platform: 'tiktok' }, { id: 'tt3', platform: 'tiktok' },
  { id: 'ig1', platform: 'instagram' }, { id: 'ig2', platform: 'instagram' }, { id: 'ig3', platform: 'instagram' },
];
const library: Video[] = Array.from({ length: 100 }, (_, i) => ({ id: `v${String(i).padStart(3, '0')}`, created_at: `2026-01-01T00:${String(i % 60).padStart(2, '0')}:${String(Math.floor(i / 60)).padStart(2, '0')}Z`, tags: i % 2 ? ['fruit'] : ['other'] }));
const base: RotationConfig = { strategy: 'all_accounts', videos_per_day: 4, days: [0, 1, 2, 3, 4, 5, 6], times: ['09:00', '12:00', '18:00', '21:00'] };
const WED = '2026-11-04';

describe('mode A — simultaneous', () => {
  it('one video → one publication per selected account, with per-account times', () => {
    const { planned, skipped } = planSimultaneous('v1', accounts, '2026-11-04T10:00:00.000Z', new Set(), { ig2: '2026-11-04T19:00:00.000Z' });
    expect(planned).toHaveLength(6);
    expect(skipped).toEqual([]);
    expect(planned.find((p) => p.account_id === 'ig2')!.scheduled_at).toBe('2026-11-04T19:00:00.000Z');
    expect(new Set(planned.map((p) => p.idempotency_key)).size).toBe(6);
  });
  it('skips destinations that already have this video (anti-duplicate) and ignores duplicated selections', () => {
    const { planned, skipped } = planSimultaneous('v1', [...accounts, accounts[0]!], 'x', new Set([destKey('v1', 'tt2')]));
    expect(planned.map((p) => p.account_id)).not.toContain('tt2');
    expect(planned).toHaveLength(5);
    expect(skipped).toEqual([{ account_id: 'tt2', reason: expect.stringMatching(/Already/) }]);
  });

  it('gives a new schedule a fresh key, so re-scheduling after a cancel is not taken for a duplicate', () => {
    const first = planSimultaneous('v1', [accounts[0]!], 'x', new Set(), {}, 'a').planned[0]!;
    const again = planSimultaneous('v1', [accounts[0]!], 'x', new Set(), {}, 'b').planned[0]!;
    expect(first.idempotency_key).not.toBe(again.idempotency_key);
  });
});

describe('mode B — rotation', () => {
  it('all_accounts: 4 new videos per day, each on the 6 accounts = 24 publications', () => {
    const day = planRotationDay('c1', WED, base, accounts, library, new Set(), 'Europe/Paris');
    expect(day.videosUsed).toHaveLength(4);
    expect(day.planned).toHaveLength(24);
    expect(rotationSummary(base, accounts).publicationsPerDay).toBe(24);
    expect(rotationSummary(base, accounts).text).toMatch(/4 new videos per day in total, each published on the 6 selected accounts: up to 24/);
  });
  it('balanced: each video goes to one account, spread evenly', () => {
    const cfg = { ...base, strategy: 'balanced' as const, videos_per_day: 6 };
    const day = planRotationDay('c1', WED, cfg, accounts, library, new Set(), 'Europe/Paris');
    expect(day.planned).toHaveLength(6);
    expect(new Set(day.planned.map((p) => p.account_id)).size).toBe(6);
    expect(rotationSummary(cfg, accounts).publicationsPerDay).toBe(6);
  });
  it('buckets: each video goes to every account of one group, alternating groups', () => {
    const grouped = accounts.map((a) => ({ ...a, bucket: a.platform === 'tiktok' ? 'FR' : 'INT' }));
    const day = planRotationDay('c1', WED, { ...base, strategy: 'buckets', videos_per_day: 2 }, grouped, library, new Set(), 'Europe/Paris');
    const byVideo = new Map<string, string[]>();
    for (const p of day.planned) byVideo.set(p.media_id, [...(byVideo.get(p.media_id) ?? []), p.account_id]);
    expect([...byVideo.values()].map((ids) => ids.sort())).toEqual([['tt1', 'tt2', 'tt3'], ['ig1', 'ig2', 'ig3']]);
  });
  it('manual: only the accounts chosen for each video', () => {
    const day = planRotationDay('c1', WED, { ...base, strategy: 'manual', videos_per_day: 1, manual: { v000: ['ig3'] } }, accounts, library, new Set(), 'Europe/Paris');
    expect(day.planned.map((p) => [p.media_id, p.account_id])).toEqual([['v000', 'ig3']]);
  });
  it('never reposts: day 2 picks new videos, and an exhausted library yields a shortfall, not repeats', () => {
    const existing = new Set<DestinationKey>();
    const d1 = planRotationDay('c1', WED, base, accounts, library.slice(0, 6), existing, 'Europe/Paris');
    const d2 = planRotationDay('c1', '2026-11-05', base, accounts, library.slice(0, 6), existing, 'Europe/Paris');
    expect(d1.videosUsed).toHaveLength(4);
    expect(d2.videosUsed).toHaveLength(2);
    expect(d2.videosUsed.some((v) => d1.videosUsed.includes(v))).toBe(false);
    const d3 = planRotationDay('c1', '2026-11-06', base, accounts, library.slice(0, 6), existing, 'Europe/Paris');
    expect(d3.planned).toEqual([]);
    expect(d3.shortfall).toBe(4);
    expect(d3.reason).toMatch(/Not enough/);
  });
  it('empty library: nothing planned, explicit reason', () => {
    const d = planRotationDay('c1', WED, base, accounts, [], new Set(), 'Europe/Paris');
    expect(d.planned).toEqual([]);
    expect(d.shortfall).toBe(4);
  });
  it('respects active days, tag filters, order and per-account caps', () => {
    expect(planRotationDay('c1', WED, { ...base, days: [1] }, accounts, library, new Set(), 'Europe/Paris').reason).toBe('Inactive day');
    const tagged = planRotationDay('c1', WED, { ...base, tags: ['fruit'] }, accounts, library, new Set(), 'Europe/Paris');
    expect(tagged.videosUsed.every((id) => library.find((v) => v.id === id)!.tags.includes('fruit'))).toBe(true);
    const capped = planRotationDay('c1', WED, { ...base, per_account_daily_cap: 2 }, accounts, library, new Set(), 'Europe/Paris');
    expect(capped.planned).toHaveLength(12);
  });
  it('is deterministic (same inputs, same plan) so re-planning is idempotent', () => {
    const a = planRotationDay('c1', WED, base, accounts, library, new Set(), 'Europe/Paris');
    const b = planRotationDay('c1', WED, base, accounts, library, new Set(), 'Europe/Paris');
    expect(a.planned).toEqual(b.planned);
  });
  it('places slots at local times, DST-aware', () => {
    expect(zonedToUtc('2026-11-04', '09:00', 'Europe/Paris')).toBe('2026-11-04T08:00:00.000Z'); // winter, UTC+1
    expect(zonedToUtc('2026-07-04', '09:00', 'Europe/Paris')).toBe('2026-07-04T07:00:00.000Z'); // summer, UTC+2
    expect(zonedToUtc('2026-11-04', '09:00', 'America/New_York')).toBe('2026-11-04T14:00:00.000Z');
  });
});

describe('lifecycle and errors', () => {
  it('only allows valid transitions', () => {
    expect(canTransition('scheduled', 'cancelled')).toBe(true);
    expect(canTransition('published', 'scheduled')).toBe(false);
    expect(canTransition('submitted', 'scheduled')).toBe(false); // never re-send something the platform has
    expect(canTransition('needs_attention', 'scheduled')).toBe(false);
  });
  it('never retries blindly after the request may have reached the platform', () => {
    expect(classifyHttp(null, false)).toBe('retryable');
    expect(classifyHttp(null, true)).toBe('uncertain');
    expect(classifyHttp(503, true)).toBe('uncertain');
    expect(classifyHttp(401, false)).toBe('auth');
    expect(classifyHttp(429, true)).toBe('rate_limited');
    expect(classifyHttp(400, true)).toBe('permanent');
  });
  it('backs off exponentially with a ceiling', () => {
    expect(backoffMs(1)).toBe(2 * 60_000);
    expect(backoffMs(3)).toBe(8 * 60_000);
    expect(backoffMs(20)).toBe(60 * 60_000);
  });
});

describe('caption variants', () => {
  it('drops banned hashtags, dedupes, enforces limits', () => {
    const v = normalizeVariant('tiktok', { caption: 'Hello', hook: 'x', hashtags: ['fruit', '#Fruit', '#fyp', 'drame familial', '#a', '#b', '#c', '#d', '#e', '#f'], title: 't', warnings: [] }, { banned_hashtags: ['#fyp'] });
    expect(v.hashtags).not.toContain('#fyp');
    expect(v.hashtags).toContain('#dramefamilial');
    expect(v.hashtags.length).toBeLessThanOrEqual(8);
    const long = normalizeVariant('instagram', { caption: 'x'.repeat(3000), hashtags: [] }, {});
    expect(long.caption.length).toBeLessThanOrEqual(2200);
    expect(long.warnings[0]).toMatch(/shortened/);
  });
  it('final caption appends hashtags once', () => {
    expect(finalCaption('Hi #fruit', ['#fruit', '#drama'])).toBe('Hi #fruit\n\n#drama');
  });
});
