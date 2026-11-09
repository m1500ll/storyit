import { Check, Copy, MousePointerClick, RefreshCw, UserPlus, Users, Wallet } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { Logo } from '@/components/ui';
import { useSeo } from '@/lib/seo';
import { affiliate, type PartnerStats } from '@/services/affiliate';

const PLAN_NAMES: Record<string, string> = { creator: 'Creator', pro: 'Pro', studio: 'Studio' };
export const money = (cents: number) => `${(cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
const day = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });

export function Kpi({ icon, label, value, hint, tone }: { icon: ReactNode; label: string; value: string | number; hint?: string; tone?: 'green' }) {
  return (
    <div className={'surface rounded-2xl p-4 ' + (tone === 'green' ? 'border-emerald-500/40 bg-emerald-500/[0.06]' : '')}>
      <p className="flex items-center gap-1.5 text-xs text-zinc-400">{icon}{label}</p>
      <p className="mt-1.5 font-display text-3xl tabular-nums text-zinc-50">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-zinc-500">{hint}</p>}
    </div>
  );
}

export function ClicksChart({ byDay }: { byDay: Record<string, number> }) {
  const days = Object.entries(byDay);
  const max = Math.max(1, ...days.map(([, v]) => v));
  return (
    <div className="flex h-40 items-end gap-[3px]" role="img" aria-label="Clics par jour sur 30 jours">
      {days.map(([d, v]) => (
        <div key={d} className="group relative flex h-full flex-1 flex-col justify-end">
          <div className="rounded-t bg-violet-500/80 transition-colors group-hover:bg-violet-400" style={{ height: `${Math.max(v ? 4 : 1, (100 * v) / max)}%` }} />
          <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink-950 px-1.5 py-0.5 text-[10px] text-zinc-100 group-hover:block">{day(d)} · {v}</span>
        </div>
      ))}
    </div>
  );
}

export function PartnerDashboard({ s }: { s: PartnerStats }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(s.link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* manual copy */ } };
  const plans = Object.entries(s.byPlan);
  return (
    <>
      <div className="surface rounded-2xl p-4">
        <label htmlFor="partner-link" className="text-sm font-medium text-zinc-100">Votre lien de promotion</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input id="partner-link" readOnly value={s.link} onFocus={(e) => e.currentTarget.select()}
            className="h-11 min-w-0 flex-1 rounded-xl border border-line/10 bg-transparent px-3 font-mono text-base text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 sm:text-sm" />
          <button type="button" onClick={() => void copy()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copié' : 'Copier'}
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          Vous touchez <strong className="text-zinc-200">{Math.round(s.rate * 100)} % du premier paiement</strong> de chaque personne qui prend un abonnement dans les 7 jours après avoir cliqué sur votre lien.
          {!s.active && <span className="ml-1 text-amber-300">Ce lien est actuellement désactivé.</span>}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<MousePointerClick className="h-3.5 w-3.5" aria-hidden />} label="Clics" value={s.clicks} hint={`${s.clicks7} ces 7 derniers jours`} />
        <Kpi icon={<UserPlus className="h-3.5 w-3.5" aria-hidden />} label="Inscrits" value={s.signups} hint={`${s.visitors30} visiteurs uniques sur 30 jours`} />
        <Kpi icon={<Users className="h-3.5 w-3.5" aria-hidden />} label="Abonnés" value={s.customers}
          hint={plans.length ? plans.map(([p, n]) => `${n} ${PLAN_NAMES[p] ?? p}`).join(' · ') : 'aucun pour l’instant'} />
        <Kpi icon={<Wallet className="h-3.5 w-3.5" aria-hidden />} label="Commission totale" value={money(s.earnedCents)} tone="green"
          hint={`Déjà versé ${money(s.paidOutCents)} · reste ${money(s.dueCents)}`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="surface rounded-2xl p-4">
          <h2 className="mb-3 text-sm font-semibold text-zinc-100">Clics par jour (30 derniers jours)</h2>
          <ClicksChart byDay={s.clicksByDay} />
          <div className="mt-1 flex justify-between text-[10px] text-zinc-500"><span>il y a 30 jours</span><span>aujourd’hui</span></div>
        </div>
        <div className="surface rounded-2xl p-4">
          <h2 className="mb-3 text-sm font-semibold text-zinc-100">Taux de conversion</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-zinc-400">Clic → inscription</dt><dd className="tabular-nums text-zinc-100">{s.clicks ? Math.round((100 * s.signups) / s.clicks) : 0} %</dd></div>
            <div className="flex justify-between"><dt className="text-zinc-400">Inscription → abonnement</dt><dd className="tabular-nums text-zinc-100">{s.signups ? Math.round((100 * s.customers) / s.signups) : 0} %</dd></div>
            <div className="flex justify-between"><dt className="text-zinc-400">Ventes générées</dt><dd className="tabular-nums text-zinc-100">{money(s.salesCents)}</dd></div>
          </dl>
        </div>
      </div>

      <h2 className="mb-3 mt-6 text-sm font-semibold text-zinc-100">Vos inscrits</h2>
      {s.conversions.length === 0 ? (
        <p className="surface rounded-2xl px-4 py-4 text-sm text-zinc-400">Personne pour l’instant. Partagez votre lien : chaque inscription apparaîtra ici.</p>
      ) : (
        <div className="surface overflow-x-auto rounded-2xl" tabIndex={0} role="region" aria-label="Vos inscrits">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="label"><tr><th className="px-4 py-3 font-medium">Inscrit le</th><th className="px-4 py-3 font-medium">Statut</th><th className="px-4 py-3 font-medium">Offre</th><th className="px-4 py-3 text-right font-medium">Paiement</th><th className="px-4 py-3 text-right font-medium">Votre commission</th></tr></thead>
            <tbody className="divide-y divide-line/5">
              {s.conversions.map((c, i) => (
                <tr key={i}>
                  <td className="px-4 py-2.5 text-zinc-300">{day(c.date)}</td>
                  <td className="px-4 py-2.5">{c.status === 'paid'
                    ? <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300">Abonné</span>
                    : <span className="rounded-full bg-line/[0.08] px-2 py-0.5 text-[11px] text-zinc-400">Inscrit</span>}</td>
                  <td className="px-4 py-2.5 text-zinc-300">{c.product ? PLAN_NAMES[c.product] ?? c.product : '—'}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-zinc-300">{c.amountCents ? money(c.amountCents) : '—'}</td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums text-emerald-300">{c.commissionCents ? money(c.commissionCents) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 text-[11px] text-zinc-500">Pour protéger leur vie privée, l’identité des personnes inscrites n’est jamais affichée. Les chiffres se mettent à jour automatiquement.</p>
    </>
  );
}

export default function PartnerPage() {
  const { secret = '' } = useParams();
  useSeo({ path: '/partner', title: 'Espace partenaire', noindex: true });
  const [s, setS] = useState<PartnerStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { setS(await affiliate.stats(secret)); setError(null); } catch (e) { setError(e instanceof Error ? e.message : 'Chargement impossible.'); }
    finally { setLoading(false); }
  }, [secret]);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 60_000); return () => clearInterval(t); }, [load]);

  return (
    <div className="min-h-screen bg-ink-950">
      <header className="border-b border-line/[0.06]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 md:px-6">
          <Logo to="/" />
          <button type="button" onClick={() => void load()} aria-label="Actualiser"
            className="touch-hit inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-zinc-400 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
            <RefreshCw className={'h-3.5 w-3.5 ' + (loading ? 'animate-spin motion-reduce:animate-none' : '')} aria-hidden /> Actualiser
          </button>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        <p className="label">Espace partenaire</p>
        <h1 className="mt-2 font-display text-4xl text-zinc-50">{s ? `Bonjour ${s.name}` : 'Vos statistiques'}</h1>
        <div className="mt-6">
          {error ? <p role="alert" className="surface rounded-2xl px-4 py-4 text-sm text-coral-300">{error}</p>
            : !s ? <p className="text-sm text-zinc-400">Chargement…</p>
            : <PartnerDashboard s={s} />}
        </div>
      </main>
    </div>
  );
}
