import { Button, Card, CardHeader, PageHeader } from '@/components/ui';
import { useCredits, useProfile } from '@/hooks/useStore';
import { isSupabaseConfigured } from '@/lib/supabase';
import { PLANS } from '@/services/credits';

export default function SettingsPage() {
  const { balance, transactions } = useCredits();
  const { data: profile } = useProfile();
  const plan = PLANS.find((p) => p.id === profile?.plan);

  return (
    <>
      <PageHeader eyebrow="Account" title="Settings" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Profile" />
          <label className="label" htmlFor="name">Display name</label>
          <input id="name" className="input mt-2" key={profile?.id} defaultValue={profile?.display_name ?? ''} />
          <p className="mt-4 text-xs text-zinc-500">Backend: {isSupabaseConfigured ? <span className="text-emerald-300">Supabase connected</span> : <span className="text-amber-300">Mock mode (set VITE_SUPABASE_URL)</span>}</p>
        </Card>
        <Card>
          <CardHeader title="Plan & credits" subtitle={`${plan?.name} · ${plan?.credits} credits / month`} action={<Button size="sm" variant="secondary">Buy credits</Button>} />
          <p className="font-display text-4xl text-zinc-50 tabular-nums">{balance}</p>
          <p className="text-xs text-zinc-500">available Story Credits</p>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Credit history" />
          <table className="w-full text-left text-sm">
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
