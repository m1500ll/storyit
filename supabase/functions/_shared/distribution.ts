/**
 * Distribution engine — pure logic shared by the `publisher` Edge Function (Deno) and the web app (Vite/Vitest).
 * No I/O here: callers pass the data in and persist what comes out.
 */

export type Platform = 'tiktok' | 'instagram';
export type PubStatus = 'draft' | 'scheduled' | 'queued' | 'processing' | 'submitted' | 'published' | 'failed' | 'cancelled' | 'needs_attention';
export type RotationStrategy = 'balanced' | 'all_accounts' | 'buckets' | 'manual';

export interface TargetAccount { id: string; platform: Platform; bucket?: string | null }
export interface Video { id: string; created_at: string; tags: string[]; title?: string }
/** A (video, account) pair that already has a non-failed, non-cancelled publication. */
export type DestinationKey = `${string}:${string}`;
export const destKey = (mediaId: string, accountId: string): DestinationKey => `${mediaId}:${accountId}`;

export interface PlannedPublication { media_id: string; account_id: string; platform: Platform; scheduled_at: string; idempotency_key: string }

export interface RotationConfig {
  strategy: RotationStrategy;
  /** Number of NEW videos picked per day, in total for the campaign (not per account). */
  videos_per_day: number;
  /** Local days of week, 0 = Sunday. */
  days: number[];
  /** Local times "HH:MM"; videos of the day are spread over these slots in order. */
  times: string[];
  tags?: string[];
  order?: 'oldest_first' | 'newest_first';
  /** Max publications per account per local day (null = no cap). */
  per_account_daily_cap?: number | null;
  /** never = a video is never sent twice to the same account (only policy supported for now). */
  repeat_policy?: 'never';
  /** What to do when no eligible video is left. Never auto-reposts. */
  empty_policy?: 'pause' | 'skip_day';
  /** Manual strategy: explicit destination accounts per video id. */
  manual?: Record<string, string[]>;
}

// ---------- Lifecycle ----------

const TRANSITIONS: Record<PubStatus, PubStatus[]> = {
  draft: ['scheduled', 'cancelled'],
  scheduled: ['draft', 'queued', 'processing', 'cancelled'],
  queued: ['processing', 'cancelled'],
  processing: ['submitted', 'published', 'failed', 'scheduled', 'needs_attention'],
  submitted: ['published', 'failed', 'needs_attention', 'submitted'],
  published: [],
  failed: ['scheduled', 'cancelled'],
  cancelled: [],
  needs_attention: ['published', 'failed', 'cancelled'],
};
export const canTransition = (from: PubStatus, to: PubStatus) => TRANSITIONS[from].includes(to);
/** Statuses that block another publication of the same video on the same account. */
export const BLOCKING: PubStatus[] = ['draft', 'scheduled', 'queued', 'processing', 'submitted', 'published', 'needs_attention'];

/** Exponential backoff with a ceiling: 2, 4, 8 … minutes, max 60. */
export const backoffMs = (attempt: number) => Math.min(60, 2 ** Math.max(1, attempt)) * 60_000;

// ---------- Time zones ----------

/** Offset (ms) of `timeZone` at instant `date`: local wall time − UTC. */
function tzOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - date.getTime();
}

/** Converts a local date ("2026-11-05") + time ("09:30") in `timeZone` to a UTC ISO string (DST-safe). */
export function zonedToUtc(localDate: string, time: string, timeZone: string): string {
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let utc = guess - tzOffsetMs(new Date(guess), timeZone);
  utc = guess - tzOffsetMs(new Date(utc), timeZone); // second pass fixes DST edges
  return new Date(utc).toISOString();
}

/** Local calendar date ("YYYY-MM-DD") of an instant in `timeZone`. */
export function localDate(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
}
export const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
export const dayOfWeek = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

export function isValidTimeZone(tz: string) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

// ---------- Mode A: simultaneous ----------

/**
 * One video → one publication per selected account. `times` may override the default time per account.
 * Destinations that already have a blocking publication are skipped and reported (anti-duplicate).
 */
export function planSimultaneous(
  mediaId: string, accounts: TargetAccount[], defaultAt: string, existing: Set<DestinationKey>,
  times: Record<string, string> = {},
): { planned: PlannedPublication[]; skipped: { account_id: string; reason: string }[] } {
  const planned: PlannedPublication[] = [];
  const skipped: { account_id: string; reason: string }[] = [];
  for (const a of uniqueById(accounts)) {
    if (existing.has(destKey(mediaId, a.id))) { skipped.push({ account_id: a.id, reason: 'Already published or scheduled on this account' }); continue; }
    planned.push({ media_id: mediaId, account_id: a.id, platform: a.platform, scheduled_at: times[a.id] ?? defaultAt, idempotency_key: `once:${mediaId}:${a.id}` });
  }
  return { planned, skipped };
}

// ---------- Mode B: rotation ----------

export interface DayPlan { date: string; planned: PlannedPublication[]; videosUsed: string[]; shortfall: number; reason?: string }

/**
 * Plans one local day of a rotation campaign. Deterministic: same inputs → same output, and the
 * idempotency key (campaign + video + account) makes re-running the planner harmless.
 */
export function planRotationDay(
  campaignId: string, date: string, cfg: RotationConfig, accounts: TargetAccount[], library: Video[],
  existing: Set<DestinationKey>, timeZone: string, alreadyToday: Record<string, number> = {},
): DayPlan {
  if (!cfg.days.includes(dayOfWeek(date))) return { date, planned: [], videosUsed: [], shortfall: 0, reason: 'Inactive day' };
  const targets = uniqueById(accounts);
  if (!targets.length) return { date, planned: [], videosUsed: [], shortfall: cfg.videos_per_day, reason: 'No account selected' };

  const tags = (cfg.tags ?? []).map((t) => t.toLowerCase());
  const eligible = library
    .filter((v) => !tags.length || v.tags.some((t) => tags.includes(t.toLowerCase())))
    .sort((a, b) => (cfg.order === 'newest_first' ? -1 : 1) * a.created_at.localeCompare(b.created_at));

  const times = cfg.times.length ? [...cfg.times].sort() : ['12:00'];
  const perDay: Record<string, number> = { ...alreadyToday };
  const cap = cfg.per_account_daily_cap ?? null;
  const room = (id: string) => cap === null || (perDay[id] ?? 0) < cap;
  const planned: PlannedPublication[] = [];
  const used: string[] = [];

  // Destinations for a video, according to the strategy.
  const groups = cfg.strategy === 'buckets' ? bucketsOf(targets) : [];
  const destinationsFor = (videoId: string, slot: number): TargetAccount[] => {
    switch (cfg.strategy) {
      case 'all_accounts': return targets;
      case 'manual': return targets.filter((a) => cfg.manual?.[videoId]?.includes(a.id));
      case 'buckets': return groups[slot % Math.max(groups.length, 1)] ?? [];
      case 'balanced': default: {
        // One account per video: the least-used account today, ties broken by a rotation on the slot number.
        const n = targets.length;
        const pick = targets.map((a, i) => ({ a, turn: (i - slot + n * 100) % n }))
          .sort((x, y) => (perDay[x.a.id] ?? 0) - (perDay[y.a.id] ?? 0) || x.turn - y.turn)
          .find(({ a }) => room(a.id) && !existing.has(destKey(videoId, a.id)));
        return pick ? [pick.a] : [];
      }
    }
  };

  for (const video of eligible) {
    if (used.length >= cfg.videos_per_day) break;
    const slot = used.length;
    const dests = destinationsFor(video.id, slot).filter((a) => room(a.id) && !existing.has(destKey(video.id, a.id)));
    if (!dests.length) continue; // video already sent everywhere it could go: never repost
    const at = zonedToUtc(date, times[slot % times.length]!, timeZone);
    for (const a of dests) {
      planned.push({ media_id: video.id, account_id: a.id, platform: a.platform, scheduled_at: at, idempotency_key: `rot:${campaignId}:${video.id}:${a.id}` });
      perDay[a.id] = (perDay[a.id] ?? 0) + 1;
      existing.add(destKey(video.id, a.id));
    }
    used.push(video.id);
  }
  const shortfall = cfg.videos_per_day - used.length;
  return { date, planned, videosUsed: used, shortfall, reason: shortfall > 0 ? 'Not enough eligible videos left in the library' : undefined };
}

function bucketsOf(accounts: TargetAccount[]): TargetAccount[][] {
  const map = new Map<string, TargetAccount[]>();
  for (const a of accounts) map.set(a.bucket || 'default', [...(map.get(a.bucket || 'default') ?? []), a]);
  return [...map.values()];
}
function uniqueById<T extends { id: string }>(list: T[]) { return [...new Map(list.map((x) => [x.id, x])).values()]; }

// ---------- Volume summary shown before activation ----------

export function rotationSummary(cfg: RotationConfig, accounts: TargetAccount[]): { videosPerDay: number; publicationsPerDay: number; text: string } {
  const n = uniqueById(accounts).length;
  const buckets = bucketsOf(uniqueById(accounts));
  const v = cfg.videos_per_day;
  const cap = cfg.per_account_daily_cap;
  let pubs: number;
  let text: string;
  switch (cfg.strategy) {
    case 'all_accounts':
      pubs = v * n;
      text = `${v} new video${v > 1 ? 's' : ''} per day in total, each published on the ${n} selected account${n > 1 ? 's' : ''}: up to ${pubs} publications per day.`;
      break;
    case 'buckets': {
      const avg = buckets.length ? n / buckets.length : 0;
      pubs = Math.round(v * avg);
      text = `${v} new video${v > 1 ? 's' : ''} per day in total, rotating between ${buckets.length} group${buckets.length > 1 ? 's' : ''}; each video goes to every account of one group: about ${pubs} publications per day.`;
      break;
    }
    case 'manual':
      pubs = NaN;
      text = `${v} video${v > 1 ? 's' : ''} per day, each to the accounts you chose for it.`;
      break;
    default:
      pubs = Math.min(v, n * (cap ?? Infinity));
      text = `${v} new video${v > 1 ? 's' : ''} per day in total, each published on ONE account, rotating across ${n} account${n > 1 ? 's' : ''} (~${n ? (v / n).toFixed(1) : 0} per account): up to ${pubs} publications per day.`;
  }
  if (cap) {
    pubs = Number.isNaN(pubs) ? pubs : Math.min(pubs, cap * n);
    text += ` Capped at ${cap} per account per day.`;
  }
  return { videosPerDay: v, publicationsPerDay: pubs, text };
}

/** Days of library left: how long the eligible library lasts at this pace (each video used once per destination). */
export function libraryRunway(eligibleVideos: number, cfg: RotationConfig) {
  const activeDaysPerWeek = cfg.days.length;
  if (!cfg.videos_per_day || !activeDaysPerWeek) return Infinity;
  return Math.floor(eligibleVideos / cfg.videos_per_day);
}

// ---------- Publishing errors ----------

export type ErrorKind = 'retryable' | 'auth' | 'permanent' | 'uncertain' | 'rate_limited';
export function classifyHttp(status: number | null, sent: boolean): ErrorKind {
  if (status === null) return sent ? 'uncertain' : 'retryable'; // timeout/network: if the request may have reached the platform, never resend blindly
  if (status === 401) return 'auth';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return sent ? 'uncertain' : 'retryable';
  return 'permanent';
}
