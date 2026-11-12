import { ChevronDown, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, PageHeader } from '@/components/ui';
import { formatCredits, PROMPT_PROJECT_COST } from '@/services/credits';

const FAQ_FR = [
  { q: 'Comment créer une vidéo de fruits (Fruit Drama) ?', a: `Ouvrez le Prompt Studio, choisissez un style (fruits, ongles, objets ou pierres précieuses) et écrivez votre histoire en quelques lignes, ou demandez 3 histoires au studio. Il écrit le hook, le script minuté et tous les prompts. Cliquez ensuite sur « Générer la vidéo » : les images, l’animation et le montage sont faits pour vous. Un projet coûte ${formatCredits(PROMPT_PROJECT_COST)} crédits, la vidéo se paie selon la qualité et la durée.` },
  { q: 'Comment créer une vidéo animée en 3D ?', a: 'Dans l’Animated Studio, choisissez un thème, puis cliquez sur les propositions : une histoire vraie, un décor et une voix. Storyit écrit le script, anime le monde 3D, enregistre le narrateur et ajoute le titre, les sous-titres et la musique. 3 500 crédits pour 30 s, 6 000 pour 1 min, 12 000 pour 2 min, remboursés si le rendu échoue.' },
  { q: 'Mes crédits sont-ils remboursés si ça échoue ?', a: 'Oui. Si une vidéo, une traduction ou une génération échoue, les crédits sont rendus automatiquement sur votre solde.' },
  { q: 'Les vidéos IA peuvent-elles être monétisées sur TikTok ?', a: 'Le programme créateurs de TikTok rémunère les vidéos originales de plus d’une minute, sur des comptes éligibles, et le contenu IA doit être signalé à la publication. Les vidéos du Prompt Studio dépassent la minute, mais les revenus dépendent de votre compte et des règles de TikTok : personne ne peut les garantir.' },
  { q: 'Storyit publie-t-il sur TikTok et Instagram pour moi ?', a: 'La publication directe est en pause le temps que les plateformes la valident. Téléchargez vos vidéos depuis la bibliothèque et publiez-les vous-même en quelques secondes.' },
  { q: 'Les vidéos m’appartiennent-elles ?', a: 'Oui. Vous gardez tous les droits sur vos histoires et vos vidéos, et vous pouvez les publier où vous voulez.' },
  { q: 'Comment résilier ?', a: 'Depuis « Offre et crédits », puis « Gérer la facturation ». Vous gardez l’accès jusqu’à la fin de la période payée.' },
];

export default function HelpPage() {
  return (
    <>
      <PageHeader eyebrow="Compte" title="Aide" description="Les réponses aux questions fréquentes, et comment nous joindre." />
      <div className="grid gap-4 md:grid-cols-3">
        <Card><p className="text-sm font-semibold text-zinc-100">Bien démarrer</p><p className="mt-1 text-sm text-zinc-400">Écrivez une histoire dans le Prompt Studio et cliquez sur « Générer la vidéo », ou créez une histoire vraie en 3D dans l’Animated Studio.</p><Link to="/app/prompts" className="touch-hit mt-3 inline-block text-xs text-violet-300">Ouvrir le Prompt Studio →</Link></Card>
        <Card><p className="text-sm font-semibold text-zinc-100">Grandir et monétiser</p><p className="mt-1 text-sm text-zinc-400">Les règles des plateformes et ce qui marche pour les séries d’histoires.</p><Link to="/app/guide" className="touch-hit mt-3 inline-block text-xs text-violet-300">Guide du créateur →</Link></Card>
        <Card><p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100"><Mail className="h-4 w-4" /> Contact</p><p className="mt-1 text-sm text-zinc-400">Une question, un bug, un remboursement ? Écrivez-nous.</p><a href="mailto:support@storyit.fun" className="touch-hit mt-3 inline-block text-xs text-violet-300">support@storyit.fun →</a></Card>
      </div>
      <h2 className="mb-3 mt-10 text-sm font-semibold text-zinc-100">Questions fréquentes</h2>
      <div className="divide-y divide-line/[0.06] rounded-2xl border border-line/[0.06] bg-ink-900">
        {FAQ_FR.map(({ q, a }) => (
          <details key={q} className="group px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-zinc-100">{q}<ChevronDown className="h-4 w-4 shrink-0 text-zinc-500 transition group-open:rotate-180" /></summary>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">{a}</p>
          </details>
        ))}
      </div>
    </>
  );
}
