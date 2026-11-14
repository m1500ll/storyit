import { Check, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/cn';
import { UNIVERSES, type Universe } from '@shared/characters.ts';

export const universeImage = (u: Universe) => `/characters/universes/${u}.webp`;

/** The universe tiles (a character on light grey for each), shared by the Personnages page and the video wizard. */
export function UniverseGrid({ value, onChange, label, cols = 'grid-cols-3 sm:grid-cols-5', hideCustom }: {
  value: Universe; onChange: (u: Universe) => void; label: string; cols?: string; hideCustom?: boolean;
}) {
  const list = (Object.keys(UNIVERSES) as Universe[]).filter((u) => !(hideCustom && u === 'perso'));
  return (
    <div role="radiogroup" aria-label={label} className={cn('grid gap-2', cols)}>
      {list.map((u) => {
        const on = value === u;
        return (
          <button key={u} type="button" role="radio" aria-checked={on} onClick={() => onChange(u)} title={UNIVERSES[u].hint}
            className={cn('group relative aspect-[3/4] overflow-hidden rounded-xl border text-left transition [touch-action:manipulation] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60',
              on ? 'border-violet-500 ring-2 ring-violet-500/50' : 'border-line/10 hover:border-violet-400/50')}>
            {u === 'perso' ? (
              <span className="absolute inset-0 grid place-items-center bg-line/[0.03]"><SlidersHorizontal className={cn('h-6 w-6', on ? 'text-violet-300' : 'text-zinc-500')} aria-hidden /></span>
            ) : (
              <img src={universeImage(u)} alt="" width={240} height={320} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04] motion-reduce:transition-none" />
            )}
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2 pb-2 pt-6">
              <span className="block text-[11px] font-semibold leading-tight text-white sm:text-xs">{UNIVERSES[u].label}</span>
            </span>
            {on && <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-violet-600 text-white"><Check className="h-3 w-3" aria-hidden /></span>}
          </button>
        );
      })}
    </div>
  );
}
