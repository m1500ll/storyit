import { useEffect, useState } from 'react';
import { posterSrc, previewSrc, SHOWCASE_FRUIT, type ShowcaseVideo } from '@/data/showcase';

// 4 columns (2 on each side of the headline) of Creative Studio videos (the Animated Studio is paused): the 6 videos
// twice, shifted so a column never shows the same video twice in a row
const POOL = [...SHOWCASE_FRUIT, ...SHOWCASE_FRUIT.slice(3), ...SHOWCASE_FRUIT.slice(0, 3)];
const COLS: { list: ShowcaseVideo[]; side: string; speed: number; offset: string }[] = [
  { list: POOL.slice(0, 3), side: 'left-[2%]', speed: 60, offset: '-mt-24' },
  { list: POOL.slice(3, 6), side: 'left-[13%]', speed: 75, offset: '-mt-64' },
  { list: POOL.slice(6, 9), side: 'right-[13%]', speed: 70, offset: '-mt-48' },
  { list: POOL.slice(9, 12), side: 'right-[2%]', speed: 58, offset: '-mt-8' },
];

/** Hero background: slowly scrolling columns of real Storyit videos under the grid, faded so the text stays readable.
 *  Desktop only (bandwidth); still posters when the visitor prefers reduced motion. */
export function HeroBackdrop() {
  const [show, setShow] = useState(false);
  const [still, setStill] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(min-width: 1024px)');
    setShow(m.matches); setStill(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const f = () => setShow(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  if (!show) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.35] [mask-image:linear-gradient(to_bottom,black,black_55%,transparent_85%)]">
      {COLS.map((c, i) => (
        <div key={i} className={`absolute top-0 w-[150px] ${c.side} ${c.offset}`} style={{ transform: `rotate(${i < 2 ? -4 : 4}deg)` }}>
          <div className="flex flex-col gap-4" style={still ? undefined : { animation: `marquee-up ${c.speed}s linear infinite`, animationDirection: i % 2 ? 'reverse' : 'normal' }}>
            {[...c.list, ...c.list].map((v, k) => (
              <div key={`${v.slug}-${k}`} className="relative aspect-[9/16] overflow-hidden rounded-2xl border border-line/10">
                {still
                  ? <img src={posterSrc(v.slug)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                  : <video src={previewSrc(v.slug)} poster={posterSrc(v.slug)} muted loop playsInline autoPlay preload="metadata" className="absolute inset-0 h-full w-full object-cover" />}
              </div>
            ))}
          </div>
        </div>
      ))}
      {/* keeps the middle (headline and buttons) clean */}
      <div className="absolute inset-y-0 left-1/2 w-[62%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgb(var(--ink-950))_45%,transparent_75%)]" />
    </div>
  );
}
