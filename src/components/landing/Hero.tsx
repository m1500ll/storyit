import { ArrowRight, BarChart3, Clapperboard, Play, Zap } from 'lucide-react';
import { useState } from 'react';
import { RESULT_HIGHLIGHTS } from '@/data/results';
import { SHOWCASE_FRUIT, type ShowcaseVideo } from '@/data/showcase';

// the fan shows Creative Studio videos (Fruit Dramas and stories); the Animated Studio is paused
const FAN_VIDEOS = [SHOWCASE_FRUIT[3], SHOWCASE_FRUIT[1], SHOWCASE_FRUIT[0], SHOWCASE_FRUIT[2], SHOWCASE_FRUIT[4]].filter(Boolean) as ShowcaseVideo[];
import { PLANS, videosFor } from '@/services/credits';
import { num, useLang } from '@/lib/lang';
import { Button } from '../ui';
import { VideoCard } from './VideoCard';
import { VideoLightbox } from './VideoLightbox';
import { StartLink } from './StartLink';
import { PromoVideo } from './PromoVideo';

/** Neon-city art direction: 3 promises under the film (original illustrations, no game brand). */
const PROMISES = {
  fr: [[Clapperboard, 'Clippe tes parties', 'de jeux vidéo'], [Zap, 'Gagne de l’argent', 'sur TikTok & YouTube'], [BarChart3, 'Automatise ton', 'business de contenu']],
  en: [[Clapperboard, 'Clip your best', 'gaming moments'], [Zap, 'Earn money', 'on TikTok and YouTube'], [BarChart3, 'Automate your', 'content business']],
} as const;

const FAN = [
  { tilt: -6, y: 18 }, { tilt: -3, y: 4 }, { tilt: 0, y: -6 }, { tilt: 3, y: 4 }, { tilt: 6, y: 18 },
];
const OUTPUTS = { en: ['Pixar-style 3D characters', 'Dialogue with real voices', 'Fruits, nails, objects or gemstones', 'Sound effects & editing', '30 s, 45 s or 1 min', 'Ready for TikTok, Reels & Shorts'],
  fr: ['Personnages 3D style Pixar', 'Dialogues avec de vraies voix', 'Fruits, ongles, objets ou pierres', 'Bruitages et montage', '30 s, 45 s ou 1 min', 'Prêtes pour TikTok, Reels et Shorts'] };

export function Hero() {
  const [open, setOpen] = useState<ShowcaseVideo | null>(null);
  const lang = useLang(); const fr = lang === 'fr';
  return (
    <section className="relative overflow-hidden">
      {/* Desktop, French: the owner's neon-city artwork as is (public/landing/city/hero-scene.webp), with the real
          trial link, promo film and promises placed exactly over their drawn spots (coordinates in % of the artwork). */}
      {fr && (
        <div className="relative hidden w-full lg:block" style={{ aspectRatio: '1672 / 941' }}>
          <img src="/landing/city/hero-scene.webp" alt="" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[3%] bg-gradient-to-b from-transparent to-[rgb(var(--ink-950))]" />
          <h1 className="sr-only">Crée des vidéos IA virales qui rapportent.</h1>
          <div className="absolute" style={{ left: '41.4%', top: '30.6%', width: '17.8%', height: '4.6%' }}>
            <StartLink to="/app/billing?interval=month" className="block h-full w-full rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400">
              <span className="sr-only">Essai : 3 jours pour 1 $, 7 000 crédits</span>
            </StartLink>
          </div>
          <PromoVideo className="absolute text-left" poster="/landing/city/promo-poster.webp" autoPlay={false} neon
            frameClassName="h-full rounded-[1.6vw]" videoClassName="h-full w-full object-cover"
            style={{ left: '26.7%', top: '38.35%', width: '47.95%', height: '42.4%' }} />
          <ul className="absolute grid grid-cols-3 items-center divide-x divide-white/10 rounded-[1.4vw] border border-violet-400/30 bg-[#1a0d33]"
            style={{ left: '30.3%', top: '85.7%', width: '41.9%', height: '9.1%' }}>
            {PROMISES.fr.map(([Icon, a, b]) => (
              <li key={a} className="flex items-center justify-center gap-[0.8vw] px-[0.8vw]">
                <Icon className="h-[2.1vw] w-[2.1vw] shrink-0 text-fuchsia-400" aria-hidden />
                <span className="text-[0.95vw] leading-tight text-white"><span className="block">{a}</span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* Phones, tablets and English: same artwork as a backdrop, real text stacked */}
      <div className={fr ? 'lg:hidden' : ''}>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[760px]">
          <img src="/landing/city/hero-side.webp" alt="" className="absolute inset-0 h-full w-full object-cover object-top opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#1a0b2e]/50 via-[#1a0b2e]/40 to-[rgb(var(--ink-950))]" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 pt-28 text-center md:px-6 md:pt-36">
          <h1 className="mx-auto max-w-4xl text-balance font-hero text-5xl font-extrabold italic leading-[1.02] tracking-[-0.03em] text-white [text-shadow:0_4px_24px_rgba(0,0,0,0.5)] md:text-7xl">
            {fr ? <>Crée des <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">vidéos IA</span> virales qui rapportent.</>
              : <>Create viral <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">AI videos</span> that earn money.</>}
          </h1>
          <StartLink to="/app/billing?interval=month" className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#1b0f33]/85 px-2 py-1.5 pr-4 text-sm font-semibold text-white backdrop-blur transition hover:bg-[#2a0f3d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400">
            <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[11px] font-bold text-white">⚡ {fr ? 'Essai' : 'Trial'}</span>{fr ? '3 jours pour 1 $ · 7 000 crédits' : '3 days for $1 · 7,000 credits'} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </StartLink>
          <PromoVideo className="relative mx-auto mt-6 max-w-3xl text-left" poster="/landing/city/promo-poster.webp" autoPlay={false} neon
            frameClassName="border-2 border-violet-400/70 shadow-[0_0_40px_-6px_rgba(168,85,247,0.8)]" videoClassName="aspect-[2/1] w-full object-cover" />
          <ul className="mx-auto mt-4 grid max-w-2xl grid-cols-1 gap-3 rounded-2xl border border-violet-400/30 bg-[#1a0d33] p-4 text-left sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-white/10">
            {PROMISES[lang].map(([Icon, a, b]) => (
              <li key={a} className="flex items-center gap-3 sm:justify-center sm:px-3">
                <Icon className="h-7 w-7 shrink-0 text-fuchsia-400" aria-hidden />
                <span className="text-sm leading-tight text-white"><span className="block">{a}</span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="relative mx-auto max-w-6xl px-4 pb-12 text-center md:px-6">
        <p className="mx-auto mt-6 max-w-2xl text-base text-zinc-400 md:text-lg">
          {fr ? 'Avec le Creative Studio, écris une idée en une ligne : Storyit écrit l’histoire et les dialogues, dessine les personnages, anime chaque plan avec les voix et fait le montage. Un Fruit Drama ou une mini-série terminée, prête à publier.'
            : 'With the Creative Studio, write a one-line idea: Storyit writes the story and the dialogue, draws the characters, animates every shot with voices and edits the video. A finished Fruit Drama or mini-series, ready to post.'}
        </p>
        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <StartLink to="/app/prompts"><Button size="lg">{fr ? 'Ouvrir le Creative Studio' : 'Open the Creative Studio'} <ArrowRight className="h-4 w-4" /></Button></StartLink>
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
