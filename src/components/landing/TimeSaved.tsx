import { Check, X } from 'lucide-react';
import { useLang } from '@/lib/lang';

const ROWS = [
  ['Find a story that hooks', 'Hours scrolling for ideas', 'Trending concepts and 3 story options'],
  ['Write the script', 'A blank page, dialogue that drags', 'A timed script of more than one minute'],
  ['Create the characters and scenes', 'Learn 3D software or prompt for days', 'Drawn and kept consistent for you'],
  ['Animate and add voices', 'Clip by clip, voice by voice', 'Every clip animated with voices and sound'],
  ['Edit the final video', 'Cut silences and sync by hand', 'Edited automatically, ready to post'],
  ['Post in another language', 'Re-record everything', 'Translated with a new voice in one click'],
];
const ROWS_FR = [
  ['Trouver une histoire qui accroche', 'Des heures à scroller pour trouver une idée', 'Concepts tendance et 3 histoires au choix'],
  ['Écrire le script', 'Une page blanche, des dialogues qui traînent', 'Un script minuté de plus d’une minute'],
  ['Créer les personnages et les scènes', 'Apprendre la 3D ou écrire des prompts pendant des jours', 'Dessinés et gardés identiques pour toi'],
  ['Animer et ajouter les voix', 'Plan par plan, voix par voix', 'Chaque plan animé avec voix et son'],
  ['Monter la vidéo', 'Couper les blancs et synchroniser à la main', 'Montée automatiquement, prête à publier'],
  ['Publier dans une autre langue', 'Tout réenregistrer', 'Traduite avec une nouvelle voix en un clic'],
];

export function TimeSaved() {
  const fr = useLang() === 'fr';
  const rows = fr ? ROWS_FR : ROWS;
  return (
    <section id="time" className="mx-auto max-w-6xl px-4 py-20 md:px-6">
      <p className="label text-center">{fr ? 'Temps gagné' : 'Time saved'}</p>
      <h2 className="mt-3 text-center font-display text-4xl text-zinc-50 md:text-5xl">{fr ? 'Des jours de travail, faits en quelques minutes' : 'Days of work, done in minutes'}</h2>
      <p className="mx-auto mt-3 max-w-xl text-center text-sm text-zinc-400">{fr ? 'Publier une bonne vidéo chaque jour, c’est ce qui fait grandir un compte. Les faire à la main, c’est ce qui fait abandonner les créateurs. Storyit fait le gros du travail.' : 'Posting a strong video every day is what grows an account. Making each one by hand is what makes creators quit. Storyit does the heavy lifting.'}</p>
      <ul className="mt-10 space-y-3 md:hidden">
        {rows.map(([step, before, after]) => (
          <li key={step} className="surface p-4">
            <p className="text-sm font-medium text-zinc-100">{step}</p>
            <p className="mt-2 flex items-start gap-2 text-xs text-zinc-500"><X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-coral-400/70" />{before}</p>
            <p className="mt-1.5 flex items-start gap-2 text-sm text-zinc-200"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-300" />{after}</p>
          </li>
        ))}
      </ul>
      <div className="surface mt-12 hidden overflow-x-auto p-0 md:block">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-line/[0.06]">
              <th className="label px-5 py-4 font-medium">{fr ? 'Étape' : 'Step'}</th>
              <th className="label px-5 py-4 font-medium">{fr ? 'À la main' : 'By hand'}</th>
              <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-300">{fr ? 'Avec Storyit' : 'With Storyit'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/[0.05]">
            {rows.map(([step, before, after]) => (
              <tr key={step}>
                <td className="px-5 py-3.5 font-medium text-zinc-200">{step}</td>
                <td className="px-5 py-3.5 text-zinc-500"><span className="flex items-start gap-2"><X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-coral-400/70" />{before}</span></td>
                <td className="bg-violet-500/[0.04] px-5 py-3.5 text-zinc-200"><span className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-300" />{after}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
