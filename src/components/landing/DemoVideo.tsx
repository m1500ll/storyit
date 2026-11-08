import { Pause, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FRUIT_DRAMA_SCENES } from '@/data/fruitDrama';
import { cn } from '@/lib/cn';
import { ScenePoster } from '../ui';

const SPECIES = ['Strawberry', 'Lemon', 'Strawberry', 'Kiwi', 'Strawberry', 'Banana', 'Strawberry', 'Lemon', 'Grape', 'Strawberry', 'Strawberry', 'Lemon', 'Lime', 'Strawberry', 'Strawberry'];

/** Animated storyboard preview. Swap for a <video> once a real demo render exists. */
export function DemoVideo() {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % FRUIT_DRAMA_SCENES.length), 1800);
    return () => clearInterval(t);
  }, [playing]);

  const scene = FRUIT_DRAMA_SCENES[i]!;
  return (
    <section id="demo" className="mx-auto max-w-6xl px-4 py-16 md:px-6">
      <div className="surface grid items-center gap-10 overflow-hidden p-6 md:grid-cols-[1fr_auto] md:p-12">
        <div>
          <p className="label">Inside the studio</p>
          <h2 className="mt-3 font-display text-4xl text-zinc-50">Your storyboard, scene by scene</h2>
          <p className="mt-3 max-w-md text-sm text-zinc-400">Example: “a jealous strawberry and an arrogant lemon”. Fifteen scenes, each with its line of dialogue and prompts — with a cliffhanger that brings viewers back for episode 2.</p>
          <ol className="mt-6 grid max-w-md grid-cols-5 gap-2">
            {FRUIT_DRAMA_SCENES.map((s, n) => (
              <li key={s.position}>
                <button onClick={() => { setI(n); setPlaying(false); }} aria-label={`Scene ${s.position}: ${s.title}`}
                  className={cn('block aspect-[9/16] w-full overflow-hidden rounded-md border transition', n === i ? 'border-violet-400 ring-2 ring-violet-500/30' : 'border-white/10 opacity-60 hover:opacity-100')}>
                  <ScenePoster species={SPECIES[n]} seed={s.position} />
                </button>
              </li>
            ))}
          </ol>
        </div>
        <div className="relative mx-auto aspect-[9/16] w-60 overflow-hidden rounded-[2.2rem] border-[6px] border-ink-700 bg-ink-900 shadow-glow">
          <ScenePoster key={i} species={SPECIES[i]} seed={scene.position} className="animate-[fadein_.5s_ease]" />
          <div className="absolute inset-x-0 top-0 flex gap-1 p-3">
            {FRUIT_DRAMA_SCENES.map((s, n) => <span key={s.position} className={cn('h-0.5 flex-1 rounded-full', n <= i ? 'bg-white' : 'bg-white/25')} />)}
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-12">
            <p className="text-[10px] uppercase tracking-widest text-white/60">Scene {scene.position} · {scene.title}</p>
            <p className="mt-1 text-sm font-semibold leading-snug text-white">{scene.dialogue ?? scene.narration}</p>
          </div>
          <button onClick={() => setPlaying((p) => !p)} className="touch-hit absolute right-3 top-6 grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70" aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="ml-0.5 h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </section>
  );
}
