import { Ban, Gift, Minus, Plus, ShieldCheck, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
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

const field = 'h-10 rounded-lg border border-line/10 bg-transparent px-3 text-base text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 md:text-sm';
const btn = 'touch-hit inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 disabled:opacity-50';
const PLAN_CREDITS: Record<string, number> = { starter: 12000, creator: 50000, pro: 90000, studio: 175000 };

/** The owner's actions on a member: add or remove credits, offer a plan for some days, ban or unban. */
function Actions({ member, data, onDone }: { member: AdminMember; data: CreditHistory; onDone: (msg: string) => void }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [plan, setPlan] = useState<'starter' | 'creator' | 'pro' | 'studio' | 'free'>('creator');
  const [days, setDays] = useState('30');
  const [withCredits, setWithCredits] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const run = async (key: string, f: () => Promise<unknown>, msg: string) => {
    setBusy(key); setErr(null);
    try { await f(); setAmount(''); onDone(msg); } catch (e) { setErr(e instanceof Error ? e.message : 'Action impossible.'); } finally { setBusy(null); }
  };
  const n = Math.trunc(Number(amount));
  const banned = !!data.bannedAt;
  return (
    <section className="mt-5 rounded-xl border border-line/10 p-4" aria-label="Actions sur ce compte">
      <p className="label">Actions</p>
      <label className="mt-3 block text-xs text-zinc-400" htmlFor="adm-reason">Raison (gardée dans l’historique)</label>
      <input id="adm-reason" className={cn(field, 'mt-1 w-full')} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. : geste commercial, fraude, bug…" maxLength={200} />

      <p className="mt-4 text-sm font-semibold text-zinc-200">Crédits</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input className={cn(field, 'w-36')} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Ex. 5000" aria-label="Nombre de crédits" />
        <button type="button" className={cn(btn, 'bg-emerald-600 text-white hover:bg-emerald-500')} disabled={!n || !!busy}
          onClick={() => void run('add', () => adminStats.adjustCredits(member.id, n, reason), `${formatCredits(n)} crédits ajoutés.`)}><Plus className="h-4 w-4" aria-hidden /> Ajouter</button>
        <button type="button" className={cn(btn, 'bg-coral-500 text-white hover:brightness-110')} disabled={!n || !!busy}
          onClick={() => void run('remove', () => adminStats.adjustCredits(member.id, -n, reason), `${formatCredits(Math.min(n, data.balance))} crédits retirés.`)}><Minus className="h-4 w-4" aria-hidden /> Retirer</button>
      </div>

      <p className="mt-4 text-sm font-semibold text-zinc-200">Offre</p>
      <p className="text-[11px] text-zinc-500">Offre actuelle : {data.plan}{data.planUntil ? ` jusqu’au ${new Date(data.planUntil).toLocaleDateString('fr-FR')}` : ''}. Une offre donnée ici s’arrête seule à la fin de la durée.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select className={cn(field, 'w-32')} value={plan} onChange={(e) => setPlan(e.target.value as typeof plan)} aria-label="Offre">
          <option value="starter">Starter</option><option value="creator">Creator</option><option value="pro">Pro</option><option value="studio">Studio</option><option value="free">Gratuit (retirer l’offre)</option>
        </select>
        {plan !== 'free' && <>
          <input className={cn(field, 'w-20')} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/[^0-9]/g, ''))} aria-label="Durée en jours" />
          <span className="text-xs text-zinc-400">jours</span>
          <label className="flex items-center gap-1.5 text-xs text-zinc-300"><input type="checkbox" checked={withCredits} onChange={(e) => setWithCredits(e.target.checked)} /> + {formatCredits(PLAN_CREDITS[plan] ?? 0)} crédits</label>
        </>}
        <button type="button" className={cn(btn, 'bg-violet-600 text-white hover:bg-violet-500')} disabled={!!busy || (plan !== 'free' && !(Number(days) >= 1))}
          onClick={() => void run('plan', () => adminStats.setPlan(member.id, plan, Number(days), plan !== 'free' && withCredits ? (PLAN_CREDITS[plan] ?? 0) : 0, reason), plan === 'free' ? 'Offre retirée.' : `Offre ${plan} activée pour ${days} jours.`)}>
          <Gift className="h-4 w-4" aria-hidden /> {plan === 'free' ? 'Retirer' : 'Activer'}
        </button>
      </div>

      <p className="mt-4 text-sm font-semibold text-zinc-200">Bannissement</p>
      {banned
        ? <p className="text-[11px] text-coral-300">Banni le {new Date(data.bannedAt!).toLocaleDateString('fr-FR')}{data.banReason ? ` : ${data.banReason}` : ''}.</p>
        : <p className="text-[11px] text-zinc-500">Bannir : il ne peut plus se connecter, ses crédits et son offre sont retirés, son abonnement Whop est résilié.</p>}
      <div className="mt-2">
        {banned
          ? <button type="button" className={cn(btn, 'bg-line/10 text-zinc-100 hover:bg-line/20')} disabled={!!busy}
              onClick={() => void run('unban', () => adminStats.setBan(member.id, false, reason), 'Compte débanni (ses crédits ne reviennent pas).')}><ShieldCheck className="h-4 w-4" aria-hidden /> Débannir</button>
          : <button type="button" className={cn(btn, 'border border-coral-500/50 text-coral-300 hover:bg-coral-500/10')} disabled={!!busy}
              onClick={() => { if (window.confirm(`Bannir ${member.email} ? Il ne pourra plus se connecter et perdra ses crédits.`)) void run('ban', () => adminStats.setBan(member.id, true, reason), 'Compte banni.'); }}>
              <Ban className="h-4 w-4" aria-hidden /> Bannir ce compte</button>}
      </div>
      {err && <p className="mt-3 text-xs text-coral-300" role="alert">{err}</p>}
    </section>
  );
}

/** The owner's view of one member's credits: what they received, really used, got back, every movement, and actions. */
export function MemberHistory({ member, onClose, onChanged }: { member: AdminMember; onClose: () => void; onChanged?: () => void }) {
  const [data, setData] = useState<CreditHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(() => adminStats.history(member.id).then(setData).catch((e: Error) => setError(e.message)), [member.id]);
  useEffect(() => { void reload(); }, [reload]);
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
              {notice && <p className="mt-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300" role="status">{notice}</p>}
              <Actions member={member} data={data} onDone={(msg) => { setNotice(msg); void reload(); onChanged?.(); }} />
              <p className="label mt-6">Mouvements</p>
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
