import { ArrowDownRight, ArrowUpRight, Coins } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCredits } from '@/hooks/useStore';
import { episodesFor } from '@/services/credits';
import { Card } from './Card';

export function CreditCard() {
  const { balance, transactions } = useCredits();
  const episodesLeft = episodesFor(balance);
  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-500/20 blur-3xl" />
      <p className="label flex items-center gap-1.5"><Coins className="h-3 w-3" /> Story Credits</p>
      <p className="mt-2 font-display text-5xl text-zinc-50 tabular-nums">{balance}</p>
      <p className="mt-1 text-xs text-zinc-500">≈ {episodesLeft} full episodes remaining</p>
      <ul className="mt-5 space-y-2 border-t border-line/5 pt-4">
        {transactions.slice(0, 3).map((t) => (
          <li key={t.id} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 truncate text-zinc-400">
              {t.amount < 0 ? <ArrowDownRight className="h-3.5 w-3.5 text-coral-400" /> : <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />}
              <span className="truncate">{t.description}</span>
            </span>
            <span className={t.amount < 0 ? 'text-coral-300' : 'text-emerald-300'}>{t.amount > 0 ? '+' : ''}{t.amount}</span>
          </li>
        ))}
      </ul>
      <Link to="/app/billing" className="mt-4 inline-block text-xs font-medium text-violet-300 hover:text-violet-200">Top up credits →</Link>
    </Card>
  );
}
