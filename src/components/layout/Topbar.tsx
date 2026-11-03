import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { mockDb } from '@/data/mockDb';
import { Button, CreditBalance, Logo } from '../ui';

export function Topbar() {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-white/[0.06] bg-ink-950/80 px-4 backdrop-blur md:px-8">
      <div className="lg:hidden"><Logo to="/app" /></div>
      <div className="hidden lg:block" />
      <div className="flex items-center gap-3">
        <CreditBalance />
        <Button size="sm" onClick={() => navigate('/app/new')} className="hidden sm:inline-flex"><Plus className="h-3.5 w-3.5" /> Create episode</Button>
        <div className="grid h-8 w-8 place-items-center rounded-full bg-ink-700 text-xs font-semibold text-zinc-200" title={mockDb.profile.display_name ?? ''}>
          {mockDb.profile.display_name?.[0] ?? 'U'}
        </div>
      </div>
    </header>
  );
}
