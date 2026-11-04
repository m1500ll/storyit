import { ArrowRight, Play } from 'lucide-react';
import { useState } from 'react';
import { RESULT_HIGHLIGHTS } from '@/data/results';
import { SHOWCASE, type ShowcaseVideo } from '@/data/showcase';
import { Button } from '../ui';
import { VideoCard } from './VideoCard';
import { VideoLightbox } from './VideoLightbox';
import { StartLink } from './StartLink';

const FAN = [
  { tilt: -6, y: 18 }, { tilt: -3, y: 4 }, { tilt: 0, y: -6 }, { tilt: 3, y: 4 }, { tilt: 6, y: 18 },
];
const OUTPUTS = ['Several TikTok & Instagram accounts', 'One video library', 'Calendar & rotation', 'A caption per account', 'Prompt Studio for Fruit Drama'];

export function Hero() {
  const [open, setOpen] = useState<ShowcaseVideo | null>(null);
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden="true" className="bg-grid mask-fade-radial pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-violet-600/20 blur-[120px]" />
      <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-20 text-center md:px-6 md:pt-28">
        <p className="label mx-auto inline-flex items-center gap-2 rounded-full border border-line/10 px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-coral-400" /> For TikTok and Instagram Reels
        </p>
        <h1 className="mx-auto mt-6 max-w-4xl font-display text-5xl leading-[1.05] text-zinc-50 md:text-7xl">
          Upload once. Post on every account.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base text-zinc-400 md:text-lg">
          Storyit sends each video to all your TikTok and Instagram accounts on a schedule, writes a caption for each account, and never posts the same video twice to the same account. Your browser can stay closed.
        </p>
        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <StartLink to="/app/library"><Button size="lg">Start free <ArrowRight className="h-4 w-4" /></Button></StartLink>
          <a href="#how"><Button size="lg" variant="secondary"><Play className="h-4 w-4" /> See how it works</Button></a>
        </div>
        <p className="mt-4 text-xs text-zinc-400">Free plan with <strong className="text-zinc-200">30 credits</strong> to try the Prompt Studio. No card required.</p>
        <a href="#results" className="group mx-auto mt-6 flex max-w-fit flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-5 py-3 transition hover:border-emerald-500/40">
          {RESULT_HIGHLIGHTS.slice(0, 2).map((h) => (
            <span key={h.label} className="text-sm text-zinc-300"><strong className="font-display text-xl tabular-nums text-zinc-50">{h.value}</strong> {h.label}</span>
          ))}
          <span className="text-xs text-emerald-300 group-hover:underline">on our own TikTok accounts →</span>
        </a>

        <div className="mx-auto mt-14 flex max-w-4xl items-start justify-center gap-2 sm:gap-4">
          {SHOWCASE.slice(0, 5).map((v, i) => (
            <div key={v.slug} className={i === 0 || i === 4 ? 'hidden w-1/5 max-w-[170px] sm:block' : 'w-1/3 max-w-[170px] sm:w-1/5'}
              style={{ transform: `translateY(${FAN[i]!.y}px) rotate(${FAN[i]!.tilt}deg)` }}>
              <VideoCard video={v} compact onOpen={() => setOpen(v)} />
            </div>
          ))}
        </div>
        <ul className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-2">
          {OUTPUTS.map((o) => <li key={o} className="rounded-full border border-line/10 bg-line/[0.02] px-3 py-1 text-xs text-zinc-400">{o}</li>)}
        </ul>
      </div>
      <VideoLightbox video={open} onClose={() => setOpen(null)} />
    </section>
  );
}
