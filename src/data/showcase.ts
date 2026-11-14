/** Example videos made with Storyit. Files live in /public/showcase. */
export interface ShowcaseVideo {
  slug: string;
  title: string;
  /** Short hook shown on the card. */
  hook: string;
  /** French hook (shown on the French site) */
  hookFr?: string;
  format: '3D animation' | 'Fruit Drama' | 'Story' | 'Original · FR' | 'Translated · EN';
  seconds: number;
}

/** 3D animated shorts made with the Animated Studio by the Storyit team and customers (shown with their consent). */
export const SHOWCASE: ShowcaseVideo[] = [
  { slug: 'fenetres-murees', title: 'Les fenêtres murées de 1696', hook: 'Thousands of English people bricked up their own windows. On purpose.', hookFr: 'Des milliers d’Anglais ont muré leurs propres fenêtres. Exprès.', format: '3D animation', seconds: 61 },
  { slug: 'sous-marin-napoleon', title: 'Le sous-marin qui vexe Napoléon', hook: 'A submarine blows up a ship… and France says no thanks.', hookFr: 'Un sous-marin fait sauter un navire… et la France dit non merci.', format: '3D animation', seconds: 37 },
  { slug: 'interdit-de-mourir', title: 'Interdit de mourir à Svalbard', hook: 'In this town you may not be buried. Not even dead.', hookFr: 'Dans cette ville, on n’a pas le droit d’être enterré. Même mort.', format: '3D animation', seconds: 66 },
  { slug: 'coq-oeuf', title: 'Le coq qui pondait un œuf', hook: '1474: a rooster goes on trial for laying an egg.', hookFr: '1474 : un coq est jugé pour avoir pondu un œuf.', format: '3D animation', seconds: 60 },
  { slug: 'geant-coule-au-port', title: 'Le géant qui coula au port', hook: 'Sweden’s mightiest warship sank after 1,300 metres.', hookFr: 'Le plus grand navire de Suède a coulé après 1 300 mètres.', format: '3D animation', seconds: 60 },
  { slug: 'premiers-passagers', title: 'Les premiers passagers étaient des bêtes', hook: 'The first passengers of the sky? A sheep, a duck and a rooster.', hookFr: 'Les premiers passagers du ciel ? Un mouton, un canard et un coq.', format: '3D animation', seconds: 61 },
  { slug: 'palais-de-glace', title: 'Le palais de glace de Montréal', hook: 'Montreal built an impregnable fortress… knowing it would melt.', hookFr: 'Montréal a bâti une forteresse imprenable… en sachant qu’elle fondrait.', format: '3D animation', seconds: 60 },
  { slug: 'shogun-des-chiens', title: 'Le shogun des chiens', hook: 'The shogun who made hurting a dog a crime.', hookFr: 'Le shogun qui a fait de la maltraitance d’un chien un crime.', format: '3D animation', seconds: 65 },
  { slug: 'cache-oreilles', title: 'Les cache-oreilles de Chester', hook: 'A 15-year-old had cold ears. All of America copied him.', hookFr: 'Un ado de 15 ans avait froid aux oreilles. Toute l’Amérique l’a copié.', format: '3D animation', seconds: 63 },
  { slug: 'harengs-du-balcon', title: 'Des harengs tombés du balcon', hook: 'Every year, a mayor showers his town with herrings.', hookFr: 'Chaque année, un maire jette des harengs sur sa ville.', format: '3D animation', seconds: 59 },
  { slug: 'grecs-150-contre-1', title: 'Les Grecs à 150 contre 1', hook: 'Rated 150 to 1, they went on to win the Euro.', hookFr: 'Donnés à 150 contre 1, ils ont gagné l’Euro.', format: '3D animation', seconds: 64 },
  { slug: 'pont-rompez-le-pas', title: 'Le pont qui a inventé le « rompez le pas »', hook: 'Soldiers marched in step. The bridge gave way.', hookFr: 'Des soldats marchaient au pas. Le pont s’est effondré.', format: '3D animation', seconds: 64 },
];

/** Fruit dramas and short stories made with the Creative Studio by the Storyit team. */
export const SHOWCASE_FRUIT: ShowcaseVideo[] = [
  { slug: 'banane-honnete', title: 'L’honnêteté de la banane', hook: 'A poor banana finds an envelope full of cash…', hookFr: 'Une banane pauvre trouve une enveloppe pleine de billets…', format: 'Fruit Drama', seconds: 60 },
  { slug: 'chevelure-sans-fin', title: 'La chevelure sans fin', hook: 'A golden barber, a cursed haircut.', hookFr: 'Un barbier doré, une coupe maudite.', format: 'Fruit Drama', seconds: 77 },
  { slug: 'plaque-de-cuisson', title: 'La plaque de cuisson jamais lavée', hook: 'The dirtiest grill in town has a secret.', hookFr: 'Le grill le plus sale de la ville cache un secret.', format: 'Fruit Drama', seconds: 64 },
  { slug: 'puits-magique', title: 'Le puits magique', hook: 'A thirsty traveller, a village, a well of gold.', hookFr: 'Un voyageur assoiffé, un village, un puits d’or.', format: 'Story', seconds: 73 },
  { slug: 'mensonge-mere', title: 'Un mensonge qui a changé la vie d’une mère', hook: '“€5 a box?” — one lie, huge consequences.', hookFr: '« 5 € la boîte ? » Un mensonge, d’énormes conséquences.', format: 'Story', seconds: 91 },
  { slug: 'prix-de-la-trahison', title: 'Le prix de la trahison', hook: 'She gave him €100. He had other plans.', hookFr: 'Elle lui a donné 100 €. Il avait d’autres projets.', format: 'Story', seconds: 102 },
];

export const videoSrc = (slug: string) => `/showcase/${slug}.mp4`;
export const previewSrc = (slug: string) => `/showcase/${slug}-preview.mp4`;
export const posterSrc = (slug: string) => `/showcase/${slug}.webp`;
