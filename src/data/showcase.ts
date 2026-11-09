/** Example videos made with Storyit. Files live in /public/showcase. */
export interface ShowcaseVideo {
  slug: string;
  title: string;
  /** Short hook shown on the card. */
  hook: string;
  format: '3D animation';
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

export const videoSrc = (slug: string) => `/showcase/${slug}.mp4`;
export const previewSrc = (slug: string) => `/showcase/${slug}-preview.mp4`;
export const posterSrc = (slug: string) => `/showcase/${slug}.webp`;
