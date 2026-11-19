import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LoadState } from '@/components/ui';
import { cn } from '@/lib/cn';
import { adminStats, type AdminMember, type CreditHistory } from '@/services/adminStats';
import { formatCredits } from '@/services/credits';

const TYPE: Record<string, string> = {
  bonus: 'Bonus', subscription_grant: 'Abonnement', purchase: 'Achat', consumption: 'Utilisé', refund: 'Remboursé', admin_adjustment: 'Ajustement',
};
const when = (ms: number) => new Date(ms).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl bg-line/[0.04] p-3">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className={cn('mt-0.5 font-display text-xl tabular-nums', tone ?? 'text-zinc-50')}>{formatCredits(value)}</p>
    </div>
  );
}

/** The owner's view of one member's credits: what they received, really used, got back, and every movement. */
export function MemberHistory({ member, onClose }: { member: AdminMember; onClose: () => void }) {
  const [data, setData] = useState<CreditHistory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    adminStats.history(member.id).then((d) => alive && setData(d)).catch((e: Error) => alive && setError(e.message));
    return () => { alive = false; };
  }, [member.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overscroll-contain sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="mh-title">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="surface relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-b-none sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-line/5 p-5">
          <div className="min-w-0">
            <p className="label">Historique des crédits</p>
            <h2 id="mh-title" className="mt-1 break-all text-base font-semibold text-zinc-100">{member.email}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer"
            className="touch-hit grid h-9 w-9 shrink-0 place-items-center rounded-lg text-zinc-400 hover:bg-line/5 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto p-5">
          {!data ? <LoadState loading={!error} error={error} rows={4} /> : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Reçus" value={data.received} tone="text-emerald-300" />
                <Stat label="Vraiment utilisés" value={data.used} tone="text-coral-300" />
                <Stat label="Rendus (vidéos ratées)" value={data.refunded} />
                <Stat label="Solde actuel" value={data.balance} />
              </div>
              <p className="mt-2 text-[11px] text-zinc-500">« Vraiment utilisés » = débités ({formatCredits(data.taken)}) moins rendus après un échec ({formatCredits(data.refunded)}).</p>
              {data.transactions.length === 0 ? <p className="mt-6 text-center text-sm text-zinc-500">Aucun mouvement de crédits.</p> : (
                <ul className="mt-4 divide-y divide-line/5">
                  {data.transactions.map((t, i) => (
                    <li key={i} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                      <span className="min-w-0">
                        <span className="block text-zinc-200">{t.description || TYPE[t.type] || t.type}</span>
                        <span className="block text-[11px] text-zinc-500">
                          <span className={cn('mr-1.5 rounded px-1.5 py-px', t.type === 'refund' ? 'bg-sky-500/15 text-sky-300' : t.amount < 0 ? 'bg-coral-500/15 text-coral-300' : 'bg-emerald-500/15 text-emerald-300')}>{TYPE[t.type] ?? t.type}</span>
                          {when(t.at)}{t.balanceAfter !== null ? ` · solde ${formatCredits(t.balanceAfter)}` : ''}
                        </span>
                      </span>
                      <span className={cn('shrink-0 tabular-nums', t.amount < 0 ? 'text-coral-300' : 'text-emerald-300')}>{t.amount > 0 ? '+' : ''}{formatCredits(t.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
