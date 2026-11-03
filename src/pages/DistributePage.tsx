import { Repeat, Send } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { accountLabel, browserTz, Field, inputCls, ModeBanner, Notice, PlatformDot, TIMEZONES } from '@/components/distribution/bits';
import { Button, Card, PageHeader, useToast } from '@/components/ui';
import { useAccounts, useGroups, useIntegrations, useMedia, usePublications } from '@/hooks/useDistribution';
import { cn } from '@/lib/cn';
import { distribution, type RotationConfig, type SocialAccount } from '@/services/distribution';
import { destKey, libraryRunway, planSimultaneous, rotationSummary, zonedToUtc, type DestinationKey } from '@shared/distribution.ts';
import { checkVideo } from '@shared/platformSpecs.ts';

const BLOCKING = ['draft', 'scheduled', 'queued', 'processing', 'submitted', 'published', 'needs_attention'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STRATEGIES: { id: RotationConfig['strategy']; label: string; help: string }[] = [
  { id: 'all_accounts', label: 'Every video on every selected account', help: 'Each new video of the day goes to all the accounts below.' },
  { id: 'balanced', label: 'Balanced: one account per video', help: 'Videos rotate across accounts so each account gets a different video.' },
  { id: 'buckets', label: 'Split between groups', help: 'Give accounts a group letter; each video goes to every account of one group, groups take turns.' },
  { id: 'manual', label: 'Manual per video', help: 'Choose destinations video by video from the library.' },
];

function AccountPicker({ accounts, selected, onChange, groups }: {
  accounts: SocialAccount[]; selected: Set<string>; onChange: (s: Set<string>) => void; groups: { id: string; name: string }[];
}) {
  const usable = accounts.filter((a) => a.status === 'connected');
  const set = (ids: string[], on: boolean) => { const n = new Set(selected); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); onChange(n); };
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        <Button size="sm" variant="secondary" onClick={() => set(usable.map((a) => a.id), true)}>All accounts</Button>
        {groups.map((g) => {
          const ids = usable.filter((a) => a.group_id === g.id).map((a) => a.id);
          return ids.length ? <Button key={g.id} size="sm" variant="secondary" onClick={() => set(ids, true)}>{g.name} · {ids.length}</Button> : null;
        })}
        {selected.size > 0 && <Button size="sm" variant="ghost" onClick={() => onChange(new Set())}>Clear</Button>}
      </div>
      {usable.length === 0 ? <Notice tone="warn">No connected account. Connect one in Social accounts first.</Notice> : (
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {usable.map((a) => (
            <li key={a.id}>
              <label className={cn('flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-sm', selected.has(a.id) ? 'border-violet-500/50 bg-violet-500/10' : 'border-line/[0.07]')}>
                <input type="checkbox" className="h-4 w-4 accent-violet-500" checked={selected.has(a.id)} onChange={(e) => set([a.id], e.target.checked)} />
                <PlatformDot platform={a.platform} />
                <span className="min-w-0 flex-1 truncate text-zinc-200">{accountLabel(a)}</span>
                {!a.can_publish && <span className="shrink-0 text-[10px] text-amber-300" title={a.publish_restriction ?? ''}>Can't publish</span>}
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function DistributePage() {
  const [params] = useSearchParams();
  const [mode, setMode] = useState<'simultaneous' | 'rotation'>(params.get('mode') === 'rotation' ? 'rotation' : 'simultaneous');
  const { data: integ } = useIntegrations();
  return (
    <>
      <PageHeader eyebrow="Distribution" title="Distribute videos" description="Choose how your library reaches your accounts. Every video × account becomes its own publication, with its own caption and status." />
      {integ && <div className="mb-4"><ModeBanner {...integ} /></div>}
      <div role="tablist" aria-label="Distribution mode" className="mb-4 grid gap-2 sm:grid-cols-2">
        {([['simultaneous', Send, 'Simultaneous', 'One or more videos, many accounts, now or at a set time.'], ['rotation', Repeat, 'Rotation', 'An automatic daily schedule fed by your library.']] as const).map(([id, Icon, label, help]) => (
          <button key={id} role="tab" aria-selected={mode === id} onClick={() => setMode(id)}
            className={cn('surface flex items-start gap-3 p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50', mode === id ? 'border-violet-500/50 bg-violet-500/[0.06]' : 'hover:border-line/20')}>
            <Icon className="mt-0.5 h-4 w-4 text-violet-300" aria-hidden />
            <span><span className="block text-sm font-medium text-zinc-100">{label}</span><span className="block text-xs text-zinc-500">{help}</span></span>
          </button>
        ))}
      </div>
      {mode === 'simultaneous' ? <Simultaneous initial={params.get('videos')?.split(',').filter(Boolean) ?? []} /> : <Rotation />}
    </>
  );
}

function Simultaneous({ initial }: { initial: string[] }) {
  const { data: media = [] } = useMedia();
  const { data: accounts = [] } = useAccounts();
  const { data: groups = [] } = useGroups();
  const { data: pubs = [] } = usePublications();
  const [videos, setVideos] = useState<Set<string>>(new Set(initial));
  const [targets, setTargets] = useState<Set<string>>(new Set());
  const [tz, setTz] = useState(browserTz());
  const [when, setWhen] = useState(() => { const d = new Date(Date.now() + 3600_000); d.setMinutes(0, 0, 0); return d.toLocaleString('sv-SE').slice(0, 16).replace(' ', 'T'); });
  const [perAccount, setPerAccount] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();
  const toast = useToast();

  const available = media.filter((m) => m.status === 'available');
  const existing = useMemo(() => new Set<DestinationKey>(pubs.filter((p) => BLOCKING.includes(p.status)).map((p) => destKey(p.media_id, p.account_id))), [pubs]);
  const chosen = accounts.filter((a) => targets.has(a.id));
  const toUtc = (local: string) => (local ? zonedToUtc(local.slice(0, 10), local.slice(11, 16), tz) : '');
  const plan = [...videos].map((v) => {
    const raw = planSimultaneous(v, chosen, toUtc(when), new Set(existing), Object.fromEntries(Object.entries(perAccount).filter(([, t]) => t).map(([id, t]) => [id, toUtc(t)])));
    const m = media.find((x) => x.id === v);
    // Platform constraints are checked before anything is scheduled.
    const blocked = raw.planned.map((p) => ({ p, issues: m ? checkVideo(p.platform, m).filter((i) => i.level === 'error') : [] })).filter((x) => x.issues.length);
    return { v, planned: raw.planned.filter((p) => !blocked.some((b) => b.p === p)),
      skipped: [...raw.skipped, ...blocked.map((b) => ({ account_id: b.p.account_id, reason: b.issues.map((i) => i.message).join(', ') }))] };
  });
  const total = plan.reduce((n, p) => n + p.planned.length, 0);
  const skipped = plan.reduce((n, p) => n + p.skipped.length, 0);
  const inPast = when && Date.parse(toUtc(when)) < Date.now() - 60_000;
  const hasTikTok = chosen.some((a) => a.platform === 'tiktok');
  const [consent, setConsent] = useState(false);

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const { created, duplicates } = await distribution.schedulePublications(plan.flatMap((p) => p.planned));
      toast(`${created} publication${created > 1 ? 's' : ''} scheduled${duplicates ? ` · ${duplicates} duplicate${duplicates > 1 ? 's' : ''} skipped` : ''}. Review the captions before they go out.`);
      navigate('/app/calendar?status=approval');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-4">
        <Card>
          <p className="label">1 · Videos</p>
          {available.length === 0 ? <p className="mt-3 text-xs text-zinc-500">No available video. Import some in the Library.</p> : (
            <ul className="mt-3 grid max-h-64 gap-1.5 overflow-y-auto sm:grid-cols-2">
              {available.map((m) => (
                <li key={m.id}><label className={cn('flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-sm', videos.has(m.id) ? 'border-violet-500/50 bg-violet-500/10' : 'border-line/[0.07]')}>
                  <input type="checkbox" className="h-4 w-4 accent-violet-500" checked={videos.has(m.id)} onChange={(e) => { const n = new Set(videos); if (e.target.checked) n.add(m.id); else n.delete(m.id); setVideos(n); }} />
                  <span className="min-w-0 flex-1 truncate text-zinc-200">{m.title}</span>
                </label></li>
              ))}
            </ul>
          )}
        </Card>
        <Card><p className="label mb-3">2 · Accounts</p><AccountPicker accounts={accounts} groups={groups} selected={targets} onChange={setTargets} /></Card>
        <Card>
          <p className="label mb-3">3 · When</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date and time" htmlFor="when"><input id="when" type="datetime-local" className={inputCls} value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
            <Field label="Time zone" htmlFor="tz"><select id="tz" className={inputCls} value={tz} onChange={(e) => setTz(e.target.value)}>{[...new Set([tz, ...TIMEZONES])].map((z) => <option key={z}>{z}</option>)}</select></Field>
          </div>
          {chosen.length > 1 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-zinc-400">Different time for some accounts</summary>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {chosen.map((a) => <Field key={a.id} label={accountLabel(a)} htmlFor={`t-${a.id}`}><input id={`t-${a.id}`} type="datetime-local" className={inputCls} value={perAccount[a.id] ?? ''} onChange={(e) => setPerAccount({ ...perAccount, [a.id]: e.target.value })} /></Field>)}
              </div>
            </details>
          )}
          {inPast && <p className="mt-2 text-[11px] text-amber-300">This time is in the past: publications will start as soon as their captions are approved.</p>}
        </Card>
      </div>
      <Card className="self-start lg:sticky lg:top-24">
        <p className="label">Summary</p>
        <p className="mt-3 font-display text-3xl tabular-nums text-zinc-50">{total}</p>
        <p className="text-xs text-zinc-400">publication{total > 1 ? 's' : ''}: {videos.size} video{videos.size > 1 ? 's' : ''} × {chosen.length} account{chosen.length > 1 ? 's' : ''}{skipped ? `, ${skipped} skipped, see below` : ''}.</p>
        {skipped > 0 && <ul className="mt-2 space-y-0.5 text-[11px] text-amber-300">{plan.flatMap((p) => p.skipped.map((x) => <li key={p.v + x.account_id}>Skipped {media.find((m) => m.id === p.v)?.title} → {accountLabel(accounts.find((a) => a.id === x.account_id))}: {x.reason}</li>))}</ul>}
        <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-[11px] text-zinc-500">
          {plan.flatMap((p) => p.planned.map((x) => <li key={x.idempotency_key} className="truncate">{media.find((m) => m.id === x.media_id)?.title} → {accountLabel(accounts.find((a) => a.id === x.account_id))}</li>))}
        </ul>
        <Notice>Next: each publication gets its own caption (AI or written by you). Nothing is posted before you approve its caption.</Notice>
        {hasTikTok && (
          <label className="mt-3 flex gap-2 text-xs text-zinc-300">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-violet-500" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>I agree to TikTok's Music Usage Confirmation and I own the rights to these videos.</span>
          </label>
        )}
        {err && <p role="alert" className="mt-2 text-xs text-coral-300">{err}</p>}
        <Button className="mt-4 w-full" disabled={!total || !when || (hasTikTok && !consent)} loading={busy} onClick={submit}>Schedule {total || ''} publication{total > 1 ? 's' : ''}</Button>
      </Card>
    </div>
  );
}

function Rotation() {
  const { data: media = [] } = useMedia();
  const { data: accounts = [] } = useAccounts();
  const { data: groups = [] } = useGroups();
  const { data: integ } = useIntegrations();
  const [name, setName] = useState('');
  const [targets, setTargets] = useState<Set<string>>(new Set());
  const [buckets, setBuckets] = useState<Record<string, string>>({});
  const [tz, setTz] = useState(browserTz());
  const [cfg, setCfg] = useState<RotationConfig & { auto_approve: boolean }>({
    strategy: 'all_accounts', videos_per_day: 2, days: [1, 2, 3, 4, 5, 6, 0], times: ['12:00', '19:00'], order: 'oldest_first',
    per_account_daily_cap: null, repeat_policy: 'never', empty_policy: 'pause', tags: [], auto_approve: false,
  });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();
  const toast = useToast();

  const chosen = accounts.filter((a) => targets.has(a.id)).map((a) => ({ ...a, bucket: buckets[a.id] || 'A' }));
  const summary = rotationSummary(cfg, chosen);
  const eligible = media.filter((m) => m.status === 'available' && (!cfg.tags?.length || m.tags.some((t) => cfg.tags!.includes(t)))).length;
  const runway = libraryRunway(eligible, cfg);
  const hasTikTok = chosen.some((a) => a.platform === 'tiktok');
  const allTags = [...new Set(media.flatMap((m) => m.tags))];
  const ready = name.trim() && chosen.length && cfg.days.length && cfg.times.length && cfg.videos_per_day > 0 && (!hasTikTok || consent) && cfg.strategy !== 'manual';

  const activate = async () => {
    setBusy(true); setErr(null);
    try {
      await distribution.createCampaign({ name: name.trim(), mode: 'rotation', timezone: tz, config: cfg, targets: chosen.map((a) => ({ account_id: a.id, bucket: cfg.strategy === 'buckets' ? a.bucket : null })) });
      toast('Campaign active. The server plans today and tomorrow, then keeps going every day.');
      navigate('/app/calendar');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="min-w-0 space-y-4">
        <Card><Field label="Campaign name" htmlFor="c-name"><input id="c-name" className={inputCls} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="Fruit Drama FR — quotidien…" /></Field></Card>
        <Card><p className="label mb-3">Accounts</p><AccountPicker accounts={accounts} groups={groups} selected={targets} onChange={setTargets} /></Card>
        <Card>
          <p className="label mb-3">Distribution rule</p>
          <div className="space-y-2" role="radiogroup" aria-label="Distribution rule">
            {STRATEGIES.map((s) => (
              <label key={s.id} className={cn('flex cursor-pointer gap-3 rounded-xl border px-3 py-2.5', cfg.strategy === s.id ? 'border-violet-500/50 bg-violet-500/10' : 'border-line/[0.07]')}>
                <input type="radio" name="strategy" className="mt-1 accent-violet-500" checked={cfg.strategy === s.id} onChange={() => setCfg({ ...cfg, strategy: s.id })} />
                <span><span className="block text-sm text-zinc-100">{s.label}</span><span className="block text-xs text-zinc-500">{s.help}</span></span>
              </label>
            ))}
          </div>
          {cfg.strategy === 'manual' && <Notice tone="warn">Manual per-video destinations are set with the Simultaneous mode (select a video, pick its accounts). A rotation needs one of the automatic rules.</Notice>}
          {cfg.strategy === 'buckets' && chosen.length > 0 && (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {chosen.map((a) => (
                <li key={a.id} className="flex items-center gap-2 text-xs"><span className="min-w-0 flex-1 truncate text-zinc-300">{accountLabel(a)}</span>
                  <label htmlFor={`b-${a.id}`} className="sr-only">Group letter</label>
                  <select id={`b-${a.id}`} className={cn(inputCls, 'h-8 w-16')} value={a.bucket} onChange={(e) => setBuckets({ ...buckets, [a.id]: e.target.value })}>{['A', 'B', 'C', 'D'].map((b) => <option key={b}>{b}</option>)}</select></li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <p className="label mb-3">Schedule</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="New videos per day (in total)" htmlFor="vpd" hint="Not per account: see the summary for the resulting number of publications.">
              <input id="vpd" type="number" min={1} max={50} className={inputCls} value={cfg.videos_per_day} onChange={(e) => setCfg({ ...cfg, videos_per_day: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })} />
            </Field>
            <Field label="Time zone" htmlFor="rtz"><select id="rtz" className={inputCls} value={tz} onChange={(e) => setTz(e.target.value)}>{[...new Set([tz, ...TIMEZONES])].map((z) => <option key={z}>{z}</option>)}</select></Field>
            <Field label="Posting times (comma-separated, local)" htmlFor="times" hint="Videos of the day are spread over these times, in order.">
              <input id="times" className={inputCls} defaultValue={cfg.times.join(', ')} onBlur={(e) => setCfg({ ...cfg, times: e.target.value.split(',').map((t) => t.trim()).filter((t) => /^\d{2}:\d{2}$/.test(t)) })} placeholder="12:00, 19:00…" />
            </Field>
            <Field label="Max per account per day" htmlFor="cap" hint="Empty = no cap.">
              <input id="cap" type="number" min={1} className={inputCls} value={cfg.per_account_daily_cap ?? ''} onChange={(e) => setCfg({ ...cfg, per_account_daily_cap: e.target.value ? Number(e.target.value) : null })} />
            </Field>
          </div>
          <fieldset className="mt-3"><legend className="mb-1.5 text-xs text-zinc-400">Active days</legend>
            <div className="flex flex-wrap gap-1.5">{DAYS.map((d, i) => (
              <label key={d} className={cn('cursor-pointer rounded-lg border px-2.5 py-1 text-xs', cfg.days.includes(i) ? 'border-violet-500/50 bg-violet-500/10 text-violet-200' : 'border-line/10 text-zinc-400')}>
                <input type="checkbox" className="sr-only" checked={cfg.days.includes(i)} onChange={(e) => setCfg({ ...cfg, days: e.target.checked ? [...cfg.days, i] : cfg.days.filter((x) => x !== i) })} />{d}
              </label>))}</div>
          </fieldset>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Video order" htmlFor="order"><select id="order" className={inputCls} value={cfg.order} onChange={(e) => setCfg({ ...cfg, order: e.target.value as RotationConfig['order'] })}><option value="oldest_first">Oldest imported first</option><option value="newest_first">Newest imported first</option></select></Field>
            <Field label="When the library runs out" htmlFor="empty"><select id="empty" className={inputCls} value={cfg.empty_policy} onChange={(e) => setCfg({ ...cfg, empty_policy: e.target.value as RotationConfig['empty_policy'] })}><option value="pause">Pause the campaign and alert me</option><option value="skip_day">Skip the day and alert me</option></select></Field>
          </div>
          {allTags.length > 0 && (
            <fieldset className="mt-3"><legend className="mb-1.5 text-xs text-zinc-400">Only videos tagged (none = all)</legend>
              <div className="flex flex-wrap gap-1.5">{allTags.map((t) => (
                <label key={t} className={cn('cursor-pointer rounded-lg border px-2.5 py-1 text-xs', cfg.tags?.includes(t) ? 'border-violet-500/50 bg-violet-500/10 text-violet-200' : 'border-line/10 text-zinc-400')}>
                  <input type="checkbox" className="sr-only" checked={cfg.tags?.includes(t)} onChange={(e) => setCfg({ ...cfg, tags: e.target.checked ? [...(cfg.tags ?? []), t] : (cfg.tags ?? []).filter((x) => x !== t) })} />{t}
                </label>))}</div>
            </fieldset>
          )}
          <p className="mt-3 text-[11px] text-zinc-500">Repeat policy: a video is never sent twice to the same account, and old videos are never reposted automatically.</p>
        </Card>
        <Card>
          <p className="label mb-2">Captions</p>
          <label className="flex gap-2.5 text-sm text-zinc-200">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-violet-500" disabled={integ?.live === false || !integ?.ai} checked={cfg.auto_approve} onChange={(e) => setCfg({ ...cfg, auto_approve: e.target.checked })} />
            <span>Write captions with AI for each account and publish them without manual approval
              <span className="block text-xs text-zinc-500">Off (recommended to start): each planned post waits in the Calendar until you approve its caption. {!integ?.ai && 'AI captions are not configured on this server.'}</span></span>
          </label>
        </Card>
      </div>
      <Card className="self-start lg:sticky lg:top-24">
        <p className="label">Before you activate</p>
        <p className="mt-3 text-sm text-zinc-100">{chosen.length ? summary.text : 'Select at least one account.'}</p>
        <p className="mt-2 text-xs text-zinc-500">{eligible} eligible video{eligible > 1 ? 's' : ''} in the library → about {Number.isFinite(runway) ? runway : '∞'} active day{runway === 1 ? '' : 's'} of new content.</p>
        {hasTikTok && (
          <label className="mt-3 flex gap-2 text-xs text-zinc-300">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-violet-500" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>I agree to TikTok's Music Usage Confirmation for the videos posted on my TikTok accounts, and I own the rights to these videos.</span>
          </label>
        )}
        {err && <p role="alert" className="mt-2 text-xs text-coral-300">{err}</p>}
        <Button className="mt-4 w-full" disabled={!ready} loading={busy} onClick={activate}>Activate campaign</Button>
        <p className="mt-2 text-[11px] text-zinc-500">You can pause it at any time from the Calendar.</p>
      </Card>
    </div>
  );
}
