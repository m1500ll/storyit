import { CalendarDays, Lock, Send, Upload } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card, LoadState, PageHeader } from '@/components/ui';
import { useProfile } from '@/hooks/useStore';

/** Distribution (library, scheduling, accounts) is for Creator and Studio subscribers; the free plan keeps the Prompt Studio. */
export function SubscriberGate({ children }: { children: ReactNode }) {
  const { data: profile, loading } = useProfile();
  if (loading && !profile) return <LoadState loading error={null} />;
  if (profile && profile.plan !== 'free') return <>{children}</>;
  return (
    <>
      <PageHeader eyebrow="Offres payantes" title="Publiez sur tous vos comptes"
        description="L’import de vidéos, la programmation et la publication sur TikTok et Instagram sont inclus dans les offres payantes." />
      <Card className="max-w-xl">
        <Lock className="h-5 w-5 text-violet-300" aria-hidden />
        <ul className="mt-4 space-y-2 text-sm text-zinc-300">
          {[
            { Icon: Upload, text: 'Importez vos vidéos une fois, gardez-les dans une seule bibliothèque' },
            { Icon: Send, text: 'Publiez la même vidéo sur chaque compte, avec sa propre légende' },
            { Icon: CalendarDays, text: 'Programmez à l’avance ou lancez une rotation quotidienne, même navigateur fermé' },
          ].map(({ Icon, text }) => (
            <li key={text} className="flex items-start gap-2"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" aria-hidden />{text}</li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link to="/app/billing" className="inline-flex h-10 items-center rounded-xl bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">Voir les offres — dès 29 $/mois</Link>
          <Link to="/app/prompts" className="text-sm text-zinc-400 hover:text-zinc-200">Ou continuez avec le Prompt Studio</Link>
        </div>
      </Card>
    </>
  );
}
