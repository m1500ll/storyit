import { ArrowRight, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../ui';

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-violet-600/20 blur-[120px]" />
      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-24 text-center md:px-6 md:pt-32">
        <p className="label mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-coral-400" /> AI short-form series studio
        </p>
        <h1 className="mx-auto mt-6 max-w-4xl font-display text-5xl leading-[1.05] text-zinc-50 md:text-7xl">
          Turn one idea into an <em className="bg-gradient-to-r from-violet-300 to-coral-300 bg-clip-text italic text-transparent">entire video series</em>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base text-zinc-400">
          Storyit writes, storyboards and renders 15-scene vertical episodes with consistent characters — you stay the director with a human approval gate before anything ships.
        </p>
        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/app/new"><Button size="lg">Start your first episode <ArrowRight className="h-4 w-4" /></Button></Link>
          <a href="#demo"><Button size="lg" variant="secondary"><Play className="h-4 w-4" /> Watch demo</Button></a>
        </div>
        <p className="mt-4 text-xs text-zinc-600">30 free Story Credits · No card required</p>
      </div>
    </section>
  );
}
