import { Activity, BadgeDollarSign, CreditCard, RefreshCw, Search, Sparkles, UserPlus, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, Card, LoadState, PageHeader } from '@/components/ui';
import { useProfile } from '@/hooks/useStore';
import { cn } from '@/lib/cn';
import { adminStats, type AdminMember, type AdminStats, type MemberStatus } from '@/services/adminStats';
import { formatCredits } from '@/services/credits';

const REFRESH_MS = 30_000;
const usd = (cents: number) => `${(cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })} $`;
const day = (v: string | number | null) => (v ? new Date(v).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—');
const ago = (v: string | number | null) => {
  if (!v) return '—';
  const m = Math.round((Date.now() - new Date(v).getTime()) / 60_000);
  if (m < 1) return 'à l’instant';
  if (m < 60) return `il y a ${m} min`;
  if (m < 1440) return `il y a ${Math.round(m / 60)} h`;
  return `il y a ${Math.round(m / 1440)} j`;
};
const PLAN: Record<string, string> = { free: 'Gratuit', creator: 'Creator', pro: 'Pro', studio: 'Studio' };
const STATUS: Record<MemberStatus, { label: string; cls: string }> = {
  paying: { label: 'Abonné', cls: 'bg-emerald-500/15 text-emerald-300' },
  trial: { label: 'Essai 1 $', cls: 'bg-amber-500/15 text-amber-300' },
  past_due: { label: 'Paiement en échec', cls: 'bg-coral-500/15 text-coral-300' },
  churned: { label: 'A résilié', cls: 'bg-line/[0.08] text-zinc-300' },
  free: { label: 'Gratuit', cls: 'bg-line/[0.06] text-zinc-500' },
};
const FILTERS: { key: 'all' | MemberStatus; label: string }[] = [
  { key: 'all', label: 'Tous' }, { key: 'paying', label: 'Abonnés' }, { key: 'trial', label: 'En essai' }, { key: 'churned', label: 'Ont résilié' }, { key: 'free', label: 'Gratuits' },
];

function Kpi({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint?: string }) {
  return (
    <Card className="min-w-0">
      <p className="flex items-center gap-1.5 text-xs text-zinc-500">{icon}{label}</p>
      <p className="mt-2 font-display text-3xl tabular-nums text-zinc-50">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-zinc-500">{hint}</p>}
    </Card>
  );
}

function StatusBadge({ m }: { m: AdminMember }) {
  const s = STATUS[m.status];
  return <span className={cn('whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium', s.cls)}>{s.label}{m.status === 'paying' && m.cancelAtPeriodEnd ? ' · résiliation prévue' : ''}</span>;
}

function payLine(m: AdminMember) {
  if (m.status === 'trial') return m.trialEndsAt ? `Essai jusqu’au ${day(m.trialEndsAt)}` : 'Essai en cours';
  if (m.status === 'paying') return `${PLAN[m.plan] ?? m.plan}${m.interval === 'year' ? ' annuel' : ' mensuel'} · renouvellement ${day(m.renewsAt)}`;
  return m.paidCents ? `Dernier paiement ${day(m.lastPaymentAt)}` : 'N’a jamais payé';
}

/** Owner-only dashboard: members, who paid, trials, credits and revenue, refreshed every 30 s. */
export default function AdminDashboardPage() {
  const { data: profile, loading: profileLoading } = useProfile();
  const isAdmin = !!(profile as { is_admin?: boolean } | null)?.is_admin;
  const [data, setData] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'all' | MemberStatus>('all');
  const [q, setQ] = useState('');
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    setBusy(true);
    try { setData(await adminStats.load()); setError(null); } catch (e) { setError(e instanceof Error ? e.message : 'Chargement impossible.'); } finally { setBusy(false); }
  }, []);
  useEffect(() => {
    if (!isAdmin) return;
    void load();
    const id = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, REFRESH_MS);
    const clock = setInterval(() => tick((n) => n + 1), 10_000);
    return () => { clearInterval(id); clearInterval(clock); };
  }, [isAdmin, load]);

  const members = useMemo(() => (data?.members ?? []).filter((m) => !m.isAdmin)
    .filter((m) => filter === 'all' || m.status === filter)
    .filter((m) => !q.trim() || m.email.toLowerCase().includes(q.trim().toLowerCase())), [data, filter, q]);

  if (profileLoading && !profile) return <LoadState loading error={null} />;
  if (!isAdmin) return <LoadState loading={false} error="Cette page est réservée à l’administrateur." />;

  const k = data?.kpis;
  const count = (key: 'all' | MemberStatus) => !k ? 0 : key === 'all' ? k.members : key === 'paying' ? k.paying : key === 'trial' ? k.trials : key === 'churned' ? k.churned : k.free;

  return (
    <>
      <PageHeader eyebrow="Admin" title="Tableau de bord" description="Membres, paiements, essais et crédits. Mis à jour automatiquement toutes les 30 secondes."
        actions={<Button variant="secondary" onClick={() => void load()} loading={busy} aria-label="Actualiser maintenant"><RefreshCw className="h-4 w-4" aria-hidden /> {data ? `Actualisé ${ago(data.generatedAt)}` : 'Actualiser'}</Button>} />
      {error && <div className="mb-6"><LoadState loading={false} error={error} /></div>}
      {!data && !error && <LoadState loading error={null} rows={6} />}
      {data && k && (
        <>
          {!data.stripeConnected && <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">Stripe n’est pas connecté : les paiements ne peuvent pas être lus.</p>}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi icon={<BadgeDollarSign className="h-3.5 w-3.5" aria-hidden />} label="Revenu mensuel (MRR)" value={usd(k.mrrCents)} hint={`${k.paying} abonné${k.paying > 1 ? 's' : ''} actif${k.paying > 1 ? 's' : ''}`} />
            <Kpi icon={<CreditCard className="h-3.5 w-3.5" aria-hidden />} label="Encaissé au total" value={usd(k.revenueCents)} hint={`${usd(k.revenue30Cents)} sur 30 jours`} />
            <Kpi icon={<Users className="h-3.5 w-3.5" aria-hidden />} label="Membres" value={String(k.members)} hint={`${k.paying} payants · ${k.trials} en essai · ${k.free} gratuits`} />
            <Kpi icon={<UserPlus className="h-3.5 w-3.5" aria-hidden />} label="Inscrits aujourd’hui" value={String(k.signupsToday)} hint={`${k.signups7d} sur 7 jours · ${k.signups30d} sur 30 jours`} />
            <Kpi icon={<Sparkles className="h-3.5 w-3.5" aria-hidden />} label="Ont fini une vidéo" value={`${k.activated}`} hint={`${k.members ? Math.round((k.activated / k.members) * 100) : 0} % des membres`} />
            <Kpi icon={<BadgeDollarSign className="h-3.5 w-3.5" aria-hidden />} label="Taux de conversion" value={`${k.members ? Math.round(((k.paying + k.churned) / k.members) * 100) : 0} %`} hint="membres qui ont déjà payé" />
            <Kpi icon={<Users className="h-3.5 w-3.5" aria-hidden />} label="Venus d’un partenaire" value={String(k.viaPartner)} hint={`${k.members ? Math.round((k.viaPartner / k.members) * 100) : 0} % des membres`} />
            <Kpi icon={<Activity className="h-3.5 w-3.5" aria-hidden />} label="Crédits en circulation" value={formatCredits(k.creditsOutstanding)} hint="soldes des membres" />
          </div>

          <Card className="mt-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div role="tablist" aria-label="Filtrer les membres" className="flex flex-wrap gap-1.5">
                {FILTERS.map((f) => (
                  <button key={f.key} role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
                    className={cn('touch-hit rounded-full px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
                      filter === f.key ? 'bg-violet-600 text-white' : 'bg-line/[0.05] text-zinc-400 hover:text-zinc-100')}>
                    {f.label} <span className="tabular-nums opacity-70">{count(f.key)}</span>
                  </button>
                ))}
              </div>
              <label className="relative block md:w-72">
                <span className="sr-only">Rechercher un e-mail</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden />
                <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un e-mail…" spellCheck={false} autoComplete="off" name="admin-search"
                  className="h-10 w-full rounded-lg border border-line/10 bg-transparent pl-9 pr-3 text-base text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 md:text-sm" />
              </label>
            </div>

            {members.length === 0 ? <p className="py-8 text-center text-sm text-zinc-500">Aucun membre dans cette catégorie.</p> : (
              <>
                {/* phones: one card per member */}
                <ul className="mt-4 divide-y divide-line/5 md:hidden">
                  {members.map((m) => (
                    <li key={m.id} className="py-3">
                      <div className="flex items-start justify-between gap-2"><p className="min-w-0 break-all text-sm font-medium text-zinc-100">{m.email}</p><StatusBadge m={m} /></div>
                      <p className="mt-1 text-xs text-zinc-500">{payLine(m)}</p>
                      <p className="mt-1.5 grid grid-cols-3 gap-2 text-xs text-zinc-400">
                        <span><span className="block text-[10px] text-zinc-500">Payé</span><span className="tabular-nums text-zinc-200">{m.paidCents ? usd(m.paidCents) : '—'}</span></span>
                        <span><span className="block text-[10px] text-zinc-500">Crédits</span><span className="tabular-nums text-zinc-200">{formatCredits(m.credits)}</span></span>
                        <span><span className="block text-[10px] text-zinc-500">Vidéos</span><span className="tabular-nums text-zinc-200">{m.videos}</span></span>
                      </p>
                      <p className="mt-1.5 text-[11px] text-zinc-500">Inscrit le {day(m.signedUpAt)} · actif {ago(m.lastActivityAt)}{m.partner ? ` · partenaire ${m.partner}` : ''}</p>
                    </li>
                  ))}
                </ul>
                {/* larger screens: table */}
                <div className="mt-4 hidden overflow-x-auto md:block" tabIndex={0} role="region" aria-label="Membres">
                  <table className="w-full min-w-[880px] text-left text-sm">
                    <thead className="label"><tr>
                      <th className="pb-3 pr-3 font-medium">Membre</th><th className="pb-3 pr-3 font-medium">Statut</th><th className="pb-3 pr-3 text-right font-medium">Payé</th>
                      <th className="pb-3 pr-3 text-right font-medium">Crédits</th><th className="pb-3 pr-3 text-right font-medium">Dépensés</th><th className="pb-3 pr-3 text-right font-medium">Vidéos</th>
                      <th className="pb-3 pr-3 font-medium">Inscrit</th><th className="pb-3 font-medium">Dernière activité</th>
                    </tr></thead>
                    <tbody className="divide-y divide-line/5">
                      {members.map((m) => (
                        <tr key={m.id} className="align-top">
                          <td className="max-w-[260px] py-2.5 pr-3"><p className="truncate text-zinc-100" title={m.email}>{m.email}</p><p className="text-[11px] text-zinc-500">{payLine(m)}{m.partner ? ` · via ${m.partner}` : ''}</p></td>
                          <td className="py-2.5 pr-3"><StatusBadge m={m} /></td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-200">{m.paidCents ? usd(m.paidCents) : '—'}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-200">{formatCredits(m.credits)}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-400">{formatCredits(m.spent)}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-400">{m.videos}</td>
                          <td className="py-2.5 pr-3 text-zinc-400">{day(m.signedUpAt)}</td>
                          <td className="py-2.5 text-zinc-400">{ago(m.lastActivityAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="text-sm font-semibold text-zinc-100">Derniers paiements</h2>
              {data.payments.length === 0 ? <p className="mt-3 text-sm text-zinc-500">Aucun paiement pour l’instant.</p> : (
                <ul className="mt-3 divide-y divide-line/5">
                  {data.payments.map((p, i) => (
                    <li key={i} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                      <span className="min-w-0"><span className="block truncate text-zinc-200">{p.email ?? 'Client inconnu'}</span><span className="block truncate text-[11px] text-zinc-500">{p.label} · {ago(p.at)}</span></span>
                      <span className="shrink-0 font-semibold tabular-nums text-emerald-300">+{usd(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <h2 className="text-sm font-semibold text-zinc-100">Activité des crédits</h2>
              <ul className="mt-3 divide-y divide-line/5">
                {data.activity.map((a, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0"><span className="block truncate text-zinc-200">{a.email || '—'}</span><span className="block truncate text-[11px] text-zinc-500">{a.description} · {ago(a.at)}</span></span>
                    <span className={cn('shrink-0 tabular-nums', a.amount < 0 ? 'text-coral-300' : 'text-emerald-300')}>{a.amount > 0 ? '+' : ''}{formatCredits(a.amount)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
