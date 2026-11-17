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
        // The whole artwork always fits the screen (never cropped, never taller than the window); wider screens get a
        // the generated extension of the artwork on the sides. Overlays and text sizes use the artwork's own box (container units).
        <div className="relative hidden w-full overflow-hidden lg:block" style={{ height: 'min(100svh, calc(100vw * 941 / 1672))' }}>
          {/* the artwork extended on both sides (generated edges): fills screens up to 21:9 without blur or seams */}
          <img src="/landing/city/hero-wide.webp" alt="" {...{ fetchpriority: "high" }} width={4948} height={1882}
            className="absolute left-1/2 top-0 h-full w-auto max-w-none -translate-x-1/2" />
          <div className="absolute left-1/2 top-0 h-full -translate-x-1/2" style={{ aspectRatio: '1672 / 941', containerType: 'size' }}>
            {/* vector headline (traced once from the owner's poster lettering) and brush stroke: sharp at every size */}
            <h1 className="absolute m-0" style={{ left: '25.9%', top: '13.6%', width: '50.68%' }}>
              <img src="/landing/city/headline-fr.svg" alt="Crée des vidéos IA virales qui rapportent." width={892} height={177} className="block h-auto w-full" />
            </h1>
            <svg aria-hidden viewBox="0 0 1672 941" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
              <defs><linearGradient id="swoosh" x1="905" x2="1322" y1="0" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#ff3fb4" /><stop offset="1" stopColor="#ff5ad0" /></linearGradient></defs>
              <path d="M905.0 300.6 L912.9 301.5 L920.7 301.9 L928.6 302.0 L936.4 302.1 L944.2 302.1 L952.0 302.1 L959.8 302.0 L967.5 301.9 L975.3 301.7 L983.1 301.5 L990.8 301.2 L998.6 300.9 L1006.3 300.6 L1014.1 300.2 L1021.8 299.8 L1029.5 299.4 L1037.2 298.9 L1044.9 298.4 L1052.6 297.9 L1060.3 297.3 L1068.0 296.7 L1075.6 296.1 L1083.3 295.4 L1090.9 294.7 L1098.5 293.9 L1106.2 293.2 L1113.8 292.4 L1121.4 291.5 L1129.0 290.7 L1136.5 289.8 L1144.1 288.8 L1151.7 287.8 L1159.2 286.8 L1166.8 285.8 L1174.3 284.7 L1181.8 283.6 L1189.3 282.5 L1196.8 281.3 L1204.3 280.1 L1211.8 278.9 L1219.2 277.6 L1226.7 276.3 L1234.1 274.9 L1241.5 273.5 L1249.0 272.1 L1256.4 270.7 L1263.7 269.2 L1271.1 267.6 L1278.5 266.1 L1285.8 264.4 L1293.1 262.7 L1300.5 261.0 L1307.7 259.2 L1315.0 257.2 L1322.1 254.6 L1321.9 253.4 L1314.3 253.6 L1306.8 254.3 L1299.4 255.1 L1292.0 256.0 L1284.5 256.9 L1277.1 257.8 L1269.6 258.7 L1262.2 259.7 L1254.7 260.6 L1247.3 261.5 L1239.8 262.5 L1232.3 263.4 L1224.9 264.3 L1217.4 265.2 L1209.9 266.1 L1202.4 267.0 L1195.0 267.9 L1187.5 268.8 L1180.0 269.7 L1172.4 270.6 L1164.9 271.5 L1157.4 272.4 L1149.9 273.2 L1142.4 274.1 L1134.8 274.9 L1127.3 275.8 L1119.7 276.6 L1112.1 277.5 L1104.6 278.3 L1097.0 279.1 L1089.4 279.9 L1081.8 280.7 L1074.2 281.5 L1066.6 282.3 L1059.0 283.1 L1051.4 283.9 L1043.8 284.7 L1036.1 285.5 L1028.5 286.2 L1020.8 287.0 L1013.2 287.7 L1005.5 288.5 L997.8 289.3 L990.1 290.0 L982.4 290.7 L974.7 291.5 L967.0 292.2 L959.3 293.0 L951.5 293.7 L943.8 294.5 L936.0 295.3 L928.3 296.1 L920.5 296.9 L912.7 297.9 L905.0 299.4Z M1317.9 258.4 L1313.9 258.6 L1309.9 259.0 L1305.8 259.5 L1301.8 260.0 L1297.7 260.6 L1293.6 261.1 L1289.4 261.7 L1285.3 262.3 L1281.1 262.9 L1276.9 263.5 L1272.7 264.1 L1268.4 264.8 L1264.1 265.4 L1259.8 266.1 L1255.5 266.7 L1251.1 267.4 L1246.7 268.1 L1242.3 268.8 L1237.8 269.5 L1233.3 270.2 L1228.8 270.9 L1224.3 271.6 L1219.8 272.4 L1215.2 273.1 L1210.6 273.9 L1205.9 274.6 L1201.3 275.4 L1196.6 276.2 L1191.9 277.0 L1187.1 277.8 L1182.3 278.6 L1177.5 279.4 L1172.7 280.2 L1167.9 281.1 L1163.0 281.9 L1158.1 282.8 L1153.2 283.6 L1148.2 284.5 L1143.2 285.4 L1138.2 286.3 L1133.2 287.2 L1128.1 288.1 L1123.0 289.0 L1117.9 289.9 L1112.7 290.9 L1107.6 291.8 L1102.4 292.8 L1097.1 293.8 L1091.9 294.7 L1086.6 295.7 L1081.3 296.8 L1076.0 297.8 L1070.6 298.9 L1065.3 300.0 L1059.9 301.4 L1060.1 302.6 L1065.6 302.2 L1071.1 301.6 L1076.5 301.0 L1081.9 300.3 L1087.2 299.6 L1092.6 298.9 L1097.9 298.2 L1103.1 297.5 L1108.4 296.7 L1113.6 296.0 L1118.8 295.3 L1123.9 294.5 L1129.0 293.8 L1134.1 293.0 L1139.2 292.3 L1144.2 291.5 L1149.2 290.8 L1154.2 290.0 L1159.2 289.3 L1164.1 288.5 L1169.0 287.7 L1173.8 287.0 L1178.7 286.2 L1183.5 285.4 L1188.3 284.7 L1193.0 283.9 L1197.7 283.1 L1202.4 282.3 L1207.1 281.5 L1211.7 280.7 L1216.3 280.0 L1220.9 279.2 L1225.4 278.4 L1230.0 277.6 L1234.5 276.8 L1238.9 276.0 L1243.4 275.2 L1247.8 274.4 L1252.1 273.6 L1256.5 272.7 L1260.8 271.9 L1265.1 271.1 L1269.3 270.3 L1273.6 269.5 L1277.8 268.6 L1282.0 267.8 L1286.1 267.0 L1290.2 266.1 L1294.3 265.3 L1298.4 264.4 L1302.4 263.6 L1306.4 262.7 L1310.3 261.8 L1314.3 260.8 L1318.1 259.6Z" fill="url(#swoosh)" style={{ filter: 'drop-shadow(0 0 4px rgba(255,63,180,0.55))' }} />
            </svg>
            <div className="absolute" style={{ left: '40.6%', top: '30.7%', width: '19.4%', height: '4.4%' }}>
              <StartLink to="/app/billing?interval=month" className="flex h-full w-full items-center gap-[0.5cqw] rounded-full border border-white/15 bg-[#1b0f33]/90 py-[0.25cqw] justify-between pl-[0.3cqw] pr-[0.7cqw] text-[0.84cqw] font-semibold text-white shadow-[0_0_1.6cqw_-0.4cqw_rgba(168,85,247,0.9)] backdrop-blur transition hover:bg-[#2a1450] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400">
                <span className="flex h-full items-center gap-[0.2cqw] rounded-full bg-gradient-to-r from-violet-600 to-violet-500 px-[0.6cqw]"><Zap className="h-[0.9cqw] w-[0.9cqw]" aria-hidden fill="currentColor" />Essai</span>
                <span className="whitespace-nowrap">3 jours pour 1 $ · 7 000 crédits</span><ArrowRight className="h-[0.9cqw] w-[0.9cqw]" aria-hidden />
              </StartLink>
            </div>
            {/* the frame is 2:1 and the film 16:9: the whole film is shown (thin dark bands), never cut */}
            <PromoVideo className="absolute text-left" poster="/landing/city/promo-poster.webp" autoPlay={false} neon
              frameClassName="h-full rounded-[1.4cqw] bg-[#0b0614]" videoClassName="h-full w-full object-contain"
              style={{ left: '26.75%', top: '38.4%', width: '47.9%', height: '42.35%' }} />
            <ul className="absolute grid grid-cols-3 items-center divide-x divide-white/10 rounded-[1.3cqw] border border-violet-400/30 bg-[#1a0d33] shadow-[0_0_2cqw_-0.6cqw_rgba(168,85,247,0.7)]"
              style={{ left: '29.9%', top: '85.4%', width: '42.7%', height: '9.7%' }}>
              {PROMISES.fr.map(([Icon, a, b]) => (
                <li key={a} className="flex h-full items-center justify-center gap-[0.8cqw] px-[0.6cqw]">
                  <Icon className="h-[1.9cqw] w-[1.9cqw] shrink-0 text-fuchsia-400" aria-hidden />
                  <span className="whitespace-nowrap text-[0.98cqw] leading-[1.25] text-white"><span className="block font-medium">{a}</span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {/* Phones, tablets and English: same artwork as a backdrop, real text stacked */}
      <div className={fr ? 'lg:hidden' : ''}>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[760px]">
          <img src="/landing/city/hero-side.webp" alt="" className="absolute inset-0 h-full w-full object-cover object-top opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#1a0b2e]/50 via-[#1a0b2e]/40 to-[rgb(var(--ink-950))]" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 pt-28 text-center md:px-6 md:pt-36">
          {fr ? (
            <h1 className="mx-auto max-w-xl">
              <img src="/landing/city/headline-fr.svg" alt="Crée des vidéos IA virales qui rapportent." width={892} height={177} className="h-auto w-full" />
            </h1>
          ) : (
            <h1 className="mx-auto max-w-4xl text-balance font-hero text-5xl font-extrabold italic leading-[1.02] tracking-[-0.03em] text-white [text-shadow:0_4px_24px_rgba(0,0,0,0.5)] md:text-7xl">
              Create viral <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">AI videos</span> that earn money.
            </h1>
          )}
          <StartLink to="/app/billing?interval=month" className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#1b0f33]/85 px-2 py-1.5 pr-4 text-sm font-semibold text-white backdrop-blur transition hover:bg-[#2a0f3d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400">
            <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[11px] font-bold text-white">⚡ {fr ? 'Essai' : 'Trial'}</span>{fr ? '3 jours pour 1 $ · 7 000 crédits' : '3 days for $1 · 7,000 credits'} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </StartLink>
          <PromoVideo className="relative mx-auto mt-6 max-w-3xl text-left" poster="/landing/city/promo-poster.webp" autoPlay={false} neon
            frameClassName="border-2 border-violet-400/70 shadow-[0_0_40px_-6px_rgba(168,85,247,0.8)]" videoClassName="aspect-video w-full object-cover" />
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
