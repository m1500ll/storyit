import { useState } from 'react';
import { VideoCard } from '@/components/landing/VideoCard';
import { VideoLightbox } from '@/components/landing/VideoLightbox';
import { SHOWCASE, type ShowcaseVideo } from '@/data/showcase';

/** Animated Studio: a row of real finished videos (what the customer gets), playing silently; a tap opens one with sound. */
export function StudioReel() {
  const [open, setOpen] = useState<ShowcaseVideo | null>(null);
  return (
    <section aria-label="Vidéos réalisées avec l’Animated Studio" className="mb-6">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-100">Ce que le studio produit</h2>
        <span className="text-xs text-zinc-500">Touchez une vidéo pour l’écouter</span>
      </div>
      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {SHOWCASE.slice(0, 8).map((v) => (
          <li key={v.slug} className="w-[118px] shrink-0 snap-start sm:w-[132px]">
            <VideoCard video={v} compact onOpen={() => setOpen(v)} />
            <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-zinc-400">{v.title}</p>
          </li>
        ))}
      </ul>
      <VideoLightbox video={open} onClose={() => setOpen(null)} />
    </section>
  );
}
