import { Captions, Clapperboard, Languages, Sparkles, TrendingUp, Wand2 } from 'lucide-react';
import { useLang } from '@/lib/lang';

const features = [
  { icon: Clapperboard, title: 'Creative Studio', body: 'One idea becomes a finished mini-series: story, dialogue, Pixar-style 3D characters, animated shots with voices, sound effects and editing. 30 s, 45 s or 1 min.' },
  { icon: Sparkles, title: 'Fruit Drama generator', body: 'Mini-dramas with fruit, nail, object or gemstone characters: the format that explodes on TikTok, written for retention and comments.' },
  { icon: Wand2, title: 'Fully automatic videos', body: 'ChatGPT draws the characters and scenes, Grok animates every clip, and the video is edited for you. Pick the quality and see the price first.' },
  { icon: TrendingUp, title: 'Trending ideas every day', body: 'Fresh concepts from what works right now on TikTok, with the hook, the outline and the ending, ready to turn into your video.' },
  { icon: Languages, title: 'AI video translation', body: 'The same video in French, English or Spanish: new voice, original music kept, captions replaced. Reach new countries with one click.' },
  { icon: Captions, title: 'Characters that stay the same', body: 'A character sheet is drawn first, so every shot keeps the same heads, outfits and faces from start to finish.' },
];
const featuresFr = [
  { icon: Clapperboard, title: 'Creative Studio', body: 'Une idée devient une mini-série terminée : histoire, dialogues, personnages 3D style Pixar, plans animés avec les voix, bruitages et montage. 30 s, 45 s ou 1 min.' },
  { icon: Sparkles, title: 'Générateur de Fruit Drama', body: 'Des mini-dramas avec des personnages fruits, ongles, objets ou pierres précieuses : le format qui explose sur TikTok, écrit pour la rétention et les commentaires.' },
  { icon: Wand2, title: 'Vidéos 100 % automatiques', body: 'ChatGPT dessine les personnages et les scènes, Grok anime chaque plan, et la vidéo est montée pour toi. Choisis la qualité et vois le prix avant.' },
  { icon: TrendingUp, title: 'Des idées tendance chaque jour', body: 'Des concepts tirés de ce qui marche en ce moment sur TikTok, avec le hook, le déroulé et la fin, prêts à devenir ta vidéo.' },
  { icon: Languages, title: 'Traduction vidéo par IA', body: 'La même vidéo en français, anglais ou espagnol : nouvelle voix, musique d’origine gardée, sous-titres remplacés. Touche d’autres pays en un clic.' },
  { icon: Captions, title: 'Des personnages qui restent identiques', body: 'Une planche des personnages est dessinée d’abord : chaque plan garde les mêmes têtes, tenues et visages du début à la fin.' },
];

export function FeatureGrid() {
  const fr = useLang() === 'fr';
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-20 md:px-6">
      <p className="label text-center">{fr ? 'Tout pour devenir viral' : 'Everything you need to go viral'}</p>
      <h2 className="mt-3 text-center font-display text-4xl text-zinc-50">{fr ? 'Un studio vidéo IA dans ton navigateur' : 'An AI video studio in your browser'}</h2>
      <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line/[0.06] bg-line/[0.06] sm:grid-cols-2 lg:grid-cols-3">
        {(fr ? featuresFr : features).map(({ icon: Icon, title, body }) => (
          <div key={title} className="bg-ink-900 p-6">
            <Icon className="h-5 w-5 text-violet-400" aria-hidden="true" />
            <h3 className="mt-4 text-sm font-semibold text-zinc-100">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
