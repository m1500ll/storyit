import { Clapperboard, Download, Lightbulb, Wand2 } from 'lucide-react';
import { useLang } from '@/lib/lang';

const steps = [
  { icon: Lightbulb, title: 'Pick a story', body: 'Write a few lines, choose one of the studio’s ideas, or start from today’s trending concepts. Pick a style: fruits, nails, objects or gemstones.' },
  { icon: Wand2, title: 'The AI writes it', body: 'A hook that stops the scroll, a timed script of more than one minute, the characters, every image prompt and every animation prompt.' },
  { icon: Clapperboard, title: 'The AI makes the video', body: 'Images are drawn, each clip is animated with voices and sound, and the video is edited for you: no editing software needed.' },
  { icon: Download, title: 'Post it and grow', body: 'Download the finished vertical video for TikTok, Reels and Shorts, with captions and the AI label ready. Translate it to reach new countries.' },
];
const stepsFr = [
  { icon: Lightbulb, title: 'Choisis une histoire', body: 'Écris quelques lignes, prends une idée du studio ou un concept tendance du jour. Choisis un style : fruits, ongles, objets ou pierres précieuses.' },
  { icon: Wand2, title: 'L’IA l’écrit', body: 'Un hook qui arrête le scroll, un script minuté de plus d’une minute, les personnages, chaque prompt d’image et d’animation.' },
  { icon: Clapperboard, title: 'L’IA crée la vidéo', body: 'Les images sont dessinées, chaque plan est animé avec les voix et le son, et la vidéo est montée pour toi : aucun logiciel de montage.' },
  { icon: Download, title: 'Publie et grandis', body: 'Télécharge la vidéo verticale pour TikTok, Reels et Shorts, avec sous-titres et label IA prêts. Traduis-la pour toucher d’autres pays.' },
];

export function HowItWorks() {
  const fr = useLang() === 'fr';
  return (
    <section id="how" className="mx-auto max-w-6xl px-4 py-20 md:px-6">
      <p className="label text-center">{fr ? 'Comment ça marche' : 'How it works'}</p>
      <h2 className="mt-3 text-center font-display text-4xl text-zinc-50">{fr ? 'D’une idée à une vidéo IA virale, en quatre étapes' : 'From an idea to a viral AI video, in four steps'}</h2>
      <ol className="mt-12 grid gap-4 md:grid-cols-4">
        {(fr ? stepsFr : steps).map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="surface relative p-6">
            <span aria-hidden="true" className="absolute right-5 top-4 font-display text-4xl text-line/[0.07]">{i + 1}</span>
            <Icon className="h-5 w-5 text-coral-400" aria-hidden="true" />
            <h3 className="mt-4 text-sm font-semibold text-zinc-100">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">{body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
