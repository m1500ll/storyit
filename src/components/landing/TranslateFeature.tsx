import { ArrowRight, Languages } from 'lucide-react';
import { useState } from 'react';
import type { ShowcaseVideo } from '@/data/showcase';
import { DUB_CREDITS_PER_MIN, formatCredits } from '@/services/credits';
import { StartLink } from './StartLink';
import { VideoCard } from './VideoCard';
import { VideoLightbox } from './VideoLightbox';
import { useLang } from '@/lib/lang';

const PAIR: ShowcaseVideo[] = [
  { slug: 'fenetres-murees', title: 'Les fenêtres murées de 1696', hook: 'The original, in French', hookFr: 'L’original, en français', format: 'Original · FR', seconds: 61 },
  { slug: 'fenetres-murees-en', title: 'The bricked-up windows of 1696', hook: 'Translated by Storyit', hookFr: 'Traduite par Storyit', format: 'Translated · EN', seconds: 61 },
];

/** New feature: translate any vertical video (new voice, original music kept, captions replaced). */
export function TranslateFeature() {
  const fr = useLang() === 'fr';
  const [open, setOpen] = useState<ShowcaseVideo | null>(null);
  return (
    <section id="translate" aria-labelledby="tr-title" className="mx-auto max-w-6xl px-4 py-16 md:px-6">
      <div className="grid items-center gap-10 md:grid-cols-[1fr_auto]">
        <div>
          <p className="label inline-flex items-center gap-2"><Languages className="h-4 w-4 text-violet-300" aria-hidden /> {fr ? 'Nouveau · Traduction vidéo' : 'New · Video translation'}</p>
          <h2 id="tr-title" className="mt-3 font-display text-4xl text-zinc-50 md:text-5xl">{fr ? 'Une vidéo, toutes les langues' : 'One video, every language'}</h2>
          <p className="mt-3 max-w-md text-sm text-zinc-400">
            {fr ? 'Envoie une vidéo verticale. Storyit sépare la voix de la musique, traduit chaque phrase pour qu’elle tienne au même moment, enregistre une nouvelle voix et remplace les sous-titres incrustés. Le montage, la musique et les bruitages restent identiques.'
              : 'Upload a vertical video. Storyit separates the voice from the music, translates every sentence so it fits the same timing, records a new narrator voice and replaces the burned-in captions. The edit, the music and the sound effects stay exactly the same.'}
          </p>
          <ul className="mt-5 space-y-1.5 text-sm text-zinc-300">
            <li>{fr ? 'Français, anglais et espagnol' : 'French, English and Spanish'}</li>
            <li>{fr ? 'Musique et bruitages d’origine gardés' : 'Original music and effects kept'}</li>
            <li>{fr ? 'Sous-titres traduits mot à mot' : 'Captions translated word by word'}</li>
            <li>{fr ? '3 500 crédits par minute de vidéo' : `${formatCredits(DUB_CREDITS_PER_MIN)} credits per minute of video`}</li>
          </ul>
          <StartLink to="/app/translate" className="mt-6 inline-block">
            <span className="inline-flex h-11 items-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
              {fr ? 'Traduire une vidéo' : 'Translate a video'} <ArrowRight className="h-4 w-4" aria-hidden />
            </span>
          </StartLink>
        </div>
        <div className="mx-auto flex items-center gap-3">
          {PAIR.map((v, i) => (
            <div key={v.slug} className="w-36 sm:w-44" style={{ transform: `rotate(${i ? 3 : -3}deg)` }}>
              <VideoCard video={v} compact onOpen={() => setOpen(v)} />
            </div>
          ))}
        </div>
      </div>
      <VideoLightbox video={open} onClose={() => setOpen(null)} />
    </section>
  );
}
