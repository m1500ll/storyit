import { Clapperboard, LayoutDashboard, Loader2, Plus, TrendingUp, UserRound } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { useWizard } from '@/services/wizardStore';

const items = [
  { to: '/app', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/app/episodes', label: 'Episodes', icon: Clapperboard },
  { to: '/app/new', label: 'Create', icon: Plus },
  { to: '/app/monetisation', label: 'Money', icon: TrendingUp },
  { to: '/app/settings', label: 'Account', icon: UserRound },
];

/** Bottom tab bar for phones (the sidebar is hidden below lg). */
export function MobileNav() {
  const { pending } = useWizard();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line/[0.06] bg-ink-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Main">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end}
          className={({ isActive }) => cn('relative flex flex-col items-center gap-1 py-2.5 text-[10px]', isActive ? 'text-violet-300' : 'text-zinc-500')}>
          {to === '/app/new' && pending ? <Loader2 className="h-5 w-5 animate-spin text-violet-300" /> : <Icon className="h-5 w-5" />}{label}
        </NavLink>
      ))}
    </nav>
  );
}
