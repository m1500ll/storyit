import { ChevronDown } from 'lucide-react';
import { PROMPT_PROJECT_COST, formatCredits } from '@/services/credits';
import { useLang } from '@/lib/lang';

export const faqs = [
  { q: 'What is Storyit?', a: 'Storyit is an AI video generator for TikTok, Instagram Reels and YouTube Shorts. With the Creative Studio, a story idea becomes a finished vertical video (Fruit Dramas and mini-series with 3D characters and real voices), and you can translate your existing videos into other languages.' },
  { q: 'How do I make an AI fruit video (Fruit Drama)?', a: `Open the Creative Studio, pick a character style (fruits, nails, everyday objects or gemstones) and write your story in a few lines, or let the studio propose 3 stories. It writes the hook, a timed script of more than one minute, every image prompt and every animation prompt. Then click "Generate the video": the images are drawn, each clip is animated and the final video is edited for you. A full project costs ${formatCredits(PROMPT_PROJECT_COST)} credits; the finished video is priced by quality and length.` },
  { q: 'Can AI videos be monetized on TikTok?', a: 'TikTok’s Creator Rewards Program pays for original videos longer than one minute from eligible accounts, and AI-generated content must be labeled as such when you post. Storyit makes videos of more than one minute built for retention, but earnings depend on your account, your audience and TikTok’s rules: nobody can guarantee them.' },
  { q: 'Which AI models does Storyit use?', a: 'The studios use leading models for each step: ChatGPT for the character and scene images, Grok Imagine for the animation, Claude for the scripts and ElevenLabs for the voices. You don’t need any account or API key with them: everything is included in your credits.' },
  { q: 'Can Storyit translate my videos?', a: 'Yes. Upload a vertical video: Storyit separates the voice from the music, translates every sentence so it fits the same timing, records a new voice in French, English or Spanish and replaces the burned-in captions. It costs 3,500 credits per minute, refunded if the translation fails.' },
  { q: 'Is there a free plan?', a: 'Yes. You get 3,000 free credits when you sign up, no card required: enough for two full Creative Studio projects. Paid plans start at $29/month with 43,000 credits every month.' },
  { q: 'Do I own the videos I create?', a: 'Yes. You keep all rights to your stories and videos, and you can download them and post them wherever you want.' },
  { q: 'Does Storyit post to TikTok and Instagram for me?', a: 'Direct posting to TikTok and Instagram is temporarily paused while the platforms review it. You download your finished videos and post them yourself in a few seconds.' },
  { q: 'Can I cancel anytime?', a: 'Yes, from Plan & credits. You keep access until the end of the paid period.' },
];

export const faqsFr = [
  { q: 'C’est quoi Storyit ?', a: 'Storyit est un générateur de vidéos IA pour TikTok, Instagram Reels et YouTube Shorts. Avec le Creative Studio, une idée d’histoire devient une vidéo verticale terminée (Fruit Dramas et mini-séries avec personnages 3D et vraies voix), et tu peux traduire tes vidéos dans d’autres langues.' },
  { q: 'Comment faire une vidéo de fruits IA (Fruit Drama) ?', a: `Ouvre le Creative Studio, choisis un style (fruits, ongles, objets ou pierres précieuses) et écris ton histoire en quelques lignes, ou laisse le studio proposer 3 histoires. Il écrit le hook, un script minuté de plus d’une minute, tous les prompts d’images et d’animation. Clique ensuite sur « Générer la vidéo » : les images sont dessinées, chaque plan est animé et la vidéo est montée pour toi. Un projet coûte ${formatCredits(PROMPT_PROJECT_COST)} crédits ; la vidéo se paie selon la qualité et la durée.` },
  { q: 'Les vidéos IA peuvent-elles être monétisées sur TikTok ?', a: 'Le programme de rémunération des créateurs de TikTok paie les vidéos originales de plus d’une minute sur des comptes éligibles, et le contenu IA doit être signalé à la publication. Storyit fait des vidéos de plus d’une minute pensées pour la rétention, mais les revenus dépendent de ton compte, de ton audience et des règles de TikTok : personne ne peut les garantir.' },
  { q: 'Quelles IA utilise Storyit ?', a: 'Les studios utilisent les meilleurs modèles pour chaque étape : ChatGPT pour les images, Grok Imagine pour l’animation, Claude pour les scripts et ElevenLabs pour les voix. Tu n’as besoin d’aucun compte ni d’aucune clé chez eux : tout est inclus dans tes crédits.' },
  { q: 'Storyit peut-il traduire mes vidéos ?', a: 'Oui. Envoie une vidéo verticale : Storyit sépare la voix de la musique, traduit chaque phrase au même tempo, enregistre une nouvelle voix en français, anglais ou espagnol et remplace les sous-titres incrustés. 3 500 crédits par minute, remboursés si la traduction échoue.' },
  { q: 'Y a-t-il une offre gratuite ?', a: 'Oui. Tu reçois 3 000 crédits à l’inscription, sans carte bancaire : de quoi faire deux projets complets du Creative Studio. Les offres payantes commencent à 29 $/mois (ou −20 % à l’année) avec 43 000 crédits par mois.' },
  { q: 'Les vidéos m’appartiennent-elles ?', a: 'Oui. Tu gardes tous les droits sur tes histoires et tes vidéos, et tu peux les télécharger et les publier où tu veux.' },
  { q: 'Storyit publie-t-il sur TikTok et Instagram pour moi ?', a: 'La publication directe sur TikTok et Instagram est en pause le temps que les plateformes la valident. Tu télécharges tes vidéos terminées et tu les publies toi-même en quelques secondes.' },
  { q: 'Puis-je résilier à tout moment ?', a: 'Oui, depuis « Offre et crédits ». Tu gardes l’accès jusqu’à la fin de la période payée.' },
];

export function FAQ() {
  const fr = useLang() === 'fr';
  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-20 md:px-6">
      <p className="label text-center">{fr ? 'Questions fréquentes' : 'FAQ'}</p>
      <h2 className="mt-3 text-center font-display text-4xl text-zinc-50">{fr ? 'Vos questions, nos réponses' : 'Questions, answered'}</h2>
      <div className="mt-10 divide-y divide-line/[0.06] rounded-2xl border border-line/[0.06] bg-ink-900">
        {(fr ? faqsFr : faqs).map(({ q, a }) => (
          <details key={q} className="group px-6 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-zinc-100">
              {q}<ChevronDown className="h-4 w-4 shrink-0 text-zinc-500 transition group-open:rotate-180" />
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
