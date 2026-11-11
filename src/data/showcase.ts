/** Example videos made with Storyit. Files live in /public/showcase. */
export interface ShowcaseVideo {
  slug: string;
  title: string;
  /** Short hook shown on the card. */
  hook: string;
  format: '3D animation' | 'Fruit Drama' | 'Story' | 'Original · FR' | 'Translated · EN';
  seconds: number;
}

/** 3D animated shorts made with the Animated Studio by the Storyit team and customers (shown with their consent). */
export const SHOWCASE: ShowcaseVideo[] = [
  { slug: 'fenetres-murees', title: 'Les fenêtres murées de 1696', hook: 'Thousands of English people bricked up their own windows. On purpose.', format: '3D animation', seconds: 61 },
  { slug: 'sous-marin-napoleon', title: 'Le sous-marin qui vexe Napoléon', hook: 'A submarine blows up a ship… and France says no thanks.', format: '3D animation', seconds: 37 },
  { slug: 'interdit-de-mourir', title: 'Interdit de mourir à Svalbard', hook: 'In this town you may not be buried. Not even dead.', format: '3D animation', seconds: 66 },
  { slug: 'coq-oeuf', title: 'Le coq qui pondait un œuf', hook: '1474: a rooster goes on trial for laying an egg.', format: '3D animation', seconds: 60 },
  { slug: 'geant-coule-au-port', title: 'Le géant qui coula au port', hook: 'Sweden’s mightiest warship sank after 1,300 metres.', format: '3D animation', seconds: 60 },
  { slug: 'premiers-passagers', title: 'Les premiers passagers étaient des bêtes', hook: 'The first passengers of the sky? A sheep, a duck and a rooster.', format: '3D animation', seconds: 61 },
  { slug: 'palais-de-glace', title: 'Le palais de glace de Montréal', hook: 'Montreal built an impregnable fortress… knowing it would melt.', format: '3D animation', seconds: 60 },
  { slug: 'shogun-des-chiens', title: 'Le shogun des chiens', hook: 'The shogun who made hurting a dog a crime.', format: '3D animation', seconds: 65 },
  { slug: 'cache-oreilles', title: 'Les cache-oreilles de Chester', hook: 'A 15-year-old had cold ears. All of America copied him.', format: '3D animation', seconds: 63 },
  { slug: 'harengs-du-balcon', title: 'Des harengs tombés du balcon', hook: 'Every year, a mayor showers his town with herrings.', format: '3D animation', seconds: 59 },
  { slug: 'grecs-150-contre-1', title: 'Les Grecs à 150 contre 1', hook: 'Rated 150 to 1, they went on to win the Euro.', format: '3D animation', seconds: 64 },
  { slug: 'pont-rompez-le-pas', title: 'Le pont qui a inventé le « rompez le pas »', hook: 'Soldiers marched in step. The bridge gave way.', format: '3D animation', seconds: 64 },
];

/** Fruit dramas and short stories made with the Prompt Studio by the Storyit team. */
export const SHOWCASE_FRUIT: ShowcaseVideo[] = [
  { slug: 'banane-honnete', title: 'L’honnêteté de la banane', hook: 'A poor banana finds an envelope full of cash…', format: 'Fruit Drama', seconds: 60 },
  { slug: 'chevelure-sans-fin', title: 'La chevelure sans fin', hook: 'A golden barber, a cursed haircut.', format: 'Fruit Drama', seconds: 77 },
  { slug: 'plaque-de-cuisson', title: 'La plaque de cuisson jamais lavée', hook: 'The dirtiest grill in town has a secret.', format: 'Fruit Drama', seconds: 64 },
  { slug: 'puits-magique', title: 'Le puits magique', hook: 'A thirsty traveller, a village, a well of gold.', format: 'Story', seconds: 73 },
  { slug: 'mensonge-mere', title: 'Un mensonge qui a changé la vie d’une mère', hook: '“€5 a box?” — one lie, huge consequences.', format: 'Story', seconds: 91 },
  { slug: 'prix-de-la-trahison', title: 'Le prix de la trahison', hook: 'She gave him €100. He had other plans.', format: 'Story', seconds: 102 },
];

export const videoSrc = (slug: string) => `/showcase/${slug}.mp4`;
export const previewSrc = (slug: string) => `/showcase/${slug}-preview.mp4`;
export const posterSrc = (slug: string) => `/showcase/${slug}.webp`;
