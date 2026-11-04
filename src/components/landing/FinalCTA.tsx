import { ArrowRight } from 'lucide-react';
import { Button } from '../ui';
import { StartLink } from './StartLink';

export function FinalCTA() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24 md:px-6">
      <div className="relative overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-600/20 via-ink-900 to-coral-500/10 px-6 py-16 text-center">
        <div aria-hidden="true" className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,#000_20%,transparent_75%)]" />
        <h2 className="relative font-display text-4xl text-zinc-50 md:text-5xl">Your videos, on every account, on time.</h2>
        <p className="relative mx-auto mt-3 max-w-md text-sm text-zinc-400">Start free with 30 credits and write your first story in the Prompt Studio. No card required.</p>
        <StartLink to="/app" className="relative mt-8 inline-block"><Button size="lg">Write my first story <ArrowRight className="h-4 w-4" /></Button></StartLink>
      </div>
    </section>
  );
}
