import { AlertTriangle, CalendarDays, Check, CheckCircle2, FolderOpen, Link2, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { accountLabel, ModeBanner, PlatformDot, PubBadge } from '@/components/distribution/bits';
import { Card, CardHeader, ProgressBar } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useAccounts, useCampaigns, useIntegrations, useMedia, usePublications } from '@/hooks/useDistribution';

const WEEK = 7 * 86_400_000;

/** Distribution at a glance. Every number comes from real rows (demo mode is labelled). */
export function DistributionOverview() {
  const { data: accounts = [] } = useAccounts();
  const { data: media = [] } = useMedia();
  const { data: pubs = [] } = usePublications();
  const { data: campaigns = [] } = useCampaigns();
  const { data: integ } = useIntegrations();
  const now = Date.now();
  const connected = accounts.filter((a) => a.status === 'connected');
  const accountAlerts = accounts.filter((a) => a.status !== 'connected' || !a.can_publish);
  const upcoming = pubs.filter((p) => ['scheduled', 'queued', 'processing', 'submitted'].includes(p.status) && Date.parse(p.scheduled_at) >= now - 3600_000);
  const published7 = pubs.filter((p) => p.status === 'published' && p.published_at && Date.parse(p.published_at) > now - WEEK).length;
  const attention = pubs.filter((p) => p.status === 'failed' || p.status === 'needs_attention').length;
  const toApprove = pubs.filter((p) => !p.metadata_approved && ['draft', 'scheduled'].includes(p.status)).length;
  const stats = [
    { label: 'Connected accounts', value: connected.length, icon: Link2, to: '/app/accounts' },
    { label: 'Videos available', value: media.filter((m) => m.status === 'available').length, icon: FolderOpen, to: '/app/library' },
    { label: 'Scheduled', value: upcoming.length, icon: CalendarDays, to: '/app/calendar' },
    { label: 'Published · 7 days', value: published7, icon: CheckCircle2, to: '/app/history' },
    { label: 'Need attention', value: attention, icon: AlertTriangle, to: '/app/history' },
  ];
  const steps = [
    { label: 'Connect a TikTok or Instagram account', done: connected.length > 0, to: '/app/accounts' },
    { label: 'Import a video into your library', done: media.some((m) => m.status === 'available'), to: '/app/library' },
    { label: 'Schedule it and approve the caption', done: pubs.some((p) => p.metadata_approved), to: '/app/distribute' },
    { label: 'See your first post confirmed by the platform', done: pubs.some((p) => p.status === 'published'), to: '/app/calendar' },
  ];
  return (
    <div className="space-y-3">
      {integ && <ModeBanner {...integ} />}
      <Onboarding steps={steps} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map(({ label, value, icon: Icon, to }) => (
          <Link key={label} to={to} className="surface p-3 transition-colors hover:border-line/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 sm:p-4">
            <Icon className={label === 'Need attention' && value ? 'h-4 w-4 text-coral-300' : 'h-4 w-4 text-zinc-500'} />
            <p className="mt-3 font-display text-3xl tabular-nums text-zinc-50">{value}</p>
            <p className="truncate text-xs text-zinc-500">{label}</p>
          </Link>
        ))}
      </div>
      <Card>
        <CardHeader title="Next publications" subtitle={toApprove ? `${toApprove} caption${toApprove > 1 ? 's' : ''} to approve before they can go out` : undefined}
          action={<Link to="/app/distribute" className="touch-hit text-xs text-violet-300 hover:text-violet-200">Distribute videos</Link>} />
        {upcoming.length === 0 ? <p className="text-xs text-zinc-500">Nothing scheduled. Import videos, connect an account, then distribute.</p> : (
          <ul className="space-y-1.5">
            {upcoming.slice(0, 5).map((p) => (
              <li key={p.id} className="flex items-center gap-2.5 text-xs">
                <span className="w-24 shrink-0 tabular-nums text-zinc-400">{new Date(p.scheduled_at).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                <PlatformDot platform={p.platform} />
                <span className="min-w-0 flex-1 truncate text-zinc-200">{media.find((m) => m.id === p.media_id)?.title ?? 'Video'} → {accountLabel(accounts.find((a) => a.id === p.account_id))}</span>
                <PubBadge status={p.status} />
              </li>
            ))}
          </ul>
        )}
        {(campaigns.some((c) => c.alert) || accountAlerts.length > 0) && (
          <ul className="mt-3 space-y-1 border-t border-line/[0.06] pt-3 text-xs text-amber-300">
            {campaigns.filter((c) => c.alert).map((c) => <li key={c.id}>{c.name}: {c.alert}</li>)}
            {accountAlerts.map((a) => <li key={a.id}>{accountLabel(a)}: {a.status !== 'connected' ? 'reconnect needed' : a.publish_restriction ?? 'cannot publish'}</li>)}
          </ul>
        )}
      </Card>
    </div>
  );
}

const DISMISS_KEY = 'storyit:distribution-onboarding-dismissed';
/** Activation checklist from real data; hidden once complete or dismissed. */
function Onboarding({ steps }: { steps: { label: string; done: boolean; to: string }[] }) {
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; } });
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  if (dismissed || !next) return null;
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-zinc-100">Get your first post out</p>
          <p className="text-xs text-zinc-500">{done} of {steps.length} done</p>
        </div>
        <button onClick={() => { setDismissed(true); try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* private mode */ } }}
          aria-label="Hide checklist" className="touch-hit rounded-lg p-1.5 text-zinc-500 hover:bg-line/5 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"><X className="h-4 w-4" /></button>
      </div>
      <div className="mt-3"><ProgressBar value={done} max={steps.length} label="Onboarding progress" /></div>
      <ol className="mt-4 space-y-1.5">
        {steps.map((s) => (
          <li key={s.label}>
            <Link to={s.to} className={cn('flex min-h-11 items-center gap-3 rounded-lg px-2 py-1.5 text-sm sm:min-h-0 transition-colors hover:bg-line/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50', s === next ? 'text-zinc-100' : 'text-zinc-500')}>
              <span className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-full border', s.done ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' : 'border-line/15')}>{s.done && <Check className="h-3 w-3" />}</span>
              <span className={cn('flex-1', s.done && 'line-through decoration-zinc-600')}>{s.label}</span>
              {s === next && <span className="text-xs text-violet-300">Start</span>}
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}

