import { Card, PageHeader } from '@/components/ui';

const TIPS = [
  { title: 'Accrocher dans les 2 premières secondes', body: 'Ouvrez sur le conflit ou une réplique choc, jamais sur le contexte. Le hook du studio est pensé pour ça : gardez-le en première scène.' },
  { title: 'Dépasser une minute', body: 'TikTok ne rémunère que les vidéos de plus d’une minute. Dans le Creative Studio, choisissez la durée « 1 min » (61 à 68 s) et gardez tous les plans.' },
  { title: 'Finir chaque épisode sur un cliffhanger', body: 'Le suspense fait revenir les spectateurs pour la partie 2 et les pousse à s’abonner. Titrez « Partie 1, 2, 3… ».' },
  { title: 'Garder les mêmes personnages', body: 'Des personnages récurrents créent une communauté de fans. Utilisez « C’est une suite » : leur apparence reste la même dans chaque épisode.' },
  { title: 'Publier chaque jour, à la même heure', body: 'La régularité compte plus que la perfection. Préparez 3 à 5 épisodes le même jour, puis publiez-les un par jour.' },
  { title: 'Signaler le contenu IA', body: 'Les plateformes exigent que le contenu généré par IA soit signalé. Activez le label IA à la publication pour rester éligible à la rémunération.' },
  { title: 'Des sous-titres incrustés', body: 'La plupart des gens regardent sans le son. Les vidéos 3D de Storyit ont déjà des sous-titres mot à mot ; pour les autres, ajoutez-les dans CapCut.' },
  { title: 'Regarder la rétention, pas seulement les vues', body: 'Dans les statistiques TikTok, suivez la durée moyenne de visionnage et « vidéo regardée en entier ». Si les gens partent tôt, resserrez les 3 premiers plans.' },
];

export default function GuidePage() {
  return (
    <>
      <PageHeader eyebrow="Grandir" title="Guide du créateur" description="Ce qui marche pour les séries d’histoires sur TikTok, Reels et Shorts. Du concret, sans blabla." />
      <div className="grid gap-4 md:grid-cols-2">
        {TIPS.map((t, i) => (
          <Card key={t.title} className="relative">
            <span className="absolute right-5 top-4 font-display text-4xl text-line/[0.08]">{i + 1}</span>
            <h2 className="pr-10 text-sm font-semibold text-zinc-100">{t.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{t.body}</p>
          </Card>
        ))}
      </div>
    </>
  );
}
