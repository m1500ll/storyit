import { Lock, Wand2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card, LoadState, PageHeader } from '@/components/ui';
import { useBetaAccess } from '@/hooks/useBeta';

/** Pages of the AI episode studio: only for invited beta accounts. Everyone else gets a clear "coming soon". */
export function BetaGate({ children }: { children: ReactNode }) {
  const beta = useBetaAccess();
  if (beta === undefined) return <LoadState loading error={null} />;
  if (beta) return <>{children}</>;
  return (
    <>
      <PageHeader eyebrow="Coming soon" title="AI episode studio" description="Automatic video creation is in private beta. It will open to every account once it is ready." />
      <Card className="max-w-xl">
        <Lock className="h-5 w-5 text-violet-300" aria-hidden />
        <p className="mt-3 text-sm text-zinc-200">Cette partie de Storyit n’est pas encore disponible sur votre compte.</p>
        <p className="mt-1 text-sm text-zinc-400">En attendant, le Prompt Studio écrit un Fruit Drama complet de plus d’une minute et crée la vidéo pour vous.</p>
        <Link to="/app/prompts" className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
          <Wand2 className="h-4 w-4" aria-hidden /> Open the Prompt Studio
        </Link>
      </Card>
    </>
  );
}
