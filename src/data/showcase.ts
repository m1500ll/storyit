/** Example videos produced by the Storyit team (owner-made). Files live in /public/showcase. */
export interface ShowcaseVideo {
  slug: string;
  title: string;
  /** Short hook shown on the card. */
  hook: string;
  format: '3D animation';
  seconds: number;
}

/** 3D animated shorts made with the Animated Studio (true stories, narrated). */
export const SHOWCASE: ShowcaseVideo[] = [
  { slug: 'coq-oeuf', title: 'Le coq qui pondait un œuf', hook: '1474: a rooster goes on trial for laying an egg.', format: '3D animation', seconds: 60 },
  { slug: 'shogun-des-chiens', title: 'Le shogun des chiens', hook: 'The shogun who made hurting a dog a crime.', format: '3D animation', seconds: 65 },
  { slug: 'pont-rompez-le-pas', title: 'Le pont qui a inventé le « rompez le pas »', hook: 'Soldiers marched in step. The bridge gave way.', format: '3D animation', seconds: 64 },
];

export const videoSrc = (slug: string) => `/showcase/${slug}.mp4`;
export const previewSrc = (slug: string) => `/showcase/${slug}-preview.mp4`;
export const posterSrc = (slug: string) => `/showcase/${slug}.webp`;
