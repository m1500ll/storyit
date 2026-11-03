import { CheckCircle2, CreditCard as CardIcon, X } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PlanPicker } from '@/components/billing/PlanPicker';
import { Button, Card, CardHeader, PageHeader } from '@/components/ui';
import { useCredits, useProfile } from '@/hooks/useStore';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { billingService } from '@/services/billing';
import { PLANS } from '@/services/credits';
import { store } from '@/services/store';

function CheckoutBanner() {
  const [params, setParams] = useSearchParams();
  const status = params.get('checkout');
  if (!status) return null;
  const ok = status === 'success';
  return (
    <div className={`mb-6 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-white/10 bg-white/5 text-zinc-300'}`}>
      <span className="flex items-center gap-2">{ok && <CheckCircle2 className="h-4 w-4" />}
        {ok ? 'Payment confirmed — your credits will appear in a few seconds.' : 'Checkout cancelled. No charge was made.'}</span>
      <button onClick={() => setParams({})} aria-label="Dismiss"><X className="h-4 w-4" /></button>
    </div>
  );
}

function ProfileCard() {
  const { data: profile } = useProfile();
  const [name, setName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const value = name ?? profile?.display_name ?? '';

  const save = async () => {
    if (!supabase || !profile) return;
    setSaving(true);
    await supabase.from('profiles').update({ display_name: value.trim() || null }).eq('id', profile.id);
    setSaving(false);
    setName(null);
    store.notify();
  };

  return (
    <Card>
      <CardHeader title="Profile" />
      <label className="label" htmlFor="name">Display name</label>
      <div className="mt-2 flex gap-2">
        <input id="name" className="input" value={value} onChange={(e) => setName(e.target.value)} maxLength={60} />
        {isSupabaseConfigured && <Button variant="secondary" onClick={save} loading={saving} disabled={name === null}>Save</Button>}
      </div>
      <p className="mt-4 text-xs text-zinc-500">Backend: {isSupabaseConfigured ? <span className="text-emerald-300">Supabase connected</span> : <span className="text-amber-300">Demo mode</span>}</p>
    </Card>
  );
}

export default function SettingsPage() {
  const { balance, transactions } = useCredits();
  const { data: profile } = useProfile();
  const plan = PLANS.find((p) => p.id === profile?.plan);
  const [portalError, setPortalError] = useState<string | null>(null);

  return (
    <>
      <PageHeader eyebrow="Account" title="Settings" />
      <CheckoutBanner />
      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileCard />
        <Card>
          <CardHeader title="Plan & credits" subtitle={`${plan?.name ?? '—'} · ${plan?.credits ?? 0} credits / month`}
            action={profile?.plan !== 'free' && (
              <Button size="sm" variant="secondary" onClick={() => billingService.openPortal().catch((e: Error) => setPortalError(e.message))}>
                <CardIcon className="h-3.5 w-3.5" /> Manage billing
              </Button>
            )} />
          <p className="font-display text-4xl tabular-nums text-zinc-50">{balance}</p>
          <p className="text-xs text-zinc-500">available Story Credits</p>
          {portalError && <p className="mt-2 text-xs text-coral-300">{portalError}</p>}
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Upgrade" subtitle="Plans renew monthly. Top-up packs never expire." />
          <PlanPicker currentPlan={profile?.plan} />
        </Card>
        <Card className="overflow-x-auto lg:col-span-2">
          <CardHeader title="Credit history" />
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="label"><tr><th className="pb-3 font-medium">Date</th><th className="pb-3 font-medium">Description</th><th className="pb-3 text-right font-medium">Amount</th><th className="pb-3 text-right font-medium">Balance</th></tr></thead>
            <tbody className="divide-y divide-white/5">
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
      </div>
    </>
  );
}
