import { Coins, LogOut, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '@/hooks/useStore';
import { usePaywall } from '../billing/Paywall';
import { useAuth } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Button, CreditBalance, Logo, ThemeToggle } from '../ui';

export function Topbar() {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { signOut } = useAuth();
  const openPaywall = usePaywall();
  const name = profile?.display_name ?? 'Studio';
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 sm:gap-4 border-b border-line/[0.06] bg-ink-950/80 px-4 backdrop-blur md:px-8">
      <div className="lg:hidden"><Logo to="/app" /></div>
      <div className="hidden lg:block" />
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
        <ThemeToggle className="hidden sm:inline-flex" />
        <button onClick={() => openPaywall()} aria-label="Your credits — buy more" className="touch-hit rounded-full transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"><CreditBalance /></button>
        <button onClick={() => openPaywall()}
          className="touch-hit inline-flex h-8 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#c2410c] to-[#b45309] px-3 text-xs font-semibold text-white shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-400/60">
          <Coins className="h-3.5 w-3.5" aria-hidden /><span className="hidden sm:inline">Buy credits</span><span className="sm:hidden">Buy</span>
        </button>
        <Button size="sm" variant="secondary" onClick={() => navigate('/app/distribute')} className="hidden lg:inline-flex"><Plus className="h-3.5 w-3.5" /> Distribute</Button>
        <div className="hidden h-8 w-8 place-items-center rounded-full bg-ink-700 text-xs font-semibold text-zinc-200 sm:grid" title={name}>
          {name[0]?.toUpperCase()}
        </div>
        {isSupabaseConfigured && (
          <button onClick={() => signOut().then(() => navigate('/'))} className="touch-hit rounded-lg p-2 text-zinc-500 hover:bg-line/5 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50" aria-label="Sign out" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </header>
  );
}
