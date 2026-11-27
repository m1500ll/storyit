import { useState } from 'react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatCredits } from '@/services/credits';
import type { TrialState, TrialStats } from '@/services/adminStats';

const usd = (cents: number) => `${(cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })} $`;
const day = (v: number | null) => (v ? new Date(v).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—');
const STATE: Record<TrialState, { label: string; cls: string }> = {
  ongoing: { label: 'En cours', cls: 'bg-amber-500/15 text-amber-300' },
  cancelled: { label: 'En cours · a résilié', cls: 'bg-line/[0.08] text-zinc-300' },
  converted: { label: 'A payé', cls: 'bg-emerald-500/15 text-emerald-300' },
  lost: { label: 'Parti sans payer', cls: 'bg-coral-500/15 text-coral-300' },
  blocked: { label: 'Bloqué', cls: 'bg-line/[0.06] text-zinc-500' },
};

function Box({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-line/[0.04] p-3">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className={cn('mt-1 font-display text-2xl tabular-nums', tone ?? 'text-zinc-50')}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-zinc-500">{hint}</p>}
    </div>
  );
}

/** The free trials: how many became paying customers, and what the running ones would bring if they all paid. */
export function TrialsPanel({ t }: { t: TrialStats }) {
  const [showAll, setShowAll] = useState(false);
  // the real rate: people who took a trial since the beginning, and how many paid
  const all = t.people?.all, free = t.people?.free, dollar = t.people?.dollar;
  const pct = (g?: { took: number; paid: number }) => (g && g.took ? Math.round((g.paid / g.took) * 100) : null);
  const rate = pct(all);
  const running = t.ongoing + t.cancelled;
  const list = showAll ? t.list : t.list.slice(0, 8);
  return (
    <Card className="mt-6" aria-labelledby="trials-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="trials-title" className="font-display text-lg text-zinc-50">Essais gratuits</h2>
        <p className="text-[11px] text-zinc-500">Depuis le début : {all?.took ?? 0} personnes ont pris un essai{all?.abuse ? `, dont ${all.abuse} retiré${all.abuse > 1 ? 's' : ''} pour fraude` : ''}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Box label="Taux de conversion" value={rate === null ? '—' : `${rate} %`} tone="text-emerald-300"
          hint={all ? `${all.paid} ont payé sur ${all.took} essais · gratuit : ${free?.paid ?? 0}/${free?.took ?? 0} (${pct(free) ?? 0} %) · à 1 $ : ${dollar?.paid ?? 0}/${dollar?.took ?? 0} (${pct(dollar) ?? 0} %)` : ''} />
        <Box label="Essais en cours" value={String(running)} hint={`${t.ongoing} vont être prélevés · ${t.cancelled} ont résilié`} />
        <Box label="Si tous les essais en cours paient" value={usd(t.ifAllPayCents)} tone="text-violet-200"
          hint={`${usd(t.ifNotCancelledPayCents)} si seuls ceux qui n’ont pas résilié paient`} />
        <Box label="Déjà encaissé grâce aux essais" value={usd(all?.paidCents ?? t.convertedCents)}
          hint={`${usd(t.ifAllEverPaidCents)} si tous les essais pris avaient payé`} />
      </div>
      {t.list.length > 0 && (
        <>
          <ul className="mt-4 divide-y divide-line/5">
            {list.map((x, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm">
                <span className="min-w-0 break-all text-zinc-200">{x.email || 'compte inconnu'}</span>
                <span className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                  <span>début {day(x.startedAt)}</span>
                  {(x.state === 'ongoing' || x.state === 'cancelled') && <span>fin {day(x.endsAt)}</span>}
                  <span>{formatCredits(x.used)} crédits utilisés</span>
                  <span className="tabular-nums text-zinc-300">{x.state === 'converted' ? usd(x.paidCents) : usd(x.priceCents)}</span>
                  <span className={cn('whitespace-nowrap rounded-full px-2 py-0.5 font-medium', STATE[x.state].cls)}>{STATE[x.state].label}</span>
                </span>
              </li>
            ))}
          </ul>
          {t.list.length > 8 && (
            <button type="button" onClick={() => setShowAll((v) => !v)}
              className="touch-hit mt-2 rounded text-xs font-semibold text-violet-300 hover:text-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
              {showAll ? 'Voir moins' : `Voir les ${t.list.length} essais`}
            </button>
          )}
        </>
      )}
    </Card>
  );
}
