import {
  BookOpen, CalendarDays, Clapperboard, CreditCard, FolderOpen, History, LayoutDashboard, LifeBuoy, Link2, Menu, Send,
  Settings, TrendingUp, Wand2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { useBetaAccess } from '@/hooks/useBeta';

const tabs = [
  { to: '/app', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/app/library', label: 'Library', icon: FolderOpen },
  { to: '/app/distribute', label: 'Distribute', icon: Send },
  { to: '/app/calendar', label: 'Calendar', icon: CalendarDays },
];

/** Everything the desktop sidebar offers, so no page is unreachable on a phone. */
const sections = [
  { title: 'Distribute', items: [
    { to: '/app/history', label: 'History', icon: History },
    { to: '/app/accounts', label: 'Social accounts', icon: Link2 },
  ] },
  { title: 'Create', items: [
    { to: '/app/studio', label: 'Animated Studio', icon: Clapperboard, badge: 'New' },
    { to: '/app/prompts', label: 'Prompt Studio', icon: Wand2 },
  ] },
  { title: 'Grow', items: [
    { to: '/app/monetisation', label: 'Monetisation', icon: TrendingUp },
    { to: '/app/guide', label: 'Creator guide', icon: BookOpen },
  ] },
  { title: 'Account', items: [
    { to: '/app/billing', label: 'Plan & credits', icon: CreditCard },
    { to: '/app/settings', label: 'Settings', icon: Settings },
    { to: '/app/help', label: 'Help', icon: LifeBuoy },
  ] },
];

/** Bottom tab bar for phones (the sidebar is hidden below lg) + a full menu sheet. */
export function MobileNav() {
  const beta = useBetaAccess();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const inMenu = sections.some((s) => !('soon' in s) && s.items.some((i) => pathname.startsWith(i.to)));

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-black/60" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto overscroll-contain rounded-t-3xl border-t border-line/10 bg-ink-950 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-100">Menu</p>
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="grid h-10 w-10 place-items-center rounded-full text-zinc-400 hover:bg-line/5"><X className="h-5 w-5" /></button>
            </div>
            {sections.filter((s) => ('beta' in s ? beta : 'soon' in s ? !beta : true)).map((s) => (
              <div key={s.title} className="mt-3">
                <p className="label mb-1 px-2">{s.title}</p>
                <ul>
                  {s.items.map(({ to, label, icon: Icon, ...rest }) => (
                    <li key={to}>
                      {'soon' in s ? (
                        <span aria-disabled="true" className="flex min-h-11 cursor-not-allowed items-center gap-3 rounded-xl px-3 text-[15px] text-zinc-600">
                          <Icon className="h-5 w-5 shrink-0" /><span className="flex-1">{label}</span>
                        </span>
                      ) : (
                      <NavLink to={to} className={({ isActive }) => cn('flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px]', isActive ? 'bg-line/[0.07] text-zinc-50' : 'text-zinc-300')}>
                        <Icon className="h-5 w-5 shrink-0 text-zinc-500" /><span className="flex-1">{label}</span>
                        {'badge' in rest && <span className="rounded-full bg-violet-500/15 px-2 text-[11px] text-violet-300">{rest.badge}</span>}
                      </NavLink>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line/[0.06] bg-ink-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Main">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => cn('relative flex flex-col items-center gap-1 py-2.5 text-[11px] [touch-action:manipulation]', isActive ? 'text-violet-300' : 'text-zinc-500')}>
            <Icon className="h-5 w-5" />{label}
          </NavLink>
        ))}
        <button onClick={() => setOpen(true)} aria-expanded={open} aria-haspopup="dialog"
          className={cn('flex flex-col items-center gap-1 py-2.5 text-[11px] [touch-action:manipulation]', inMenu || open ? 'text-violet-300' : 'text-zinc-500')}>
          <Menu className="h-5 w-5" />Menu
        </button>
      </nav>
    </>
  );
}
