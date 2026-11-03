import { AlertTriangle, CalendarDays, CheckCircle2, FolderOpen, Link2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { accountLabel, ModeBanner, PlatformDot, PubBadge } from '@/components/distribution/bits';
import { Card, CardHeader } from '@/components/ui';
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
  return (
    <div className="space-y-3">
      {integ && <ModeBanner {...integ} />}
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
          action={<Link to="/app/distribute" className="text-xs text-violet-300 hover:text-violet-200">Distribute videos</Link>} />
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
