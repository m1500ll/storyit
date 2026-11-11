import { useState } from 'react';
import { SHOWCASE, SHOWCASE_FRUIT, type ShowcaseVideo } from '@/data/showcase';
import { VideoCard } from './VideoCard';
import { VideoLightbox } from './VideoLightbox';

export function Showcase() {
  const [open, setOpen] = useState<ShowcaseVideo | null>(null);
  return (
    <section id="examples" className="mx-auto max-w-6xl px-4 py-20 md:px-6">
      <p className="label text-center">Made with Storyit</p>
      <h2 className="mt-3 text-center font-display text-4xl text-zinc-50 md:text-5xl">Videos ready to post</h2>
      <p className="mx-auto mt-3 max-w-xl text-center text-sm text-zinc-400">
        3D animated true stories and Fruit Dramas: a strong hook, a twist, and viewers who watch to the end. Tap a video to watch it with sound.
      </p>

      <h3 className="mt-12 text-lg font-semibold text-zinc-100">3D animated stories <span className="text-sm font-normal text-zinc-500">· Animated Studio</span></h3>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-5 lg:grid-cols-6">
        {SHOWCASE.map((v) => <VideoCard key={v.slug} video={v} onOpen={() => setOpen(v)} />)}
      </div>

      <h3 className="mt-14 text-lg font-semibold text-zinc-100">Fruit Dramas &amp; stories <span className="text-sm font-normal text-zinc-500">· Prompt Studio</span></h3>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-5 lg:grid-cols-6">
        {SHOWCASE_FRUIT.map((v) => <VideoCard key={v.slug} video={v} onOpen={() => setOpen(v)} />)}
      </div>

      <p className="mt-6 text-center text-xs text-zinc-600">Videos made by Storyit customers and our team.</p>
      <VideoLightbox video={open} onClose={() => setOpen(null)} />
    </section>
  );
}
