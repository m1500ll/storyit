import { Coins, X } from 'lucide-react';
import { useState } from 'react';
import { useCredits } from '@/hooks/useStore';
import { cn } from '@/lib/cn';
import { creditLevel, formatCredits, LOW_CREDITS } from '@/services/credits';
import { usePaywall } from './Paywall';

const KEY = 'storyit:low-credits-dismissed-at';
const DAY = 86_400_000;

/**
 * Usage nudge shown on every app page: warn before the user hits the wall, not mid-flow.
 * Low (≤ LOW_CREDITS) can be dismissed for 24 h; empty stays until they top up.
 */
export function LowCreditsBanner() {
  const { balance, loading, known } = useCredits();
  const openPaywall = usePaywall();
  const [hidden, setHidden] = useState(() => { try { return Date.now() - Number(localStorage.getItem(KEY) ?? 0) < DAY; } catch { return false; } });
  const level = creditLevel(balance);
  if (loading || !known || level === 'ok' || (level === 'low' && hidden)) return null;
  const empty = level === 'empty';
  return (
    <div role="status" className={cn('mb-6 flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center',
      empty ? 'border-coral-500/30 bg-coral-500/10' : 'border-amber-500/30 bg-amber-500/[0.08]')}>
      <Coins className={cn('hidden h-4 w-4 shrink-0 sm:block', empty ? 'text-coral-300' : 'text-amber-300')} aria-hidden />
      <p className="flex-1 text-sm text-zinc-200">
        {empty
          ? <>Vous n’avez plus de crédits. Rechargez pour continuer à utiliser les studios IA.</>
          : <>Plus que <strong className="tabular-nums">{formatCredits(balance)}</strong> crédits (alerte sous {formatCredits(LOW_CREDITS)}). Rechargez maintenant pour ne pas être bloqué en plein projet.</>}
      </p>
      <div className="flex shrink-0 items-center gap-1">
        <button onClick={() => openPaywall()}
          className="touch-hit rounded-lg bg-gradient-to-r from-[#c2410c] to-[#b45309] px-3.5 py-2 text-xs font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-400/60">
          Acheter des crédits
        </button>
        {!empty && (
          <button aria-label="Masquer pendant 24 heures" onClick={() => { setHidden(true); try { localStorage.setItem(KEY, String(Date.now())); } catch { /* private mode */ } }}
            className="rounded-lg p-2 text-zinc-500 hover:bg-line/5 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"><X className="h-4 w-4" /></button>
        )}
      </div>
    </div>
  );
}
