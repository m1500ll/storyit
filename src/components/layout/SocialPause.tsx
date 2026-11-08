import { Gift, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, PageHeader } from '@/components/ui';

/** Temporary: connecting social accounts is paused while TikTok fixes a technical issue. Set to false to reopen. */
export const SOCIAL_PAUSED = true;

export function SocialPause({ children }: { children: ReactNode }) {
  if (!SOCIAL_PAUSED) return <>{children}</>;
  return (
    <>
      <PageHeader eyebrow="Maintenance" title="Comptes sociaux en pause"
        description="La connexion des comptes TikTok est temporairement indisponible." />
      <Card className="max-w-xl">
        <p className="flex items-center gap-2 text-sm font-semibold text-zinc-100"><Wrench className="h-4 w-4 text-amber-300" aria-hidden /> Une erreur technique côté TikTok</p>
        <p className="mt-2 text-sm text-zinc-300">
          Une erreur technique empêche en ce moment de connecter les comptes TikTok. Le problème vient de TikTok et sa
          réparation va prendre quelques jours. Nous rouvrons cette page dès que tout fonctionne à nouveau.
        </p>
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-200">
          <Gift className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>Pour nous excuser, les abonnés Creator reçoivent <strong>200 crédits offerts</strong>, déjà ajoutés à leur solde.</span>
        </p>
        <p className="mt-4 text-xs text-zinc-400">En attendant, vous pouvez télécharger vos vidéos depuis la bibliothèque et les publier directement dans l’appli TikTok.</p>
      </Card>
    </>
  );
}
