/**
 * Characters for the Creative Studio.
 * - Customers create their own character (universe + one sentence, optional photo): the `characters` function writes the
 *   look and draws a reference sheet, stored in `user_characters` and reused in every video ("Mes personnages").
 * - LIBRARY: ready-made characters drawn by Storyit (sheet in public/characters/{slug}.webp), shown once `ready`.
 * A project keeps a snapshot of its cast (`cast_chars`): the exact look is copied word for word into every image prompt
 * and the sheets are attached to every image, so the characters never change between clips or videos.
 * Pure: shared by the app and the functions.
 */
export const CHARACTER_COST = 1000;
export const MAX_CAST = 5;

export type Universe = 'realiste' | 'matieres' | 'fruits' | 'humains' | 'animaux' | 'objets' | 'horreur' | 'pate' | 'anime' | 'perso';
/** adult realistic faces everywhere: the customers found the cartoon "baby faces" too childish */
const ADULT = 'ADULT character with a realistic, mature adult human face (real adult facial structure: defined jaw, cheekbones, adult-sized eyes, natural nose and lips; NOT a child, NOT a baby face, NOT big cartoon eyes) and TALL realistic adult proportions, about 7.5 heads tall, long legs (NOT chibi, NOT stocky).';
export const UNIVERSES: Record<Universe, { label: string; hint: string; example: string; style: string }> = {
  realiste: { label: 'Réaliste', hint: 'Comme une vraie personne filmée', example: 'Une chirurgienne élégante qui cache un tatouage sous sa blouse',
    style: `photorealistic cinematic style, like a frame from a live-action movie, real skin texture, natural lighting. ${ADULT}` },
  matieres: { label: 'Pierres et métaux', hint: 'Humain réaliste, peau en diamant, rubis, or…', example: 'Un homme d’affaires ambitieux à la peau de diamant, en costume bleu nuit',
    style: `high-end cinematic 3D render, realistic like a modern animated feature film for adults. Fully human shape (human head, nose, lips, ears, hands): ONLY the skin and hair are made of the material described, with facets, reflections and sparkles; NOT a gemstone-shaped head, NOT a robot, NOT a statue pose. ${ADULT}` },
  fruits: { label: 'Fruits 3D', hint: 'Humain réaliste, peau et cheveux de fruit', example: 'Une influenceuse à la peau de fraise, jalouse de sa sœur',
    style: `high-end cinematic 3D render, realistic like a modern animated feature film for adults. Fully human head, face and body; ONLY the skin has the color and texture of the fruit described (for example strawberry-red skin with tiny golden seeds) and the hair is made of the fruit's leaves or stem; the face stays a real adult human face. ${ADULT}` },
  humains: { label: 'Humains 3D', hint: 'Style film d’animation, visage adulte', example: 'Un chauffeur de taxi de 45 ans, fatigué mais courageux',
    style: `high-end cinematic 3D animated movie style with realistic adult anatomy and a mature, believable adult face (not a cartoon baby face), detailed skin and hair. ${ADULT}` },
  animaux: { label: 'Animaux 3D', hint: 'Animal debout comme un humain', example: 'Un lion en costume crème, le patron respecté du quartier',
    style: 'high-end cinematic 3D render, realistic fur and anatomy, an anthropomorphic animal standing upright like a human with expressive hands, TALL adult proportions and a mature adult expression (NOT a cub, NOT cute baby eyes).' },
  objets: { label: 'Objets 3D', hint: 'Corps humain, tête en objet', example: 'Un téléphone accro aux notifications, en sweat vert',
    style: `high-end cinematic 3D render. HUMAN clothed adult body with real hands; the WHOLE HEAD is the generic object described (no brand, no logo, no readable text) with an expressive adult face integrated on it. TALL realistic adult proportions (NOT chibi, NOT stocky).` },
  horreur: { label: 'Horreur', hint: 'Créatures et ambiance flippante', example: 'Une créature faite de câbles noirs avec un masque blanc',
    style: 'dark cinematic horror movie style, realistic textures, eerie dramatic lighting, unsettling but not gory, TALL adult proportions.' },
  pate: { label: 'Pâte à modeler', hint: 'Look stop-motion', example: 'Un vieux pirate grincheux avec une jambe de bois',
    style: 'claymation stop-motion style, handmade plasticine texture with fingerprints, soft studio lighting, adult character with realistic adult proportions and a mature face.' },
  anime: { label: 'Anime', hint: 'Dessin animé japonais', example: 'Une lycéenne capitaine de son équipe de foot',
    style: 'high quality Japanese anime style, clean line art, cel shading, adult or young-adult character with realistic proportions (NOT chibi).' },
  perso: { label: 'Personnalisé', hint: 'Ton prompt tel quel, sans aide', example: 'Décris le style et le personnage en détail',
    style: '' },
};
export const isUniverse = (u: unknown): u is Universe => typeof u === 'string' && u in UNIVERSES;

/** what a project keeps of each character (a snapshot, so a later change never alters a running series) */
export type CastChar = { id: string; name: string; role: string; personality: string; voice: string; look: string; sheet?: string };

/** the reference sheet prompt for a character (OpenAI image, 16:9) */
export function characterSheetPrompt(universe: Universe, look: string, withPhoto = false): string {
  const st = UNIVERSES[universe].style;
  return `Character reference sheet of ONE original character${st ? `, ${st}` : ''}
Clean neutral light grey background, soft studio lighting.

THE CHARACTER: ${look.trim().replace(/\.$/, '')}.${withPhoto ? ' Keep the face of the person in the attached photo (same facial features, same age), recreated in this style.' : ''} No logo, no brand, no readable text anywhere.

LAYOUT OF THE SHEET:
- Top row, full body, same pose and same scale: front view, 3/4 view, side view, back view.
- Bottom row, EXACTLY 6 close-ups of the face, one per expression: happy, angry, sad and crying, surprised, scheming smirk, scared.
- Bottom right corner: 2 small full-body action poses.

The character must be EXACTLY identical in every view: same face, same colors, same hair, same outfit, same proportions. Clean separation between each view, no overlap.

No text, no labels, no names, no logo, no watermark.`;
}

/** ready-made characters drawn by Storyit: shown in the library once their sheet exists (ready: true) */
export type LibraryCharacter = { slug: string; name: string; universe: Universe; role: string; personality: string; voice: string; look: string; ready: boolean };
export const LIBRARY: LibraryCharacter[] = [];
export const librarySheet = (slug: string) => `/characters/${slug}.webp`;
export const libraryCast = (c: LibraryCharacter): CastChar => ({ id: `lib:${c.slug}`, name: c.name, role: c.role, personality: c.personality, voice: c.voice, look: c.look, sheet: librarySheet(c.slug) });
