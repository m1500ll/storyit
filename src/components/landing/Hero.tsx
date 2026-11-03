import { ArrowRight, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FRUIT_DRAMA_SCENES } from '@/data/fruitDrama';
import { Button, ScenePoster } from '../ui';

const STRIP = [['Strawberry', 1], ['Lemon', 2], ['Strawberry', 5], ['Lemon', 8], ['Lime', 13], ['Strawberry', 15]] as const;

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
          Type one sentence. Get a 15-scene, ~60-second vertical episode — script, characters, image &amp; motion prompts — ready for TikTok. You approve every scene before anything ships.
        </p>
        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/login"><Button size="lg">Start your first episode <ArrowRight className="h-4 w-4" /></Button></Link>
          <a href="#demo"><Button size="lg" variant="secondary"><Play className="h-4 w-4" /> Watch demo</Button></a>
        </div>
        <p className="mt-4 text-xs text-zinc-500">30 free Story Credits · No card required · Cancel anytime</p>
        <figure className="mx-auto mt-14 max-w-3xl">
          <div className="flex justify-center gap-2 sm:gap-3">
            {STRIP.map(([species, pos], i) => (
              <div key={pos} className="w-[15%] max-w-[110px] overflow-hidden rounded-xl border border-white/10 shadow-2xl"
                style={{ transform: `translateY(${[8, 0, -6, -6, 0, 8][i]}px) rotate(${[-4, -2, -1, 1, 2, 4][i]}deg)` }}>
                <div className="aspect-[9/16]"><ScenePoster species={species} seed={pos} /></div>
              </div>
            ))}
          </div>
          <figcaption className="mt-5 text-xs text-zinc-500">
            Example storyboard for the prompt <span className="text-zinc-300">“a jealous strawberry and an arrogant lemon”</span> — {FRUIT_DRAMA_SCENES.length} scenes, hook to cliffhanger.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
