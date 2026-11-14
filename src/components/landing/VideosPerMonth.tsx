import { Clapperboard } from 'lucide-react';
import { CREATIVE_VIDEO_LENGTHS, PLANS, videosFor } from '@/services/credits';
import { StartLink } from './StartLink';
import { num, useLang } from '@/lib/lang';

/** The headline number: how many Creative Studio videos each plan makes every month (30-second videos, project included). */
export function VideosPerMonth() {
  const lang = useLang(); const fr = lang === 'fr';
  const plans = PLANS.filter((p) => p.price > 0);
  const [short, mid, long] = CREATIVE_VIDEO_LENGTHS as [typeof CREATIVE_VIDEO_LENGTHS[number], typeof CREATIVE_VIDEO_LENGTHS[number], typeof CREATIVE_VIDEO_LENGTHS[number]];
  return (
    <section aria-labelledby="vpm-title" className="mx-auto max-w-6xl px-4 py-16 md:px-6">
      <div className="surface relative overflow-hidden px-6 py-12 text-center md:px-12">
        <div aria-hidden="true" className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[700px] -translate-x-1/2 rounded-full bg-violet-600/20 blur-[100px]" />
        <p className="label relative inline-flex items-center gap-2"><Clapperboard className="h-4 w-4 text-violet-300" aria-hidden /> {fr ? 'Tes vidéos du mois' : 'Your monthly videos'}</p>
        <h2 id="vpm-title" className="relative mt-3 font-display text-4xl text-zinc-50 md:text-5xl">{fr ? 'Jusqu’à' : 'Up to'} {videosFor(Math.max(...plans.map((p) => p.credits)))} {fr ? 'vidéos IA par mois' : 'AI videos a month'}</h2>
        <p className="relative mx-auto mt-3 max-w-xl text-sm text-zinc-400">
          {fr ? `Chaque offre donne des crédits tous les mois. Une vidéo terminée du Creative Studio (histoire comprise) coûte ${num(short.credits, lang)} crédits en 30 s, ${num(mid.credits, lang)} en 45 s et ${num(long.credits, lang)} en 1 min. Les chiffres ci-dessous comptent le maximum : des vidéos de 30 s.` : `Every plan comes with credits each month. A finished Creative Studio video (story included) costs ${num(short.credits, lang)} credits for 30 s, ${num(mid.credits, lang)} for 45 s and ${num(long.credits, lang)} for 1 min. The figures below count the maximum: 30-second videos.`}
        </p>
        <ul className="relative mt-10 grid gap-4 sm:grid-cols-3">
          {plans.map((p) => (
            <li key={p.id} className={'rounded-2xl border px-4 py-6 ' + ('featured' in p && p.featured ? 'border-violet-500/50 bg-violet-500/10' : 'border-line/10 bg-line/[0.02]')}>
              <p className="text-sm font-semibold text-zinc-100">{p.name} · {fr ? `${p.price} $/mois` : `$${p.price}/mo`}</p>
              <p className="mt-2 font-display text-6xl tabular-nums text-zinc-50 md:text-7xl">{videosFor(p.credits)}</p>
              <p className="text-sm text-violet-300">{fr ? 'vidéos par mois (max.)' : 'videos a month (max.)'}</p>
              <p className="mt-1 text-[11px] text-zinc-500">{num(p.credits, lang)} {fr ? 'crédits · vidéos de 30 s' : 'credits · 30-second videos'}</p>
            </li>
          ))}
        </ul>
        <StartLink to="/app/prompts" className="relative mt-8 inline-block">
          <span className="inline-flex h-11 items-center rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">{fr ? 'Créer ma première vidéo' : 'Create my first video'}</span>
        </StartLink>
      </div>
    </section>
  );
}
