import { ArrowRight, Volume2 } from 'lucide-react';
import { useState } from 'react';
import { VideoCard } from '@/components/landing/VideoCard';
import { VideoLightbox } from '@/components/landing/VideoLightbox';
import { Flag } from '@/components/ui/Flag';
import type { ShowcaseVideo } from '@/data/showcase';

const PAIR: ShowcaseVideo[] = [
  { slug: 'fenetres-murees', title: 'Les fenêtres murées de 1696', hook: 'L’original, en français', format: 'Original · FR', seconds: 61 },
  { slug: 'fenetres-murees-en', title: 'The bricked-up windows of 1696', hook: 'Traduite par Storyit', format: 'Translated · EN', seconds: 61 },
];

/** Translation page: the same video before / after, playing side by side; a tap opens it with sound. */
export function BeforeAfter() {
  const [open, setOpen] = useState<ShowcaseVideo | null>(null);
  return (
    <section aria-label="Exemple de traduction" className="mb-6 overflow-hidden rounded-3xl border border-violet-500/25 bg-gradient-to-br from-violet-600/15 via-ink-900 to-coral-500/10 p-5 sm:p-6">
      <div className="grid items-center gap-6 md:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <p className="text-xs font-medium text-violet-300">Exemple réel</p>
          <h2 className="mt-1 font-display text-3xl leading-tight text-zinc-50">La même vidéo, une nouvelle langue</h2>
          <p className="mt-2 max-w-md text-sm text-zinc-400">Le montage, la musique et les bruitages restent identiques. Seules la voix et les sous-titres changent.</p>
          <ul className="mt-4 grid max-w-md grid-cols-3 gap-2 text-center text-[11px] text-zinc-300">
            {[['Voix séparée', '1'], ['Phrases traduites au même tempo', '2'], ['Nouvelle voix + sous-titres', '3']].map(([t, n]) => (
              <li key={n} className="rounded-xl border border-line/10 bg-line/[0.03] px-2 py-2.5">
                <span className="mx-auto mb-1 grid h-6 w-6 place-items-center rounded-full bg-violet-500/20 text-xs font-semibold text-violet-200">{n}</span>{t}
              </li>
            ))}
          </ul>
          <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-zinc-500"><Volume2 className="h-3.5 w-3.5" aria-hidden /> Touchez une vidéo pour l’écouter avec le son.</p>
        </div>
        <div className="flex items-center justify-center gap-3">
          {PAIR.map((v, i) => (
            <div key={v.slug} className="flex items-center gap-3">
              {i === 1 && <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-600 text-white shadow-glow motion-safe:animate-pulse"><ArrowRight className="h-4 w-4" /></span>}
              <div className="w-[120px] sm:w-[140px]">
                <VideoCard video={v} compact onOpen={() => setOpen(v)} />
                <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-medium text-zinc-200"><Flag code={i ? 'en' : 'fr'} /> {i ? 'Anglais' : 'Français'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <VideoLightbox video={open} onClose={() => setOpen(null)} />
    </section>
  );
}
