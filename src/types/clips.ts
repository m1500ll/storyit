/** AI clipping: domain types and options (ported from Clipit). */

/** One on-screen caption chunk. Times are in seconds on the SOURCE video timeline. `hi` marks a key word (shown in
 *  colour); `action` marks a reaction tag such as "*RIRE*" shown while nobody speaks. */
export interface Caption { start: number; end: number; text: string; words?: { s: number; e: number; w: string; hi?: boolean }[]; action?: boolean }

export type CaptionStyleId = 'clipper' | 'bold' | 'pop' | 'clean';
export type LayoutId = 'auto' | 'split' | 'stack' | 'track' | 'zoom' | 'fill' | 'fit';
export type CaptionAnimId = 'word' | 'karaoke' | 'pop' | 'none';
export type TitleStyleId = 'tiktok' | 'box' | 'outline' | 'neon';
export type ClipLengthId = 'short' | 'medium' | 'long';

export const CLIP_LENGTHS: Record<ClipLengthId, { label: string; min: number; max: number }> = {
  short: { label: '15–30 s', min: 15, max: 30 },
  medium: { label: '30–60 s', min: 30, max: 60 },
  long: { label: '60–90 s', min: 60, max: 90 },
};

export const CAPTION_STYLES: Record<CaptionStyleId, { label: string; description: string }> = {
  clipper: { label: 'Clipper', description: 'Police étroite, mots-clés en jaune' },
  bold: { label: 'Gras', description: 'Blanc, gros contour, majuscules' },
  pop: { label: 'Pop', description: 'Jaune, gros contour, majuscules' },
  clean: { label: 'Sobre', description: 'Phrase normale sur fond sombre' },
};

export const LAYOUTS: Record<LayoutId, { label: string; description: string }> = {
  auto: { label: 'Auto', description: 'L’IA choisit selon la vidéo' },
  split: { label: 'Facecam + jeu', description: 'La caméra en haut, le gameplay en dessous' },
  stack: { label: '2 caméras + jeu', description: 'Deux caméras empilées, le jeu en bas' },
  track: { label: 'Suivi de la parole', description: 'Le cadre suit la personne qui parle' },
  zoom: { label: 'Zoom flouté', description: 'Vidéo zoomée au centre, fond flouté' },
  fill: { label: 'Remplir', description: 'Recadre le centre pour remplir l’écran vertical' },
  fit: { label: 'Adapter', description: 'Toute l’image sur un fond flouté' },
};

/** Longest source video accepted (seconds). Keeps the AI step under the server time limit. */
export const MAX_SOURCE_SECONDS = 30 * 60;

export const CAPTION_ANIMS: Record<CaptionAnimId, { label: string; description: string }> = {
  word: { label: '1 mot', description: 'Un mot à la fois, comme les clippers' },
  karaoke: { label: 'Karaoké', description: 'Le mot prononcé s’allume' },
  pop: { label: 'Pop', description: 'Chaque groupe de mots surgit' },
  none: { label: 'Fixe', description: 'Sans animation' },
};

export const TITLE_STYLES: Record<TitleStyleId, { label: string; description: string }> = {
  tiktok: { label: 'TikTok', description: 'Bandeau blanc fin, posé sur la vidéo' },
  box: { label: 'Bandeau gras', description: 'Texte noir épais sur bandeau blanc' },
  outline: { label: 'Contour', description: 'Gros texte blanc, contour noir' },
  neon: { label: 'Néon', description: 'Texte blanc lumineux violet' },
};

/** What the face detection found in a clip (src/lib/clipFraming.ts), saved on the clip so it runs once.
 *  Boxes are in source-video pixels. `cams`: facecam overlays (stable small faces); `segments`: the crop centre to
 *  follow over time for the "track" layout (clip time in seconds, from the clip start). */
export interface ClipFraming {
  v: 1;
  w: number; h: number;
  kind: 'facecam' | 'two_cams' | 'people' | 'none';
  cams: { x: number; y: number; w: number; h: number }[];
  segments: { t: number; cx: number; cy: number }[];
  start: number; end: number;
}
