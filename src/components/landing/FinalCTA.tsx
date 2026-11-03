import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../ui';

export function FinalCTA() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24 md:px-6">
      <div className="relative overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-600/20 via-ink-900 to-coral-500/10 px-6 py-16 text-center">
        <h2 className="font-display text-4xl text-zinc-50 md:text-5xl">Your next series is one sentence away.</h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-zinc-400">Start with 30 free Story Credits. No card required.</p>
        <Link to="/login" className="mt-8 inline-block"><Button size="lg">Create my first episode <ArrowRight className="h-4 w-4" /></Button></Link>
      </div>
    </section>
  );
}
