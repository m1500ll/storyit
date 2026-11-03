import { AlertTriangle, Check, ChevronDown, ExternalLink, Pause, Play, RefreshCw, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { accountLabel, fmtDateTime, inputCls, ModeBanner, Notice, PlatformDot, PubBadge } from '@/components/distribution/bits';
import { Button, Card, LoadState, PageHeader, useToast } from '@/components/ui';
import { useAccounts, useCampaigns, useIntegrations, useMedia, usePublications } from '@/hooks/useDistribution';
import { cn } from '@/lib/cn';
import { distribution, type Publication, type PublicationEvent, type PubStatus, type SocialAccount } from '@/services/distribution';
import { finalCaption } from '@shared/captions.ts';

type View = 'day' | 'week' | 'month';
const DAY = 86_400_000;
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

/** `history` = past results; otherwise the calendar of upcoming work. */
export default function PublicationsPage({ history = false }: { history?: boolean }) {
  const [params] = useSearchParams();
  const [view, setView] = useState<View>('week');
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [platform, setPlatform] = useState('');
  const [account, setAccount] = useState('');
  const [video, setVideo] = useState('');
  const [status, setStatus] = useState(params.get('status') ?? '');
  const range = useMemo(() => {
    if (history) return { to: new Date(Date.now() + DAY).toISOString() };
    const from = view === 'month' ? new Date(anchor.getFullYear(), anchor.getMonth(), 1) : anchor;
    const days = view === 'day' ? 1 : view === 'week' ? 7 : new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate();
    return { from: from.toISOString(), to: new Date(from.getTime() + days * DAY).toISOString() };
  }, [anchor, view, history]);
  const { data: pubs = [], loading, error } = usePublications(range);
  const { data: accounts = [] } = useAccounts();
  const { data: media = [] } = useMedia();
  const { data: campaigns = [] } = useCampaigns();
  const { data: integ } = useIntegrations();
  const toast = useToast();

  const rows = pubs
    .filter((p) => (!platform || p.platform === platform) && (!account || p.account_id === account) && (!video || p.media_id === video))
    .filter((p) => !status || (status === 'approval' ? !p.metadata_approved && ['draft', 'scheduled'].includes(p.status) : p.status === status))
    .filter((p) => !history || !['draft', 'scheduled'].includes(p.status))
    .sort((a, b) => (history ? -1 : 1) * a.scheduled_at.localeCompare(b.scheduled_at));
  const byDay = new Map<string, Publication[]>();
  for (const p of rows) { const k = new Date(p.scheduled_at).toDateString(); byDay.set(k, [...(byDay.get(k) ?? []), p]); }
  const needsApproval = pubs.filter((p) => !p.metadata_approved && ['draft', 'scheduled'].includes(p.status)).length;
  const attention = pubs.filter((p) => p.status === 'needs_attention' || p.status === 'failed').length;
  const shift = (n: number) => setAnchor(view === 'month' ? new Date(anchor.getFullYear(), anchor.getMonth() + n, 1) : new Date(anchor.getTime() + n * (view === 'day' ? 1 : 7) * DAY));

  return (
    <>
      <PageHeader eyebrow="Distribution" title={history ? 'Publication history' : 'Calendar'}
        description={history ? 'Every publication attempt, account by account. Retry is offered only when it is safe.' : 'Upcoming publications. Each one waits for an approved caption before it can go out.'} />
      <div className="mb-4 space-y-2">
        {integ && <ModeBanner {...integ} />}
        {!history && campaigns.filter((c) => c.mode === 'rotation').map((c) => (
          <div key={c.id} className="surface flex flex-wrap items-center gap-3 px-4 py-3">
            <span className={cn('h-2 w-2 rounded-full', c.status === 'active' ? 'bg-emerald-400' : 'bg-zinc-500')} aria-hidden />
            <span className="min-w-0 flex-1 text-sm text-zinc-200"><span className="font-medium">{c.name}</span> <span className="text-xs text-zinc-500">· {c.config.videos_per_day}/day · {c.targets.length} accounts · {c.timezone}</span>
              {c.alert && <span className="mt-0.5 flex items-center gap-1 text-xs text-amber-300"><AlertTriangle className="h-3 w-3" />{c.alert}</span>}</span>
            <Button size="sm" variant="secondary" onClick={() => distribution.setCampaignStatus(c.id, c.status === 'active' ? 'paused' : 'active').then(() => toast(c.status === 'active' ? 'Campaign paused: nothing more will be published.' : 'Campaign resumed.'))}>
              {c.status === 'active' ? <><Pause className="h-3.5 w-3.5" /> Pause</> : <><Play className="h-3.5 w-3.5" /> Resume</>}
            </Button>
          </div>
        ))}
        {!history && needsApproval > 0 && <Notice tone="warn">{needsApproval} publication{needsApproval > 1 ? 's' : ''} in this period wait{needsApproval > 1 ? '' : 's'} for caption approval. <button className="underline" onClick={() => setStatus('approval')}>Show them</button></Notice>}
        {attention > 0 && <Notice tone="error">{attention} publication{attention > 1 ? 's' : ''} failed or need{attention > 1 ? '' : 's'} a manual check. <button className="underline" onClick={() => setStatus('needs_attention')}>Show</button></Notice>}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {!history && <>
          <div role="tablist" aria-label="Calendar view" className="flex rounded-xl border border-line/10 p-0.5">
            {(['day', 'week', 'month'] as const).map((v) => <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cn('h-8 rounded-lg px-3 text-xs capitalize', view === v ? 'bg-violet-500/15 text-violet-200' : 'text-zinc-400')}>{v}</button>)}
          </div>
          <Button size="sm" variant="ghost" onClick={() => shift(-1)} aria-label="Previous period">‹</Button>
          <span className="text-xs tabular-nums text-zinc-300">{anchor.toLocaleDateString(undefined, view === 'month' ? { month: 'long', year: 'numeric' } : { day: 'numeric', month: 'short' })}</span>
          <Button size="sm" variant="ghost" onClick={() => shift(1)} aria-label="Next period">›</Button>
          <Button size="sm" variant="ghost" onClick={() => setAnchor(startOfDay(new Date()))}>Today</Button>
        </>}
        <div className="ml-auto flex flex-wrap gap-2">
          {([['platform', platform, setPlatform, [['', 'All platforms'], ['tiktok', 'TikTok'], ['instagram', 'Instagram']]],
            ['account', account, setAccount, [['', 'All accounts'], ...accounts.map((a) => [a.id, accountLabel(a)])]],
            ['video', video, setVideo, [['', 'All videos'], ...media.map((m) => [m.id, m.title])]],
            ['status', status, setStatus, [['', 'All statuses'], ['approval', 'Waiting for approval'], ['scheduled', 'Scheduled'], ['submitted', 'Processing'], ['published', 'Published'], ['failed', 'Failed'], ['needs_attention', 'Check manually'], ['cancelled', 'Cancelled']]]] as const)
            .map(([id, value, setter, opts]) => (
              <span key={id}><label htmlFor={`f-${id}`} className="sr-only">{id}</label>
                <select id={`f-${id}`} value={value} onChange={(e) => setter(e.target.value)} className={cn(inputCls, 'h-9 w-auto max-w-[11rem] text-xs')}>
                  {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select></span>
            ))}
        </div>
      </div>

      {loading || error ? <LoadState loading={loading} error={error} /> : rows.length === 0 ? (
        <Card className="py-10 text-center text-sm text-zinc-400">{history ? 'No publication attempt yet.' : 'Nothing scheduled in this period.'}</Card>
      ) : (
        <div className="space-y-5">
          {[...byDay.entries()].map(([day, list]) => (
            <section key={day}>
              <h2 className="mb-2 text-xs font-medium text-zinc-400">{new Date(day).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} <span className="text-zinc-600 tabular-nums">· {list.length}</span></h2>
              <ul className="space-y-2">{list.map((p) => <PublicationRow key={p.id} pub={p} account={accounts.find((a) => a.id === p.account_id)} videoTitle={media.find((m) => m.id === p.media_id)?.title ?? 'Video'} ai={Boolean(integ?.ai)} />)}</ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

const EDITABLE: PubStatus[] = ['draft', 'scheduled', 'failed'];

function PublicationRow({ pub, account, videoTitle, ai }: { pub: Publication; account?: SocialAccount; videoTitle: string; ai: boolean }) {
  const [open, setOpen] = useState(false);
  const [caption, setCaption] = useState(pub.caption ?? '');
  const [tags, setTags] = useState(pub.hashtags.join(' '));
  const [when, setWhen] = useState(new Date(pub.scheduled_at).toLocaleString('sv-SE').slice(0, 16).replace(' ', 'T'));
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [events, setEvents] = useState<PublicationEvent[] | null>(null);
  const toast = useToast();
  useEffect(() => { setCaption(pub.caption ?? ''); setTags(pub.hashtags.join(' ')); }, [pub.caption, pub.hashtags]);

  const editable = EDITABLE.includes(pub.status);
  const dirty = caption !== (pub.caption ?? '') || tags !== pub.hashtags.join(' ');
  const hashtags = tags.split(/[\s,]+/).filter(Boolean).map((t) => '#' + t.replace(/^#+/, ''));
  const full = finalCaption(caption, hashtags);
  const run = async (k: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(k); setErr(null);
    try { await fn(); if (ok) toast(ok); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(null); }
  };
  const save = (approve: boolean) => run(approve ? 'approve' : 'save', () => distribution.updatePublication(pub.id, {
    caption, hashtags, caption_edited: dirty || pub.caption_edited, metadata_source: dirty ? 'manual' : pub.metadata_source, metadata_approved: approve,
  }), approve ? 'Caption approved.' : 'Caption saved.');
  const generate = (force: boolean) => run('ai', async () => {
    const [r] = await distribution.generateCaptions([pub.id], force);
    if (r && !r.ok) throw new Error(r.error ?? r.skipped ?? 'Not generated');
  }, 'New caption written for this account only.');

  return (
    <li className="surface">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
        <span className="w-12 shrink-0 text-xs tabular-nums text-zinc-400">{new Date(pub.scheduled_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
        <PlatformDot platform={pub.platform} />
        <span className="min-w-0 flex-1"><span className="block truncate text-sm text-zinc-100">{videoTitle}</span><span className="block truncate text-[11px] text-zinc-500">{accountLabel(account)}</span></span>
        {!pub.metadata_approved && ['draft', 'scheduled'].includes(pub.status) && <span className="hidden shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300 sm:inline">Caption to approve</span>}
        <PubBadge status={pub.status} />
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-zinc-500 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div className="border-t border-line/[0.06] px-4 py-3">
          {pub.last_error && <p role="alert" className="mb-2 text-xs text-coral-300">{pub.last_error}</p>}
          {pub.metadata_warnings.length > 0 && <p className="mb-2 text-xs text-amber-300">To check: {pub.metadata_warnings.join(' · ')}</p>}
          <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
            <div className="min-w-0">
              <label htmlFor={`cap-${pub.id}`} className="text-xs text-zinc-400">Caption for {accountLabel(account)}{pub.caption_edited && <span className="text-zinc-500"> · edited by you</span>}</label>
              <textarea id={`cap-${pub.id}`} rows={4} disabled={!editable} value={caption} onChange={(e) => setCaption(e.target.value)} className={cn(inputCls, 'mt-1 h-auto py-2')} placeholder="Write the caption for this account…" />
              <label htmlFor={`tags-${pub.id}`} className="mt-2 block text-xs text-zinc-400">Hashtags</label>
              <input id={`tags-${pub.id}`} disabled={!editable} value={tags} onChange={(e) => setTags(e.target.value)} className={cn(inputCls, 'mt-1')} placeholder="#FruitDrama #DrameFamilial…" />
              <p className={cn('mt-1 text-[11px] tabular-nums', full.length > 2200 ? 'text-coral-300' : 'text-zinc-500')}>{full.length}/2200</p>
              {editable && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button size="sm" disabled={!caption.trim() || full.length > 2200} loading={busy === 'approve'} onClick={() => save(true)}><Check className="h-3.5 w-3.5" /> {pub.metadata_approved && !dirty ? 'Approved' : 'Approve caption'}</Button>
                  {dirty && <Button size="sm" variant="secondary" loading={busy === 'save'} onClick={() => save(false)}>Save draft</Button>}
                  <Button size="sm" variant="ghost" disabled={!ai} title={ai ? undefined : 'AI captions are not configured'} loading={busy === 'ai'}
                    onClick={() => (pub.caption_edited && !window.confirm('Replace your edited caption with a new AI caption?') ? undefined : generate(pub.caption_edited))}>
                    <Sparkles className="h-3.5 w-3.5" /> {pub.caption ? 'Rewrite with AI' : 'Write with AI'}
                  </Button>
                  {!ai && <span className="self-center text-[11px] text-zinc-500">AI not configured: write it yourself.</span>}
                </div>
              )}
            </div>
            <div className="space-y-2 text-xs">
              {['draft', 'scheduled'].includes(pub.status) && (
                <div className="flex gap-1.5">
                  <label htmlFor={`w-${pub.id}`} className="sr-only">New time</label>
                  <input id={`w-${pub.id}`} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={cn(inputCls, 'h-9 text-xs')} />
                  <Button size="sm" variant="secondary" loading={busy === 'move'} onClick={() => run('move', () => distribution.updatePublication(pub.id, { scheduled_at: new Date(when).toISOString() }), 'Moved.')}>Move</Button>
                </div>
              )}
              {pub.status === 'failed' && <Button size="sm" className="w-full" loading={busy === 'retry'} onClick={() => run('retry', () => distribution.updatePublication(pub.id, { status: 'scheduled', scheduled_at: new Date().toISOString() }), 'Will retry within a minute (if the caption is approved).')}><RefreshCw className="h-3.5 w-3.5" /> Retry</Button>}
              {pub.status === 'needs_attention' && <Notice tone="warn">Open the account in the app: if the video is there, cancel this entry. Storyit never re-sends it automatically.</Notice>}
              {['draft', 'scheduled', 'failed', 'needs_attention'].includes(pub.status) && <Button size="sm" variant="ghost" className="w-full" loading={busy === 'cancel'} onClick={() => run('cancel', () => distribution.updatePublication(pub.id, { status: 'cancelled' }), 'Cancelled.')}><X className="h-3.5 w-3.5" /> Cancel this publication</Button>}
              {pub.external_url && <a href={pub.external_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-violet-300"><ExternalLink className="h-3 w-3" /> Open the post</a>}
              <dl className="space-y-1 text-zinc-500">
                <div>Planned: {fmtDateTime(pub.scheduled_at)}</div>
                {pub.published_at && <div>Published: {fmtDateTime(pub.published_at)}</div>}
                <div>Attempts: {pub.attempts}/{pub.max_attempts}</div>
                {pub.last_checked_at && <div>Last check: {fmtDateTime(pub.last_checked_at)}</div>}
                {pub.external_post_id && <div className="truncate">Post id: {pub.external_post_id}</div>}
              </dl>
              <button className="text-zinc-400 underline" onClick={() => distribution.listEvents(pub.id).then(setEvents)}>Show event log</button>
              {events && <ol className="max-h-40 space-y-1 overflow-y-auto text-[11px] text-zinc-500">{events.map((e) => <li key={e.id}>{fmtDateTime(e.created_at)} · {e.type}{e.detail.to ? ` → ${String(e.detail.to)}` : ''}{e.detail.error ? ` (${String(e.detail.error).slice(0, 80)})` : ''}</li>)}</ol>}
            </div>
          </div>
          {err && <p role="alert" className="mt-2 text-xs text-coral-300">{err}</p>}
        </div>
      )}
    </li>
  );
}
