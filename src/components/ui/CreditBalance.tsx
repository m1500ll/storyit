import { Coins } from 'lucide-react';
import { useCredits } from '@/hooks/useStore';
import { cn } from '@/lib/cn';

export function CreditBalance({ className }: { className?: string }) {
  const { balance } = useCredits();
  return (
    <div className={cn('inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1.5', className)}>
      <Coins className="h-3.5 w-3.5 text-violet-300" />
      <span className="text-xs font-semibold tabular-nums text-zinc-100">{balance}</span>
      <span className="text-[11px] text-zinc-400">credits</span>
    </div>
  );
}
