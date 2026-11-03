import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { Platform, PubStatus, SocialAccount } from '@/services/distribution';

export const PLATFORM_NAME: Record<Platform, string> = { tiktok: 'TikTok', instagram: 'Instagram' };

export function PlatformDot({ platform, className }: { platform: Platform; className?: string }) {
  return <span aria-hidden className={cn('inline-block h-2 w-2 shrink-0 rounded-full', platform === 'tiktok' ? 'bg-sky-500' : 'bg-coral-400', className)} />;
}

export const accountLabel = (a?: Pick<SocialAccount, 'username' | 'display_name' | 'platform'> | null) =>
  a ? `${a.username ? '@' + a.username : a.display_name ?? 'Account'} · ${PLATFORM_NAME[a.platform]}` : 'Unknown account';

const PUB_STYLE: Record<PubStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'text-zinc-400 bg-line/5' },
  scheduled: { label: 'Scheduled', cls: 'text-sky-300 bg-sky-500/10' },
  queued: { label: 'Queued', cls: 'text-sky-300 bg-sky-500/10' },
  processing: { label: 'Uploading', cls: 'text-violet-300 bg-violet-500/10' },
  submitted: { label: 'Processing on platform', cls: 'text-violet-300 bg-violet-500/10' },
  published: { label: 'Published', cls: 'text-emerald-300 bg-emerald-500/10' },
  failed: { label: 'Failed', cls: 'text-coral-300 bg-coral-500/10' },
  cancelled: { label: 'Cancelled', cls: 'text-zinc-500 bg-line/5' },
  needs_attention: { label: 'Check manually', cls: 'text-amber-300 bg-amber-500/10' },
};
export function PubBadge({ status }: { status: PubStatus }) {
  const s = PUB_STYLE[status];
  return <span className={cn('inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium', s.cls)}>{s.label}</span>;
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'error' | 'ok'; children: ReactNode }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-xl border px-4 py-3 text-xs',
      tone === 'info' && 'border-line/10 bg-line/[0.03] text-zinc-300',
      tone === 'warn' && 'border-amber-500/30 bg-amber-500/10 text-amber-200',
      tone === 'error' && 'border-coral-500/30 bg-coral-500/10 text-coral-300',
      tone === 'ok' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200')}>
      {children}
    </div>
  );
}

export const inputCls = 'h-10 w-full min-w-0 rounded-xl border border-line/10 bg-transparent px-3 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50';

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs text-zinc-400">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-zinc-500">{hint}</p>}
    </div>
  );
}

export const fmtDateTime = (iso: string, tz?: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: tz }).format(new Date(iso));
export const browserTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
export const TIMEZONES = ['Europe/Paris', 'Europe/London', 'Europe/Brussels', 'Europe/Madrid', 'America/New_York', 'America/Los_Angeles', 'America/Montreal', 'Africa/Casablanca', 'Asia/Dubai', 'UTC'];

/** Demo / not-configured banner shared by every distribution page. */
export function ModeBanner({ live, tiktok, instagram }: { live: boolean; tiktok: boolean; instagram: boolean }) {
  if (!live) return <Notice tone="warn">Demo mode: this browser is not connected to a Storyit server. Accounts shown are examples, and nothing is ever published.</Notice>;
  if (!tiktok && !instagram) return <Notice tone="warn">Account connection is being set up: TikTok and Instagram apps are not configured on this server yet. You can already build your library and plan your calendar.</Notice>;
  return null;
}
