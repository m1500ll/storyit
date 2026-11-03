import { ClipboardCheck, LayoutDashboard, Plus, Settings } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';

const items = [
  { to: '/app', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/app/new', label: 'Create', icon: Plus },
  { to: '/app/review', label: 'Review', icon: ClipboardCheck },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

/** Bottom tab bar for phones (the sidebar is hidden below lg). */
export function MobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line/[0.06] bg-ink-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end}
          className={({ isActive }) => cn('flex flex-col items-center gap-1 py-2.5 text-[10px]', isActive ? 'text-violet-300' : 'text-zinc-500')}>
          <Icon className="h-5 w-5" />{label}
        </NavLink>
      ))}
    </nav>
  );
}
