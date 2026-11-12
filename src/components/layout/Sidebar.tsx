import {
  BookOpen, CalendarDays, Clapperboard, Handshake, Languages, Coins, CreditCard, FolderOpen, History, LayoutDashboard, LifeBuoy, Link2, Send, Settings, TrendingUp, Wand2 } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useCredits, useProfile } from '@/hooks/useStore';
import { creditLevel, projectsFor, formatCredits } from '@/services/credits';
import { cn } from '@/lib/cn';

import { usePaywall } from '../billing/Paywall';
import { Logo } from '../ui';

interface Item { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean; badge?: React.ReactNode; locked?: boolean }

function NavItem({ to, label, icon: Icon, end, badge, locked }: Item) {
  if (locked) return (
    <span aria-disabled="true" title="Bientôt disponible" className="flex cursor-not-allowed select-none items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-600">
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
    </span>
  );
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

export function Sidebar() {
  const { balance, known } = useCredits();
  const level = known ? creditLevel(balance) : 'ok'; // unknown yet: neutral look, never "empty"
  const openPaywall = usePaywall();
  const { data: profile } = useProfile();
  const isAdmin = !!(profile as { is_admin?: boolean } | null)?.is_admin;

  const sections: { title: string; items: Item[] }[] = [
    {
      title: 'Diffuser',
      items: [
        { to: '/app', label: 'Accueil', icon: LayoutDashboard, end: true },
        { to: '/app/library', label: 'Bibliothèque vidéo', icon: FolderOpen },
        { to: '/app/distribute', label: 'Diffuser', icon: Send },
        { to: '/app/calendar', label: 'Calendrier', icon: CalendarDays },
        { to: '/app/history', label: 'Historique', icon: History },
        { to: '/app/accounts', label: 'Comptes sociaux', icon: Link2 },
      ],
    },
    {
      title: 'Créer',
      items: [
        { to: '/app/studio', label: 'Animated Studio', icon: Clapperboard, badge: <span className="rounded-full bg-violet-500/15 px-1.5 text-[11px] text-violet-300">Nouveau</span> },
        { to: '/app/translate', label: 'Traduire une vidéo', icon: Languages, badge: <span className="rounded-full bg-violet-500/15 px-1.5 text-[11px] text-violet-300">Nouveau</span> },
        { to: '/app/prompts', label: 'Prompt Studio', icon: Wand2 },
      ],
    },
    {
      title: 'Grandir',
      items: [
        { to: '/app/monetisation', label: 'Monétisation', icon: TrendingUp },
        { to: '/app/guide', label: 'Guide du créateur', icon: BookOpen },
      ],
    },
    {
      title: 'Compte',
      items: [
        { to: '/app/billing', label: 'Offre et crédits', icon: CreditCard },
        { to: '/app/settings', label: 'Réglages', icon: Settings },
        { to: '/app/help', label: 'Aide', icon: LifeBuoy },
        ...(isAdmin ? [{ to: '/app/partners', label: 'Partenaires', icon: Handshake }, { to: '/app/trends', label: 'Tendances', icon: TrendingUp }] : []),
      ],
    },
  ];

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-line/[0.06] bg-ink-950 px-4 py-5 lg:flex">
      <Logo to="/app" />
      <nav className="mt-8 space-y-6" aria-label="Menu principal">
        {sections.map((s) => (
          <div key={s.title}>
            <p className="label mb-1.5 px-3 text-[11px]">{s.title}</p>
            <div className="space-y-0.5">{s.items.map((i) => <NavItem key={i.to} {...i} />)}</div>
          </div>
        ))}
      </nav>
      <div className="mt-auto pt-6">
        <div className={cn('surface p-4', level === 'low' && 'border-amber-500/40', level === 'empty' && 'border-coral-500/40')}>
          <p className="label flex items-center gap-1.5 text-[11px]"><Coins className="h-3 w-3" /> Crédits</p>
          <p className={cn('mt-1 font-display text-3xl tabular-nums', level === 'ok' ? 'text-zinc-50' : level === 'low' ? 'text-amber-300' : 'text-coral-300')}>{known ? formatCredits(balance) : '…'}</p>
          <p className="text-[11px] text-zinc-500">
            {level === 'empty' ? 'Plus de crédits : rechargez pour continuer à créer.' : level === 'low' ? 'Bientôt à court.' : `≈ ${projectsFor(balance)} projets Prompt Studio`}
          </p>
          <button onClick={() => openPaywall()}
            className="touch-hit mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#c2410c] to-[#b45309] py-2 text-xs font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-400/60">
            <Coins className="h-3.5 w-3.5" aria-hidden /> Acheter des crédits
          </button>
        </div>
      </div>
    </aside>
  );
}
