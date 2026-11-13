import { ArrowRight, Play } from 'lucide-react';
import { useState } from 'react';
import { RESULT_HIGHLIGHTS } from '@/data/results';
import { SHOWCASE, SHOWCASE_FRUIT, type ShowcaseVideo } from '@/data/showcase';

// the fan mixes 3D shorts and Fruit Dramas, a 3D short in the middle
const FAN_VIDEOS = [SHOWCASE[1], SHOWCASE_FRUIT[0], SHOWCASE[0], SHOWCASE_FRUIT[2], SHOWCASE[2]].filter(Boolean) as ShowcaseVideo[];
import { PLANS, videosFor } from '@/services/credits';
import { num, useLang } from '@/lib/lang';
import { Button } from '../ui';
import { VideoCard } from './VideoCard';
import { VideoLightbox } from './VideoLightbox';
import { StartLink } from './StartLink';
import { HeroBackdrop } from './HeroBackdrop';
import { PromoVideo } from './PromoVideo';

const FAN = [
  { tilt: -6, y: 18 }, { tilt: -3, y: 4 }, { tilt: 0, y: -6 }, { tilt: 3, y: 4 }, { tilt: 6, y: 18 },
];
const OUTPUTS = { en: ['3D worlds & cartoon characters', 'A narrator voice', 'Music & sound effects', 'Hook title & captions', '30 s, 1 min or 2 min', 'Ready for TikTok, Reels & Shorts'],
  fr: ['Mondes 3D et personnages cartoon', 'Une voix de narrateur', 'Musique et bruitages', 'Titre accrocheur et sous-titres', '30 s, 1 min ou 2 min', 'Prêtes pour TikTok, Reels et Shorts'] };

export function Hero() {
  const [open, setOpen] = useState<ShowcaseVideo | null>(null);
  const lang = useLang(); const fr = lang === 'fr';
  return (
    <section className="relative overflow-hidden">
      <HeroBackdrop />
      <div aria-hidden="true" className="bg-grid mask-fade-radial pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-violet-600/20 blur-[120px]" />
      <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-28 text-center md:px-6 md:pt-36">
        <h1 className="mx-auto max-w-4xl text-balance font-hero text-5xl font-extrabold leading-[1.02] tracking-[-0.035em] text-zinc-50 md:text-7xl">
          {fr ? <>Crée des <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-coral-400 bg-clip-text text-transparent">vidéos IA</span> virales qui rapportent.</>
            : <>Create viral <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-coral-400 bg-clip-text text-transparent">AI videos</span> that earn money.</>}
        </h1>
        <div>
        <StartLink to="/app/billing?interval=month" className="mt-6 inline-flex items-center gap-2 rounded-full border border-violet-500/40 bg-violet-600/15 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-violet-600/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
          <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[11px] font-bold text-white">{fr ? 'ESSAI' : 'TRIAL'}</span>{fr ? '3 jours pour 1 $ · 7 000 crédits' : '3 days for $1 · 7,000 credits'} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </StartLink>
        </div>
        <PromoVideo className="relative mx-auto mt-6 max-w-4xl text-left" />
        <p className="mx-auto mt-6 max-w-2xl text-base text-zinc-400 md:text-lg">
          {fr ? 'Choisis une histoire : Storyit écrit le script, crée les personnages, anime chaque scène, ajoute la voix, la musique, le titre accrocheur et les sous-titres. Une vidéo verticale terminée, prête à publier.'
            : 'Pick a story, a decor and a voice. Storyit writes the script, animates the 3D world and its characters, records the narrator and adds the hook title, captions and music. A finished vertical video, ready to post.'}
        </p>
        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <StartLink to="/app/studio"><Button size="lg">{fr ? 'Créer ma vidéo' : 'Create my 3D video'} <ArrowRight className="h-4 w-4" /></Button></StartLink>
          <a href="#examples"><Button size="lg" variant="secondary"><Play className="h-4 w-4" /> {fr ? 'Voir des exemples' : 'Watch examples'}</Button></a>
        </div>
        {fr ? <p className="mt-4 text-xs text-zinc-400"><strong className="text-zinc-200">Jusqu’à {videosFor(PLANS.find((p) => p.id === 'creator')!.credits)} vidéos par mois</strong> avec Creator, <s className="text-zinc-500">45 $</s> 29 $/mois. Sans engagement. Ou <StartLink to="/app" className="touch-hit text-violet-300 underline-offset-2 hover:underline">commence gratuitement avec {num(3000, lang)} crédits</StartLink>, sans carte.</p>
          : <p className="mt-4 text-xs text-zinc-400"><strong className="text-zinc-200">Up to {videosFor(PLANS.find((p) => p.id === 'creator')!.credits)} videos a month</strong> with Creator, <s className="text-zinc-500">$45</s> $29/mo. Cancel anytime. Or <StartLink to="/app" className="touch-hit text-violet-300 underline-offset-2 hover:underline">start free with 3,000 credits</StartLink>, no card.</p>}
        <a href="#results" className="group mx-auto mt-6 flex max-w-fit flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-5 py-3 transition hover:border-emerald-500/40">
          {RESULT_HIGHLIGHTS.slice(0, 2).map((h) => (
            <span key={h.label} className="text-sm text-zinc-300"><strong className="font-display text-xl tabular-nums text-zinc-50">{fr ? h.valueFr : h.value}</strong> {fr ? h.labelFr : h.label}</span>
          ))}
          <span className="text-xs text-emerald-300 group-hover:underline">{fr ? 'sur nos propres comptes TikTok →' : 'on our own TikTok accounts →'}</span>
        </a>

        <div className="mx-auto mt-14 flex max-w-4xl items-start justify-center gap-2 sm:gap-4">
          {FAN_VIDEOS.map((v, i) => (
            <div key={v.slug} className={i === 0 || i === 4 ? 'hidden w-1/5 max-w-[170px] sm:block' : 'w-1/3 max-w-[170px] sm:w-1/5'}
              style={{ transform: `translateY(${FAN[i]!.y}px) rotate(${FAN[i]!.tilt}deg)` }}>
              <VideoCard video={v} compact onOpen={() => setOpen(v)} />
            </div>
          ))}
        </div>
        <ul className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-2">
          {OUTPUTS[lang].map((o) => <li key={o} className="rounded-full border border-line/10 bg-line/[0.02] px-3 py-1 text-xs text-zinc-400">{o}</li>)}
        </ul>
      </div>
      <VideoLightbox video={open} onClose={() => setOpen(null)} />
    </section>
  );
}
