import { ArrowRight, Clapperboard, Download, Palette, Scissors } from 'lucide-react';
import { useState } from 'react';
import type { ShowcaseVideo } from '@/data/showcase';
import { StartLink } from './StartLink';
import { VideoCard } from './VideoCard';
import { VideoLightbox } from './VideoLightbox';
import { useLang } from '@/lib/lang';

const EXAMPLE: ShowcaseVideo = { slug: 'treize-gemmes', title: 'Les Treize Gemmes', hook: 'Made automatically: ChatGPT images, Grok animation, automatic edit', hookFr: 'Créée automatiquement : images ChatGPT, animation Grok, montage auto', format: 'Story', seconds: 26 };
const STEPS = [
  { icon: Palette, title: 'ChatGPT draws your characters', body: 'A character sheet first, then every scene from it: the same faces and outfits in every shot.' },
  { icon: Clapperboard, title: 'Grok animates every shot', body: 'Dialogue, voices, sound effects and camera moves, clip by clip, from the studio’s prompts.' },
  { icon: Scissors, title: 'The edit is done for you', body: 'Clips butted together, silences cut, a fast pace from the first second to the cliffhanger.' },
  { icon: Download, title: 'Ready in your library', body: 'A finished vertical video to download and post on TikTok, Reels and Shorts.' },
];
const STEPS_FR = [
  { icon: Palette, title: 'ChatGPT dessine tes personnages', body: 'D’abord une planche de personnages, puis chaque scène à partir d’elle : les mêmes visages et tenues dans chaque plan.' },
  { icon: Clapperboard, title: 'Grok anime chaque plan', body: 'Dialogues, voix, bruitages et mouvements de caméra, plan par plan, à partir des prompts du studio.' },
  { icon: Scissors, title: 'Le montage est fait pour toi', body: 'Les plans bout à bout, les blancs coupés, un rythme rapide de la première seconde au cliffhanger.' },
  { icon: Download, title: 'Prête dans ta bibliothèque', body: 'Une vidéo verticale terminée, à télécharger et publier sur TikTok, Reels et Shorts.' },
];

/** New: the Creative Studio makes the finished video (images, animation, editing). */
export function AutoVideoFeature() {
  const [open, setOpen] = useState<ShowcaseVideo | null>(null);
  const fr = useLang() === 'fr';
  return (
    <section id="auto" aria-labelledby="auto-title" className="mx-auto max-w-6xl px-4 py-16 md:px-6">
      <div className="grid items-center gap-10 md:grid-cols-[auto_1fr]">
        <div className="order-2 mx-auto w-48 sm:w-56 md:order-1" style={{ transform: 'rotate(-3deg)' }}>
          <VideoCard video={EXAMPLE} onOpen={() => setOpen(EXAMPLE)} />
          <p className="mt-3 text-center text-xs text-zinc-500">{fr ? 'Créée 100 % automatiquement' : 'Made 100% automatically'}</p>
        </div>
        <div className="order-1 md:order-2">
          <p className="label inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-coral-400" /> {fr ? 'Nouveau · Vidéos IA automatiques' : 'New · Automatic AI videos'}</p>
          <h2 id="auto-title" className="mt-3 font-display text-4xl text-zinc-50 md:text-5xl">{fr ? 'Ton histoire en entrée, une vidéo finie en sortie' : 'Your story in, a finished video out'}</h2>
          <p className="mt-3 max-w-xl text-sm text-zinc-400">{fr ? 'Écris quelques lignes ou prends une idée tendance. Le Creative Studio écrit le script, puis crée toute la vidéo pour toi : aucun prompt à copier, aucun logiciel de montage.' : 'Write a few lines or pick a trending idea. The Creative Studio writes the script, then makes the whole video for you: no prompts to copy, no editing software.'}</p>
          <ol className="mt-6 grid gap-3 sm:grid-cols-2">
            {(fr ? STEPS_FR : STEPS).map(({ icon: Icon, title, body }) => (
              <li key={title} className="surface flex gap-3 p-4">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" aria-hidden />
                <span><span className="block text-sm font-semibold text-zinc-100">{title}</span><span className="mt-1 block text-xs leading-relaxed text-zinc-400">{body}</span></span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-zinc-500">{fr ? 'À partir de 4 500 crédits la vidéo de 30 s. Le prix s’affiche avant de lancer, et tes crédits sont rendus si la génération échoue.' : 'From 4,500 credits for a 30-second video. The price shows before you start, and your credits come back if the generation fails.'}</p>
          <StartLink to="/app/prompts" className="mt-6 inline-block">
            <span className="inline-flex h-11 items-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
              {fr ? 'Créer ma vidéo' : 'Create my video'} <ArrowRight className="h-4 w-4" aria-hidden />
            </span>
          </StartLink>
        </div>
      </div>
      <VideoLightbox video={open} onClose={() => setOpen(null)} />
    </section>
  );
}
