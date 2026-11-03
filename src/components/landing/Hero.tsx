import { ArrowRight, Play } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SHOWCASE, type ShowcaseVideo } from '@/data/showcase';
import { Button } from '../ui';
import { VideoCard } from './VideoCard';
import { VideoLightbox } from './VideoLightbox';

const FAN = [
  { tilt: -6, y: 18 }, { tilt: -3, y: 4 }, { tilt: 0, y: -6 }, { tilt: 3, y: 4 }, { tilt: 6, y: 18 },
];
const OUTPUTS = ['Story script', '15 timed scenes', 'Image & motion prompts', 'Consistent characters', 'Subtitles'];

export function Hero() {
  const [open, setOpen] = useState<ShowcaseVideo | null>(null);
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-violet-600/20 blur-[120px]" />
      <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-20 text-center md:px-6 md:pt-28">
        <p className="label mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-coral-400" /> For TikTok · YouTube Shorts · Reels
        </p>
        <h1 className="mx-auto mt-6 max-w-4xl font-display text-5xl leading-[1.05] text-zinc-50 md:text-7xl">
          Turn one idea into an <em className="bg-gradient-to-r from-violet-300 to-coral-300 bg-clip-text italic text-transparent">entire video series</em>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base text-zinc-400 md:text-lg">
          AI story episodes like the ones below — written, storyboarded and prompted in minutes instead of evenings. Post every day, grow faster, and qualify for creator monetisation.
        </p>
        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/login"><Button size="lg">Start free — 30 credits <ArrowRight className="h-4 w-4" /></Button></Link>
          <a href="#examples"><Button size="lg" variant="secondary"><Play className="h-4 w-4" /> Watch episodes</Button></a>
        </div>
        <p className="mt-4 text-xs text-zinc-500">No card required · Cancel anytime</p>

        <div className="mx-auto mt-14 flex max-w-4xl items-start justify-center gap-2 sm:gap-4">
          {SHOWCASE.slice(0, 5).map((v, i) => (
            <div key={v.slug} className={i === 0 || i === 4 ? 'hidden w-1/5 max-w-[170px] sm:block' : 'w-1/3 max-w-[170px] sm:w-1/5'}
              style={{ transform: `translateY(${FAN[i]!.y}px) rotate(${FAN[i]!.tilt}deg)` }}>
              <VideoCard video={v} compact onOpen={() => setOpen(v)} />
            </div>
          ))}
        </div>
        <ul className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-2">
          {OUTPUTS.map((o) => <li key={o} className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-xs text-zinc-400">{o}</li>)}
        </ul>
      </div>
      <VideoLightbox video={open} onClose={() => setOpen(null)} />
    </section>
  );
}
