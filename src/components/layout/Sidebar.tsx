import { ClipboardCheck, Film, LayoutDashboard, Settings, Sparkles } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { Logo } from '../ui';

const nav = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/new', label: 'New episode', icon: Sparkles },
  { to: '/app/review', label: 'Review queue', icon: ClipboardCheck },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-white/[0.06] bg-ink-950 px-4 py-5 lg:flex">
      <Logo to="/app" />
      <nav className="mt-10 space-y-1">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => cn(
              'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition',
              isActive ? 'bg-white/[0.06] text-zinc-50' : 'text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200',
            )}>
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto surface p-4">
        <Film className="h-4 w-4 text-coral-400" />
        <p className="mt-2 text-xs font-medium text-zinc-200">Fruit Drama</p>
        <p className="text-[11px] text-zinc-500">Vertical 9:16 · 15 scenes</p>
      </div>
    </aside>
  );
}
