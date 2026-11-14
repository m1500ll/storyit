import { useState } from 'react';
import { SHOWCASE_FRUIT, type ShowcaseVideo } from '@/data/showcase';
import { VideoCard } from './VideoCard';
import { VideoLightbox } from './VideoLightbox';
import { useLang } from '@/lib/lang';

export function Showcase() {
  const [open, setOpen] = useState<ShowcaseVideo | null>(null);
  const fr = useLang() === 'fr';
  return (
    <section id="examples" className="mx-auto max-w-6xl px-4 py-20 md:px-6">
      <p className="label text-center">{fr ? 'Créé avec Storyit' : 'Made with Storyit'}</p>
      <h2 className="mt-3 text-center font-display text-4xl text-zinc-50 md:text-5xl">{fr ? 'Des vidéos prêtes à publier' : 'Videos ready to post'}</h2>
      <p className="mx-auto mt-3 max-w-xl text-center text-sm text-zinc-400">
        {fr ? 'Fruit Dramas et mini-séries du Creative Studio : un hook fort, un rebondissement, et des spectateurs qui regardent jusqu’au bout. Touche une vidéo pour la regarder avec le son.' : 'Fruit Dramas and mini-series from the Creative Studio: a strong hook, a twist, and viewers who watch to the end. Tap a video to watch it with sound.'}
      </p>

      <h3 className="mt-12 text-lg font-semibold text-zinc-100">{fr ? 'Fruit Dramas et histoires' : 'Fruit Dramas & stories'} <span className="text-sm font-normal text-zinc-500">· Creative Studio</span></h3>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-5 lg:grid-cols-6">
        {SHOWCASE_FRUIT.map((v) => <VideoCard key={v.slug} video={v} onOpen={() => setOpen(v)} />)}
      </div>

      <p className="mt-6 text-center text-xs text-zinc-600">{fr ? 'Vidéos créées par des clients Storyit et notre équipe.' : 'Videos made by Storyit customers and our team.'}</p>
      <VideoLightbox video={open} onClose={() => setOpen(null)} />
    </section>
  );
}
