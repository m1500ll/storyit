import { Play } from 'lucide-react';

const frames = ['🍓', '🍋', '🥝', '🍌'];

/** Placeholder phone-frame demo. Replace the inner block with a <video> once a demo render exists. */
export function DemoVideo() {
  return (
    <section id="demo" className="mx-auto max-w-6xl px-4 py-16 md:px-6">
      <div className="surface grid items-center gap-10 p-6 md:grid-cols-[1fr_auto] md:p-12">
        <div>
          <p className="label">Live demo</p>
          <h2 className="mt-3 font-display text-4xl text-zinc-50">“Zest & Jealousy”, Episode 1</h2>
          <p className="mt-3 max-w-md text-sm text-zinc-400">From a one-line prompt to a 60-second, 15-scene Fruit Drama in under ten minutes. Same strawberry, same lemon, every shot.</p>
          <div className="mt-6 flex gap-2">
            {frames.map((f, i) => (
              <div key={i} className="grid h-16 w-10 place-items-center rounded-lg border border-white/10 bg-ink-800 text-lg">{f}</div>
            ))}
          </div>
        </div>
        <div className="relative mx-auto aspect-[9/16] w-56 overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-b from-ink-800 to-ink-950 shadow-glow">
          <div className="absolute inset-0 grid place-items-center text-7xl">🍓</div>
          <button className="absolute inset-0 grid place-items-center bg-black/30 transition hover:bg-black/10" aria-label="Play demo">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-white/90 text-ink-950"><Play className="ml-1 h-5 w-5" /></span>
          </button>
          <p className="absolute bottom-4 left-4 right-4 text-center text-xs font-medium text-white drop-shadow">“Jealousy isn't your color, babe.”</p>
        </div>
      </div>
    </section>
  );
}
