import { Coins } from 'lucide-react';
import { useCredits } from '@/hooks/useStore';
import { cn } from '@/lib/cn';
import { creditLevel, formatCredits } from '@/services/credits';

/** Credit counter: violet when fine, amber when low, coral when empty. */
export function CreditBalance({ className }: { className?: string }) {
  const { balance, known } = useCredits();
  const level = known ? creditLevel(balance) : 'ok'; // unknown yet: neutral look, never "empty"
  return (
    <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5',
      level === 'ok' && 'border-violet-500/25 bg-violet-500/10',
      level === 'low' && 'border-amber-500/40 bg-amber-500/15',
      level === 'empty' && 'border-coral-500/40 bg-coral-500/15', className)}>
      <Coins className={cn('h-3.5 w-3.5', level === 'ok' ? 'text-violet-300' : level === 'low' ? 'text-amber-300' : 'text-coral-300')} aria-hidden />
      <span className="text-xs font-semibold tabular-nums text-zinc-100">{known ? formatCredits(balance) : '…'}</span>
      <span className="hidden text-[11px] text-zinc-400 sm:inline">crédits</span>
    </div>
  );
}
