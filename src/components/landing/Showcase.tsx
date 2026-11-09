import { useState } from 'react';
import { SHOWCASE, type ShowcaseVideo } from '@/data/showcase';
import { VideoCard } from './VideoCard';
import { VideoLightbox } from './VideoLightbox';

export function Showcase() {
  const [open, setOpen] = useState<ShowcaseVideo | null>(null);
  return (
    <section id="examples" className="mx-auto max-w-6xl px-4 py-20 md:px-6">
      <p className="label text-center">Made with the Animated Studio</p>
      <h2 className="mt-3 text-center font-display text-4xl text-zinc-50 md:text-5xl">3D animated stories, ready to post</h2>
      <p className="mx-auto mt-3 max-w-xl text-center text-sm text-zinc-400">
        One-minute 3D animated shorts of true stories, with a narrator, music and captions: a strong hook, a twist, and viewers who watch to the end. Tap a video to watch it with sound.
      </p>
      <div className="mx-auto mt-12 grid max-w-3xl grid-cols-3 gap-3 md:gap-6">
        {SHOWCASE.map((v) => <VideoCard key={v.slug} video={v} onOpen={() => setOpen(v)} />)}
      </div>
      <p className="mt-6 text-center text-xs text-zinc-600">Videos made by the Storyit team with the same Animated Studio you get: choose a story, a decor and a voice.</p>
      <VideoLightbox video={open} onClose={() => setOpen(null)} />
    </section>
  );
}
