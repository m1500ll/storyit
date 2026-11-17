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
  fr: [[Clapperboard, 'Clippe tes parties', 'de jeux vidéo'], [Zap, 'Gagne de l’argent', 'sur TikTok et YouTube'], [BarChart3, 'Automatise ton', 'business de contenu']],
  en: [[Clapperboard, 'Clip your best', 'gaming moments'], [Zap, 'Earn money', 'on TikTok and YouTube'], [BarChart3, 'Automate your', 'content business']],
} as const;
/** Chunky poster headline: white letters, thick black outline, drop shadow. */
const POSTER = 'font-poster [-webkit-text-stroke:5px_#000] [paint-order:stroke_fill] [filter:drop-shadow(0_5px_0_rgba(0,0,0,0.85))]';

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
      {/* neon-city sunset: original illustrations (public/landing/city), faded into the page below */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[980px] md:h-[1060px]">
        <img src="/landing/city/backdrop.webp" alt="" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a0b2e]/70 via-[#2a0f3d]/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-b from-transparent to-[rgb(var(--ink-950))]" />
        <img src="/landing/city/hero-man.webp" alt="" className="absolute bottom-[110px] left-[-2%] hidden h-[62%] max-h-[640px] object-contain xl:block" />
        <img src="/landing/city/hero-car.webp" alt="" className="absolute bottom-[100px] right-[-3%] hidden w-[26%] max-w-[420px] object-contain xl:block" />
        <p className="absolute right-[2%] top-[34%] hidden -rotate-6 font-poster text-4xl 2xl:text-5xl text-pink-200 [text-shadow:0_0_6px_#fff,0_0_18px_#ff3ec8,0_0_42px_#ff3ec8,0_0_80px_#c026d3] xl:block">Storyit City</p>
      </div>
      <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-28 text-center md:px-6 md:pt-36">
        <h1 className={`mx-auto max-w-5xl text-balance text-5xl leading-[1.05] text-white sm:text-6xl md:text-7xl ${POSTER}`}>
          {fr ? <>Crée des <span className="bg-gradient-to-r from-fuchsia-400 via-pink-400 to-violet-400 bg-clip-text text-transparent">vidéos IA</span> virales qui <span className="relative inline-block">rapportent.<svg aria-hidden viewBox="0 0 300 30" className="absolute -bottom-7 left-[-2%] -z-10 w-[104%] [filter:none]" preserveAspectRatio="none"><path d="M6 22 C 80 6, 180 4, 294 12" stroke="#ff2fb3" strokeWidth="7" fill="none" strokeLinecap="round" /><path d="M40 28 C 120 16, 200 14, 270 20" stroke="#ff2fb3" strokeWidth="4" fill="none" strokeLinecap="round" opacity=".8" /></svg></span></>
            : <>Create viral <span className="bg-gradient-to-r from-fuchsia-400 via-pink-400 to-violet-400 bg-clip-text text-transparent">AI videos</span> that earn money.</>}
        </h1>
        <div>
        <StartLink to="/app/billing?interval=month" className="mt-8 inline-flex items-center gap-2 rounded-full border border-fuchsia-400/40 bg-[#1a0b2e]/80 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_30px_-8px_rgba(217,70,239,0.8)] backdrop-blur transition hover:bg-[#2a0f3d]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400">
          <span className="rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-2 py-0.5 text-[11px] font-bold text-white">{fr ? 'ESSAI' : 'TRIAL'}</span>{fr ? '3 jours pour 1 $ · 7 000 crédits' : '3 days for $1 · 7,000 credits'} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </StartLink>
        </div>
        <PromoVideo className="relative mx-auto mt-8 max-w-3xl text-left" poster="/landing/city/promo-poster.webp" autoPlay={false}
          frameClassName="border-2 border-fuchsia-400/70 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_0_50px_-6px_rgba(217,70,239,0.75)]" />
        <ul className="relative mx-auto mt-6 grid max-w-2xl grid-cols-1 gap-3 rounded-2xl border border-fuchsia-400/25 bg-[#140a24]/85 p-4 text-left shadow-[0_0_40px_-12px_rgba(217,70,239,0.6)] backdrop-blur sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-white/10 sm:p-5">
          {PROMISES[lang].map(([Icon, a, b]) => (
            <li key={a} className="flex items-center gap-3 sm:justify-center sm:px-4">
              <Icon className="h-7 w-7 shrink-0 text-fuchsia-400" aria-hidden />
              <span className="text-sm leading-tight text-white"><span className="block font-semibold">{a}</span><span className="text-white/75">{b}</span></span>
            </li>
          ))}
        </ul>
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
