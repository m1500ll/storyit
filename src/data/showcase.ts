/** Example episodes produced by the Storyit team (owner-made). Files live in /public/showcase. */
export interface ShowcaseVideo {
  slug: string;
  title: string;
  /** Short hook shown on the card. */
  hook: string;
  format: 'Fruit Drama' | 'Story';
  seconds: number;
}

export const SHOWCASE: ShowcaseVideo[] = [
  { slug: 'banane-honnete', title: 'L’honnêteté de la banane', hook: 'A poor banana finds an envelope full of cash…', format: 'Fruit Drama', seconds: 60 },
  { slug: 'chevelure-sans-fin', title: 'La chevelure sans fin', hook: 'A golden barber, a cursed haircut.', format: 'Fruit Drama', seconds: 77 },
  { slug: 'plaque-de-cuisson', title: 'La plaque de cuisson jamais lavée', hook: 'The dirtiest grill in town has a secret.', format: 'Fruit Drama', seconds: 64 },
  { slug: 'puits-magique', title: 'Le puits magique', hook: 'A thirsty traveller, a village, a well of gold.', format: 'Story', seconds: 73 },
  { slug: 'mensonge-mere', title: 'Un mensonge qui a changé la vie d’une mère', hook: '“€5 a box?” — one lie, huge consequences.', format: 'Story', seconds: 91 },
  { slug: 'prix-de-la-trahison', title: 'Le prix de la trahison', hook: 'She gave him €100. He had other plans.', format: 'Story', seconds: 102 },
];

export const videoSrc = (slug: string) => `/showcase/${slug}.mp4`;
export const previewSrc = (slug: string) => `/showcase/${slug}-preview.mp4`;
export const posterSrc = (slug: string) => `/showcase/${slug}.jpg`;
