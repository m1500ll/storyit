import { ArrowUpRight } from 'lucide-react';
import { usePaywall, type PaywallReason } from './Paywall';

/** Server messages for plan limits contain "for your plan" (see migration 0006 guards). */
export const isPlanLimit = (msg: string | null | undefined) => Boolean(msg && /for your plan|plan allows/i.test(msg));

const REASON_FROM_MESSAGE = (msg: string): PaywallReason =>
  /librar|video/i.test(msg) ? 'library' : /publication|post/i.test(msg) ? 'publications' : 'accounts';

/** Turns a plan-limit dead end into an upgrade path. */
export function UpgradeHint({ message, reason }: { message: string; reason?: PaywallReason }) {
  const openPaywall = usePaywall();
  return (
    <div role="status" className="flex flex-col gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 sm:flex-row sm:items-center">
      <p className="flex-1 text-xs text-zinc-200">{message}</p>
      <button onClick={() => openPaywall({ reason: reason ?? REASON_FROM_MESSAGE(message) })}
        className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
        Changer d’offre <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
