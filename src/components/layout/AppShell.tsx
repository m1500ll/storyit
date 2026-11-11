import { Outlet, useLocation } from 'react-router-dom';
import { useSeo } from '@/lib/seo';
import { LowCreditsBanner } from '../billing/LowCreditsBanner';
import { PaywallProvider } from '../billing/Paywall';
import { MobileNav } from './MobileNav';
import { WizardNotifier } from './WizardNotifier';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const TITLES: Record<string, string> = {
  '/app': 'Overview', '/app/library': 'Video library', '/app/distribute': 'Distribute', '/app/calendar': 'Calendar', '/app/history': 'History',
  '/app/accounts': 'Social accounts', '/app/billing': 'Plan & credits', '/app/settings': 'Settings', '/app/help': 'Help', '/app/studio': 'Animated Studio', '/app/translate': 'Traduire une vidéo', '/app/partners': 'Partenaires', '/app/trends': 'Tendances', '/app/prompts': 'Prompt Studio',
  '/app/monetisation': 'Monetisation', '/app/guide': 'Creator guide',
};

export function AppShell() {
  const { pathname } = useLocation();
  // The signed-in app is private: never indexed. Titles help people with many tabs open.
  useSeo({ title: TITLES[pathname] ?? 'Studio', noindex: true });
  return (
    <PaywallProvider>
      <a href="#main" className="sr-only z-50 rounded-lg bg-violet-500 px-4 py-2 text-sm text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
      <div className="flex min-h-screen bg-ink-950">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-8 md:px-8 lg:pb-8"><LowCreditsBanner /><div key={pathname} className="motion-safe:animate-[pagein_0.35s_ease-out]"><Outlet /></div></main>
        </div>
        <MobileNav />
        <WizardNotifier />
      </div>
    </PaywallProvider>
  );
}
