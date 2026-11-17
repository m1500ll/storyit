import { ArrowRight, Captions, Scissors, Sparkles, Type, UploadCloud, type LucideIcon } from 'lucide-react';
import { ClipVisual } from '@/components/clips/ClipPromo';
import { useLang } from '@/lib/lang';
import { CREDIT_COSTS } from '@/services/credits';
import { StartLink } from './StartLink';

/** AI clipping, featured right under the hero: one long video becomes vertical clips with titles and captions. */
export function ClipFeature() {
  const fr = useLang() === 'fr';
  const steps: [LucideIcon, string, string][] = fr
    ? [[UploadCloud, 'Ajoute ta vidéo', 'Podcast, interview, live ou vlog, jusqu’à 30 minutes.'],
       [Scissors, 'L’IA trouve les pépites', 'Jusqu’à 8 moments forts, classés par potentiel viral.'],
       [Type, 'Titre façon TikTok', 'Un titre accrocheur en bandeau, contour ou néon.'],
       [Captions, 'Sous-titres animés', 'Calés mot à mot sur la voix, taille et position réglables.']]
    : [[UploadCloud, 'Add your video', 'Podcast, interview, stream or vlog, up to 30 minutes.'],
       [Scissors, 'The AI finds the gems', 'Up to 8 best moments, ranked by viral potential.'],
       [Type, 'TikTok-style title', 'A catchy title as a band, outline or neon.'],
       [Captions, 'Animated captions', 'Timed word by word on the voice, size and position adjustable.']];
  return (
    <section id="clips" aria-labelledby="clips-title" className="relative mx-auto max-w-6xl scroll-mt-24 px-4 py-16 md:px-6 md:py-20">
      <div className="relative overflow-hidden rounded-3xl border border-fuchsia-400/25 bg-gradient-to-br from-violet-600/[0.14] via-ink-900/80 to-coral-500/[0.08] p-6 shadow-[0_0_80px_-30px_rgba(217,70,239,0.6)] md:p-10">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_1.15fr]">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-400/40 bg-fuchsia-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-fuchsia-200">
              <Sparkles className="h-3 w-3" aria-hidden /> {fr ? 'Nouveau · Clips IA' : 'New · AI clips'}
            </p>
            <h2 id="clips-title" className="mt-4 text-balance font-display text-4xl leading-[1.05] text-zinc-50 md:text-6xl">
              {fr ? <>Une longue vidéo,{' '}<span className="bg-gradient-to-r from-violet-300 to-fuchsia-400 bg-clip-text text-transparent">jusqu’à 8 clips prêts à poster</span></>
                : <>One long video,{' '}<span className="bg-gradient-to-r from-violet-300 to-fuchsia-400 bg-clip-text text-transparent">up to 8 clips ready to post</span></>}
            </h2>
            <p className="mt-4 max-w-lg text-base text-zinc-300">
              {fr ? 'Fini les heures de montage. L’IA écoute ta vidéo, repère les meilleurs passages et les transforme en clips verticaux 9:16 pour TikTok, Reels et Shorts.'
                : 'No more hours of editing. The AI listens to your video, spots the best parts and turns them into vertical 9:16 clips for TikTok, Reels and Shorts.'}
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {steps.map(([Icon, t, d]) => (
                <li key={t} className="flex gap-3 rounded-xl border border-white/[0.06] bg-ink-950/40 p-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white"><Icon className="h-4 w-4" aria-hidden /></span>
                  <span className="min-w-0"><span className="block text-sm font-semibold text-zinc-100">{t}</span><span className="block text-xs text-zinc-400">{d}</span></span>
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2">
              <StartLink to="/app/clips/new">
                <span className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 text-sm font-semibold text-white shadow-[0_0_30px_-6px_rgba(217,70,239,0.8)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
                  {fr ? 'Découper ma vidéo' : 'Clip my video'} <ArrowRight className="h-4 w-4" aria-hidden />
                </span>
              </StartLink>
              <span className="text-xs text-zinc-400 tabular-nums">
                {fr ? `Dans tous les abonnements · ${CREDIT_COSTS.clipMinute} crédits par minute de vidéo · essai à 1 $ : 1 vidéo`
                  : `In every plan · ${CREDIT_COSTS.clipMinute} credits per minute of video · $1 trial: 1 video`}
              </span>
            </div>
          </div>
          <ClipVisual fr={fr} />
        </div>
      </div>
    </section>
  );
}
