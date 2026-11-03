import {
  BookOpen, CalendarDays, ClipboardCheck, Clapperboard, Coins, CreditCard, FolderOpen, History, LayoutDashboard, LifeBuoy, Link2, Loader2, Send, Settings, Sparkles, TrendingUp, Users,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useCredits, useStories } from '@/hooks/useStore';
import { cn } from '@/lib/cn';
import { episodesFor } from '@/services/credits';
import { useWizard } from '@/services/wizardStore';
import { usePaywall } from '../billing/Paywall';
import { Logo } from '../ui';

interface Item { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean; badge?: React.ReactNode }

function NavItem({ to, label, icon: Icon, end, badge }: Item) {
  return (
    <NavLink to={to} end={end}
      className={({ isActive }) => cn(
        'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition',
        isActive ? 'bg-line/[0.07] text-zinc-50' : 'text-zinc-400 hover:bg-line/[0.04] hover:text-zinc-200',
      )}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {badge}
    </NavLink>
  );
}

const Count = ({ n, tone = 'muted' }: { n: number; tone?: 'muted' | 'accent' }) =>
  n > 0 ? <span className={cn('rounded-full px-1.5 text-[10px] font-semibold tabular-nums', tone === 'accent' ? 'bg-amber-500/15 text-amber-300' : 'bg-line/[0.08] text-zinc-400')}>{n}</span> : null;

export function Sidebar() {
  const { data: stories = [] } = useStories();
  const { balance } = useCredits();
  const w = useWizard();
  const openPaywall = usePaywall();
  const toReview = stories.filter((s) => s.status === 'in_review').length;
  const characters = new Set(stories.flatMap((s) => s.characters.map((c) => `${c.name}|${c.species}`))).size;

  const sections: { title: string; items: Item[] }[] = [
    {
      title: 'Distribute',
      items: [
        { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
        { to: '/app/library', label: 'Video library', icon: FolderOpen },
        { to: '/app/distribute', label: 'Distribute', icon: Send },
        { to: '/app/calendar', label: 'Calendar', icon: CalendarDays },
        { to: '/app/history', label: 'History', icon: History },
        { to: '/app/accounts', label: 'Social accounts', icon: Link2 },
      ],
    },
    {
      title: 'AI studio · Beta',
      items: [
        {
          to: '/app/new', label: 'New episode', icon: Sparkles,
          badge: w.pending ? <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-300" aria-label="Generating" />
            : w.step > 0 ? <span className="h-1.5 w-1.5 rounded-full bg-violet-400" aria-label="Draft in progress" /> : <span className="rounded-full bg-line/[0.08] px-1.5 text-[10px] text-zinc-400">Beta</span>,
        },
        { to: '/app/episodes', label: 'Episodes', icon: Clapperboard, badge: <Count n={stories.length} /> },
        { to: '/app/characters', label: 'Characters', icon: Users, badge: <Count n={characters} /> },
        { to: '/app/review', label: 'Review queue', icon: ClipboardCheck, badge: <Count n={toReview} tone="accent" /> },
      ],
    },
    {
      title: 'Grow',
      items: [
        { to: '/app/monetisation', label: 'Monetisation', icon: TrendingUp },
        { to: '/app/guide', label: 'Creator guide', icon: BookOpen },
      ],
    },
    {
      title: 'Account',
      items: [
        { to: '/app/billing', label: 'Plan & credits', icon: CreditCard },
        { to: '/app/settings', label: 'Settings', icon: Settings },
        { to: '/app/help', label: 'Help', icon: LifeBuoy },
      ],
    },
  ];

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-line/[0.06] bg-ink-950 px-4 py-5 lg:flex">
      <Logo to="/app" />
      <nav className="mt-8 space-y-6" aria-label="Main">
        {sections.map((s) => (
          <div key={s.title}>
            <p className="label mb-1.5 px-3 text-[10px]">{s.title}</p>
            <div className="space-y-0.5">{s.items.map((i) => <NavItem key={i.to} {...i} />)}</div>
          </div>
        ))}
      </nav>
      <div className="mt-auto pt-6">
        <div className="surface p-4">
          <p className="label flex items-center gap-1.5 text-[10px]"><Coins className="h-3 w-3" /> Story Credits</p>
          <p className="mt-1 font-display text-3xl tabular-nums text-zinc-50">{balance}</p>
          <p className="text-[11px] text-zinc-500">≈ {episodesFor(balance)} full episodes</p>
          <button onClick={() => openPaywall()} className="mt-3 w-full rounded-lg bg-violet-500/15 py-1.5 text-xs font-medium text-violet-300 transition hover:bg-violet-500/25">
            Get more credits
          </button>
        </div>
      </div>
    </aside>
  );
}
