import { useState } from 'react';
import { SHOWCASE, type ShowcaseVideo } from '@/data/showcase';
import { VideoCard } from './VideoCard';
import { VideoLightbox } from './VideoLightbox';

export function Showcase() {
  const [open, setOpen] = useState<ShowcaseVideo | null>(null);
  return (
    <section id="examples" className="mx-auto max-w-6xl px-4 py-20 md:px-6">
      <p className="label text-center">Watch real episodes</p>
      <h2 className="mt-3 text-center font-display text-4xl text-zinc-50 md:text-5xl">This is what your feed could look like</h2>
      <p className="mx-auto mt-3 max-w-xl text-center text-sm text-zinc-400">
        60 to 100-second AI stories with a hook, a twist and a cliffhanger — the format that keeps viewers watching to the end and qualifies for creator monetisation programs. Tap any episode to watch it with sound.
      </p>
      <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-5 lg:grid-cols-6">
        {SHOWCASE.map((v) => <VideoCard key={v.slug} video={v} onOpen={() => setOpen(v)} />)}
      </div>
      <p className="mt-6 text-center text-xs text-zinc-600">Episodes produced by the Storyit team using the same script → storyboard → prompt workflow.</p>
      <VideoLightbox video={open} onClose={() => setOpen(null)} />
    </section>
  );
}
