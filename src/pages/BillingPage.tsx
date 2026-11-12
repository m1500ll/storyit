import { CheckCircle2, CreditCard as CardIcon, X } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PlanPicker } from '@/components/billing/PlanPicker';
import { Button, Card, CardHeader, PageHeader } from '@/components/ui';
import { useCredits, useProfile } from '@/hooks/useStore';
import { billingService } from '@/services/billing';
import { PLANS, formatCredits } from '@/services/credits';
import { TrialUpgrade } from '@/components/billing/TrialUpgrade';
import { cn } from '@/lib/cn';

function CheckoutBanner() {
  const [params, setParams] = useSearchParams();
  const status = params.get('checkout');
  if (!status) return null;
  const ok = status === 'success';
  return (
    <div className={`mb-6 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-line/10 bg-line/5 text-zinc-300'}`}>
      <span className="flex items-center gap-2">{ok && <CheckCircle2 className="h-4 w-4" />}
        {ok ? 'Paiement confirmé : vos crédits arrivent dans quelques secondes.' : 'Paiement annulé. Aucun montant n’a été débité.'}</span>
      <button onClick={() => setParams({})} aria-label="Fermer"><X className="h-4 w-4" /></button>
    </div>
  );
}

export default function BillingPage() {
  const [params] = useSearchParams();
  const { balance, known, transactions } = useCredits();
  const { data: profile } = useProfile();
  const plan = PLANS.find((p) => p.id === profile?.plan);
  const [portalError, setPortalError] = useState<string | null>(null);
  const spent = transactions.filter((t) => t.amount < 0).reduce((n, t) => n - t.amount, 0);

  return (
    <>
      <PageHeader eyebrow="Compte" title="Offre et crédits" />
      <CheckoutBanner />
      {/* free accounts: the offers come first (on a phone the three stat cards pushed them below the fold) */}
      <div className={cn('flex flex-col', (profile?.plan ?? 'free') === 'free' && 'flex-col-reverse justify-end [&>*:last-child]:mt-0 [&>*:first-child]:mt-6')}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="label">Solde</p>
          <p className="mt-2 font-display text-4xl tabular-nums text-zinc-50">{known ? formatCredits(balance) : '…'}</p>
          <p className="text-xs text-zinc-500">Utilisés par les studios IA</p>
        </Card>
        <Card>
          <p className="label">Offre actuelle</p>
          <p className="mt-2 font-display text-4xl text-zinc-50">{plan?.name ?? '—'}</p>
          <p className="text-xs text-zinc-500">{plan ? `${formatCredits(plan.credits)} crédits ${plan.period === 'month' ? '/ mois' : 'à l’inscription'}` : ''}</p>
        </Card>
        <Card className="flex flex-col">
          <p className="label">Crédits utilisés</p>
          <p className="mt-2 font-display text-4xl tabular-nums text-zinc-50">{formatCredits(spent)}</p>
          {profile?.plan && profile.plan !== 'free' && (
            <Button size="sm" variant="secondary" className="mt-auto" onClick={() => billingService.openPortal().catch((e: Error) => setPortalError(e.message))}>
              <CardIcon className="h-3.5 w-3.5" /> Gérer la facturation et les factures
            </Button>
          )}
          {portalError && <p className="mt-2 text-xs text-coral-300">{portalError}</p>}
        </Card>
      </div>
      <Card className="mt-6">
        {profile?.plan === 'studio'
          ? <CardHeader title="Recharger des crédits" subtitle="Vous avez Studio, notre offre la plus complète. Les packs de crédits n’expirent jamais." />
          : <CardHeader title="Changer d’offre ou recharger" subtitle="Les offres se renouvellent chaque mois. Les packs de crédits n’expirent jamais." />}
        <TrialUpgrade />
        <PlanPicker currentPlan={profile?.plan} trialUsed={profile?.trial_used} initialInterval={params.get('interval') === 'month' ? 'month' : 'year'} />
      </Card>
      </div>
      <Card className="mt-6 overflow-x-auto" tabIndex={0} role="region" aria-label="Historique des crédits">
        <CardHeader title="Historique des crédits" />
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="label"><tr><th className="pb-3 font-medium">Date</th><th className="pb-3 font-medium">Description</th><th className="pb-3 text-right font-medium">Montant</th><th className="pb-3 text-right font-medium">Solde</th></tr></thead>
          <tbody className="divide-y divide-line/5">
            {transactions.map((t) => (
              <tr key={t.id}>
                <td className="py-2.5 text-xs text-zinc-500">{new Date(t.created_at).toLocaleDateString()}</td>
                <td className="py-2.5 text-zinc-300">{t.description}</td>
                <td className={`py-2.5 text-right tabular-nums ${t.amount < 0 ? 'text-coral-300' : 'text-emerald-300'}`}>{t.amount > 0 ? '+' : ''}{formatCredits(t.amount)}</td>
                <td className="py-2.5 text-right tabular-nums text-zinc-400">{formatCredits(t.balance_after)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
