import { CheckCircle2, CreditCard as CardIcon, X } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PlanPicker } from '@/components/billing/PlanPicker';
import { Button, Card, CardHeader, PageHeader } from '@/components/ui';
import { useCredits, useProfile } from '@/hooks/useStore';
import { billingService } from '@/services/billing';
import { PLANS } from '@/services/credits';

function CheckoutBanner() {
  const [params, setParams] = useSearchParams();
  const status = params.get('checkout');
  if (!status) return null;
  const ok = status === 'success';
  return (
    <div className={`mb-6 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-line/10 bg-line/5 text-zinc-300'}`}>
      <span className="flex items-center gap-2">{ok && <CheckCircle2 className="h-4 w-4" />}
        {ok ? 'Payment confirmed — your credits will appear in a few seconds.' : 'Checkout cancelled. No charge was made.'}</span>
      <button onClick={() => setParams({})} aria-label="Dismiss"><X className="h-4 w-4" /></button>
    </div>
  );
}

export default function BillingPage() {
  const { balance, transactions } = useCredits();
  const { data: profile } = useProfile();
  const plan = PLANS.find((p) => p.id === profile?.plan);
  const [portalError, setPortalError] = useState<string | null>(null);
  const spent = transactions.filter((t) => t.amount < 0).reduce((n, t) => n - t.amount, 0);

  return (
    <>
      <PageHeader eyebrow="Account" title="Plan & credits" />
      <CheckoutBanner />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="label">Balance</p>
          <p className="mt-2 font-display text-4xl tabular-nums text-zinc-50">{balance}</p>
          <p className="text-xs text-zinc-500">Used only by the AI studio (beta)</p>
        </Card>
        <Card>
          <p className="label">Current plan</p>
          <p className="mt-2 font-display text-4xl text-zinc-50">{plan?.name ?? '—'}</p>
          <p className="text-xs text-zinc-500">{plan ? `${plan.credits} credits ${plan.period === 'month' ? '/ month' : 'on signup'}` : ''}</p>
        </Card>
        <Card className="flex flex-col">
          <p className="label">Credits used</p>
          <p className="mt-2 font-display text-4xl tabular-nums text-zinc-50">{spent}</p>
          {profile?.plan && profile.plan !== 'free' && (
            <Button size="sm" variant="secondary" className="mt-auto" onClick={() => billingService.openPortal().catch((e: Error) => setPortalError(e.message))}>
              <CardIcon className="h-3.5 w-3.5" /> Manage billing & invoices
            </Button>
          )}
          {portalError && <p className="mt-2 text-xs text-coral-300">{portalError}</p>}
        </Card>
      </div>
      <Card className="mt-6">
        {profile?.plan === 'studio'
          ? <CardHeader title="Top up credits" subtitle="You're on Studio, our top plan. Top-up packs never expire." />
          : <CardHeader title="Upgrade or top up" subtitle="Plans renew monthly. Top-up packs never expire." />}
        <PlanPicker currentPlan={profile?.plan} trialUsed={profile?.trial_used} />
      </Card>
      <Card className="mt-6 overflow-x-auto" tabIndex={0} role="region" aria-label="Credit history">
        <CardHeader title="Credit history" />
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="label"><tr><th className="pb-3 font-medium">Date</th><th className="pb-3 font-medium">Description</th><th className="pb-3 text-right font-medium">Amount</th><th className="pb-3 text-right font-medium">Balance</th></tr></thead>
          <tbody className="divide-y divide-line/5">
            {transactions.map((t) => (
              <tr key={t.id}>
                <td className="py-2.5 text-xs text-zinc-500">{new Date(t.created_at).toLocaleDateString()}</td>
                <td className="py-2.5 text-zinc-300">{t.description}</td>
                <td className={`py-2.5 text-right tabular-nums ${t.amount < 0 ? 'text-coral-300' : 'text-emerald-300'}`}>{t.amount > 0 ? '+' : ''}{t.amount}</td>
                <td className="py-2.5 text-right tabular-nums text-zinc-400">{t.balance_after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
