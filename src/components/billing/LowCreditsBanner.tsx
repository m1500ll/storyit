import { Coins } from 'lucide-react';
import { useCredits } from '@/hooks/useStore';
import { FULL_EPISODE_COST } from '@/services/credits';
import { usePaywall } from './Paywall';

/**
 * Usage-limit nudge (paywalls skill): warn before the user hits the wall instead of blocking
 * mid-flow. Only shown when the balance can't cover a full episode.
 */
export function LowCreditsBanner() {
  const { balance, loading } = useCredits();
  const openPaywall = usePaywall();
  if (loading || balance >= FULL_EPISODE_COST) return null;
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 sm:flex-row sm:items-center">
      <Coins className="hidden h-4 w-4 shrink-0 text-amber-300 sm:block" />
      <p className="flex-1 text-sm text-amber-100/90">
        You have <strong className="tabular-nums">{balance}</strong> credits — enough for storyboards, but a full rendered episode needs about {FULL_EPISODE_COST}.
      </p>
      <button onClick={() => openPaywall({ required: FULL_EPISODE_COST })}
        className="shrink-0 rounded-lg bg-amber-400/15 px-3 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-400/25">
        Get more credits
      </button>
    </div>
  );
}
