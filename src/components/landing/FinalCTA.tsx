import { ArrowRight } from 'lucide-react';
import { Button } from '../ui';
import { StartLink } from './StartLink';
import { useLang } from '@/lib/lang';

export function FinalCTA() {
  const fr = useLang() === 'fr';
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24 md:px-6">
      <div className="relative overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-600/20 via-ink-900 to-coral-500/10 px-6 py-16 text-center">
        <div aria-hidden="true" className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,#000_20%,transparent_75%)]" />
        <h2 className="relative font-display text-4xl text-zinc-50 md:text-5xl">{fr ? 'Ta prochaine vidéo IA virale commence ici.' : 'Your next viral AI video starts here.'}</h2>
        <p className="relative mx-auto mt-3 max-w-md text-sm text-zinc-400">{fr ? <>3 000 crédits offerts pour commencer, sans carte. Puis Creator à <s className="text-zinc-500">45 $</s> 29 $/mois, sans engagement.</> : <>3,000 free credits to start, no card. Then Creator at <s className="text-zinc-500">$45</s> $29/mo, cancel anytime.</>}</p>
        <StartLink to="/app" className="relative mt-8 inline-block"><Button size="lg">{fr ? 'Créer ma première vidéo IA' : 'Create my first AI video'} <ArrowRight className="h-4 w-4" /></Button></StartLink>
      </div>
    </section>
  );
}
