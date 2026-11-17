/** AI clipping: domain types and options (ported from Clipit). */

/** One on-screen caption chunk. Times are in seconds on the SOURCE video timeline. */
export interface Caption { start: number; end: number; text: string; words?: { s: number; e: number; w: string }[] }

export type CaptionStyleId = 'bold' | 'pop' | 'clean';
export type LayoutId = 'fill' | 'fit';
export type CaptionAnimId = 'none' | 'pop' | 'karaoke';
export type TitleStyleId = 'box' | 'outline' | 'neon';
export type ClipLengthId = 'short' | 'medium' | 'long';

export const CLIP_LENGTHS: Record<ClipLengthId, { label: string; min: number; max: number }> = {
  short: { label: '15–30 s', min: 15, max: 30 },
  medium: { label: '30–60 s', min: 30, max: 60 },
  long: { label: '60–90 s', min: 60, max: 90 },
};

export const CAPTION_STYLES: Record<CaptionStyleId, { label: string; description: string }> = {
  bold: { label: 'Gras', description: 'Blanc, gros contour, majuscules' },
  pop: { label: 'Pop', description: 'Jaune, gros contour, majuscules' },
  clean: { label: 'Sobre', description: 'Phrase normale sur fond sombre' },
};

export const LAYOUTS: Record<LayoutId, { label: string; description: string }> = {
  fill: { label: 'Remplir', description: 'Recadre le centre pour remplir l’écran vertical' },
  fit: { label: 'Adapter', description: 'Toute l’image sur un fond flouté' },
};

/** Longest source video accepted (seconds). Keeps the AI step under the server time limit. */
export const MAX_SOURCE_SECONDS = 30 * 60;

export const CAPTION_ANIMS: Record<CaptionAnimId, { label: string; description: string }> = {
  karaoke: { label: 'Karaoké', description: 'Le mot prononcé s’allume' },
  pop: { label: 'Pop', description: 'Chaque groupe de mots surgit' },
  none: { label: 'Fixe', description: 'Sans animation' },
};

export const TITLE_STYLES: Record<TitleStyleId, { label: string; description: string }> = {
  box: { label: 'TikTok', description: 'Texte noir sur bandeau blanc arrondi' },
  outline: { label: 'Contour', description: 'Gros texte blanc, contour noir' },
  neon: { label: 'Néon', description: 'Texte blanc lumineux violet' },
};
