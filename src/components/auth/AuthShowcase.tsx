import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { posterSrc, previewSrc, SHOWCASE, SHOWCASE_FRUIT, type ShowcaseVideo } from '@/data/showcase';

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const useMedia = (q: string) => {
  const [on, setOn] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const f = () => setOn(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, [q]);
  return on;
};

// 3D and Fruit Drama videos mixed, 4 per column
const MIX = SHOWCASE.slice(0, 6).flatMap((v, i) => [v, SHOWCASE_FRUIT[i]].filter(Boolean) as ShowcaseVideo[]);
const COLUMNS = [MIX.slice(0, 4), MIX.slice(4, 8), MIX.slice(8, 12)];

function Phone({ v, play }: { v: ShowcaseVideo; play: boolean }) {
  return (
    <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[22px] border border-white/40 bg-black/20 shadow-[0_24px_60px_-20px_rgba(40,10,80,0.55)]">
      {play
        ? <video src={previewSrc(v.slug)} poster={posterSrc(v.slug)} muted loop playsInline autoPlay preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
        : <img src={posterSrc(v.slug)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      <span className="absolute left-2 top-2 rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-semibold text-zinc-900 backdrop-blur">{v.format}</span>
      <p className="absolute inset-x-0 bottom-0 line-clamp-2 p-2.5 text-xs font-semibold leading-snug text-white">{v.title}</p>
    </div>
  );
}

/** Right side of the sign-in screen: columns of real Storyit videos scrolling slowly (decorative, desktop only). */
export function AuthShowcase() {
  const desktop = useMedia('(min-width: 1024px)');
  const still = reduced();
  if (!desktop) return null;
  return (
    <aside aria-hidden className="relative m-3 hidden overflow-hidden rounded-[28px] lg:block"
      style={{ background: 'linear-gradient(135deg, #a78bfa 0%, #c084fc 35%, #f0abfc 60%, #fdba74 100%)' }}>
      <div className="absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-white/30 blur-3xl" />
      <div className="absolute -right-16 bottom-10 h-72 w-72 rounded-full bg-coral-500/30 blur-3xl" />
      <div className="absolute inset-0 grid grid-cols-3 gap-4 px-8 [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_70%,transparent)]" style={{ transform: 'rotate(-6deg) scale(1.15)' }}>
        {COLUMNS.map((col, c) => (
          <div key={c} className={c === 1 ? '-mt-40' : c === 2 ? '-mt-16' : ''}>
            <div className="flex flex-col gap-4" style={still ? undefined : { animation: `marquee-up ${46 + c * 8}s linear infinite`, animationDirection: c === 1 ? 'reverse' : 'normal' }}>
              {[...col, ...col].map((v, i) => <Phone key={`${v.slug}-${i}`} v={v} play={!still} />)}
            </div>
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 p-10">
        <div className="max-w-md rounded-3xl border border-white/50 bg-white/70 p-6 shadow-xl backdrop-blur-xl">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-2.5 py-1 text-[11px] font-semibold text-white"><Sparkles className="h-3.5 w-3.5" /> Made with Storyit</p>
          <p className="mt-3 font-display text-3xl leading-tight text-zinc-900">One idea in. A video people watch to the end.</p>
          <p className="mt-2 text-sm text-zinc-900/70">3D animated stories, Fruit Dramas and translated videos, ready for TikTok, Reels and Shorts.</p>
        </div>
      </div>
    </aside>
  );
}

/** Mobile: three floating video covers above the form. */
export function AuthShowcaseStrip() {
  const pick = [SHOWCASE[0], SHOWCASE_FRUIT[0], SHOWCASE[3]].filter(Boolean) as ShowcaseVideo[];
  return (
    <div aria-hidden className="mb-6 flex justify-center gap-3 lg:hidden">
      {pick.map((v, i) => (
        <div key={v.slug} className="w-[22%] max-w-[84px]" style={reduced() ? undefined : { animation: `float-soft ${4 + i}s ease-in-out infinite`, animationDelay: `${i * 0.6}s` }}>
          <div className={`relative aspect-[9/16] overflow-hidden rounded-2xl border border-white shadow-lg ${i === 1 ? '-translate-y-2' : 'translate-y-2'}`}>
            <img src={posterSrc(v.slug)} alt="" className="absolute inset-0 h-full w-full object-cover" />
          </div>
        </div>
      ))}
    </div>
  );
}
