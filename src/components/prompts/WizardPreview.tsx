import { Music, SlidersHorizontal } from 'lucide-react';
import { universeScene } from '@/components/characters/UniverseGrid';
import { cn } from '@/lib/cn';
import { UNIVERSES, type Universe } from '@shared/characters.ts';
import type { SubtitleStyle, VideoLength } from '@shared/promptVideo.ts';
import { lengthLabel } from '@shared/promptVideo.ts';

const LINE = ['Tu', 'm’as', 'menti', 'depuis', 'le', 'début'];

/** the subtitle as it will be burned in, animated on the preview (karaoke: each word lights up in turn) */
function LiveSubtitle({ style }: { style: SubtitleStyle }) {
  if (style === 'none') return null;
  const shadow = '[text-shadow:0_2px_0_#000,0_-2px_0_#000,2px_0_0_#000,-2px_0_0_#000,0_4px_12px_rgba(0,0,0,.6)]';
  return (
    <p className={cn('px-3 text-center font-display text-[17px] font-extrabold leading-tight text-white', shadow, style === 'italique' && 'italic')}>
      {LINE.map((w, i) => (
        <span key={i} className="mr-1 inline-block" style={style === 'karaoke' ? { animation: `karaoke 3s ${i * 0.38}s infinite` } : undefined}>
          {style === 'italique' ? w : w.toUpperCase()}
        </span>
      ))}
    </p>
  );
}

/** The video being put together: the universe's scene drifting, the cast, the length, subtitles and music. */
export function WizardPreview({ universe, cast, length, subtitles, music, story, className, mini }: {
  universe: Universe; cast: { id: string; name: string; image: string | null }[]; length: VideoLength;
  subtitles: SubtitleStyle; music: string | null; story: string; className?: string; mini?: boolean;
}) {
  return (
    <figure className={cn('relative aspect-[9/16] w-full overflow-hidden rounded-[1.75rem] border-[5px] border-zinc-900 bg-zinc-900 shadow-2xl shadow-violet-900/30', className)}
      aria-label={`Aperçu : univers ${UNIVERSES[universe].label}, ${lengthLabel(length)}`}>
      {universe === 'perso' ? (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-violet-900 via-zinc-900 to-coral-900/60"><SlidersHorizontal className="h-10 w-10 text-violet-300/70" aria-hidden /></div>
      ) : (
        <div key={universe} className="anim-fadein absolute inset-0">
          <img src={universeScene(universe)} alt="" className="anim-kenburns h-full w-full object-cover motion-reduce:animate-none" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70" />

      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <span key={length} className="anim-popin rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-white backdrop-blur">{lengthLabel(length)}</span>
        {!mini && cast.length > 0 && (
          <span className="flex -space-x-2">
            {cast.slice(0, 5).map((c) => (
              <span key={c.id} className="anim-popin h-8 w-8 overflow-hidden rounded-full border-2 border-white/80 bg-zinc-800" title={c.name}>
                {c.image && <img src={c.image} alt="" className="h-full w-full object-cover object-[12%_0%] [transform:scale(2.2)] [transform-origin:12%_0%]" />}
              </span>
            ))}
          </span>
        )}
      </div>

      {!mini && <figcaption className="absolute inset-x-0 bottom-0 space-y-3 p-3 pb-4">
        {story.trim() && <p className="line-clamp-2 px-1 text-center text-[11px] text-white/80">{story.trim()}</p>}
        <LiveSubtitle style={subtitles} />
        <div className="flex items-center justify-center">
          {music ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] text-white backdrop-blur">
              <Music className="h-3 w-3" aria-hidden />
              <span className="flex h-3 items-end gap-[2px]" aria-hidden>
                {[0, 1, 2, 3].map((i) => <span key={i} className="anim-eq h-3 w-[3px] rounded-full bg-coral-400" style={{ animationDelay: `${i * 0.15}s` }} />)}
              </span>
              Musique
            </span>
          ) : <span className="rounded-full bg-black/40 px-2.5 py-1 text-[11px] text-white/70">Sans musique</span>}
        </div>
      </figcaption>}
    </figure>
  );
}
