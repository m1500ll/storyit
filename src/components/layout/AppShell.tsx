import { Outlet } from 'react-router-dom';
import { PaywallProvider } from '../billing/Paywall';
import { MobileNav } from './MobileNav';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppShell() {
  return (
    <PaywallProvider>
      <div className="flex min-h-screen bg-ink-950">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-8 md:px-8 lg:pb-8"><Outlet /></main>
        </div>
        <MobileNav />
      </div>
    </PaywallProvider>
  );
}
