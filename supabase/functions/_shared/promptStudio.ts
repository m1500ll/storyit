/**
 * Prompt Studio — master prompt and phase definitions. SERVER ONLY: imported by the `prompts`
 * Edge Function (the web app only imports the types and `normalizePhase` for tests).
 */

export const MASTER_PROMPT = `🎬 MASTER SYSTEM PROMPT : GÉNÉRATEUR DE FRUIT DRAMA IA VIRAL DE 1 MINUTE ET PLUS POUR TIKTOK
RÔLE
Tu es un directeur de contenu IA, scénariste et prompt engineer expert des vidéos ultra-dramatiques et virales de plus d'une minute (TikTok, Instagram Reels, YouTube Shorts). Ta spécialité : le « Fruit/Légume Drama » — des récits intenses, bizarres et à enjeux élevés, avec des personnages fruits ou légumes anthropomorphes animés en 3D (poires abusives, brocolis innocents, pêches héroïques, pommes manipulatrices…).

🛑 INTERDICTIONS STRICTES
1. NE GÉNÈRE AUCUNE IMAGE : tu produis uniquement du texte.
2. Les prompts d'image et de vidéo sont des objets JSON, un par scène. Ne regroupe jamais toutes les scènes dans un seul prompt.
3. AUCUN REMPLISSAGE : n'enchaîne pas 4 ou 5 scènes dans la même pièce avec des variations mineures. L'histoire traverse au moins 6 à 8 lieux différents (ex. salon → trottoir → voiture de luxe → centre-ville → hôpital → mariage en plein air). Chaque scène fait avancer l'intrigue.

⚙️ RÈGLES DE PRODUCTION
1. Durée cible : 60 secondes et plus (15 à 20 scènes distinctes et rythmées).
2. Format : tous les prompts visuels ciblent le vertical 9:16.
3. Style : animation 3D style Pixar/Disney, textures organiques ultra-détaillées, éclairage studio cinématographique, expressions émotionnelles extrêmes (sanglots, rage, avidité, compassion).
4. Ton : drame intense, contrastes émotionnels extrêmes, trahison, chagrin, rédemption, humour bizarre, suspense.
5. Cohérence : chaque personnage garde exactement la même apparence (fruit, couleurs, vêtements, accessoires) dans toutes les scènes ; répète sa description complète dans chaque prompt d'image et de vidéo.
6. Langue : tout est rédigé en FRANÇAIS (titres, synopsis, dialogues, prompts, légendes, hashtags). Les clés JSON restent celles demandées.
7. Le travail se fait étape par étape : ne produis QUE l'étape demandée, en t'appuyant sur les étapes déjà validées par l'utilisateur.`;

export type PhaseKey = 'concepts' | 'script' | 'images' | 'videos' | 'pack';

const S = (description?: string) => ({ type: 'STRING', ...(description ? { description } : {}) });
const arr = (items: unknown, description?: string) => ({ type: 'ARRAY', items, ...(description ? { description } : {}) });
const obj = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: 'OBJECT', properties, required });

const dialogue = arr(obj({ character: S('Nom du personnage'), voice_accent_tone: S('Ton, émotion ou accent de la voix'), line: S('Réplique exacte, ponctuation expressive') }));

const conceptsSchema = obj({
  concepts: arr(obj({
    title: S('Titre accrocheur'),
    synopsis: S('Synopsis dramatique en 3-4 phrases'),
    characters: arr(obj({ name: S(), fruit: S('Fruit ou légume'), role: S('Rôle / archétype émotionnel'), look: S('Apparence fixe : couleurs, vêtements, accessoires') })),
    locations: arr(S(), 'Parcours des lieux, 6 à 8'),
    themes: arr(S(), 'Trahison, sacrifice, vengeance, amour, rédemption…'),
  }), 'Exactement 3 concepts très différents'),
});

const scriptSchema = obj({
  characters: arr(obj({ name: S(), fruit: S(), archetype: S(), look: S('Description visuelle complète et fixe') })),
  locations: arr(S(), 'Feuille de route des lieux, dans l’ordre'),
  scenes: arr(obj({
    scene_number: { type: 'INTEGER' },
    location: S(), emotional_beat: S('Émotion dominante'), action: S('Ce qui se passe, 1-2 phrases'),
    dialogue,
  }), '15 à 20 scènes'),
});

const imagesSchema = obj({
  scenes: arr(obj({ scene_number: { type: 'INTEGER' }, aspect_ratio: S('9:16'), location_environment: S(), style: S(), prompt: S('Espèce du personnage, vêtements, expression, langage corporel, décor, palette de couleurs…') })),
});

const videosSchema = obj({
  scenes: arr(obj({ scene_number: { type: 'INTEGER' }, aspect_ratio: S('9:16'), camera_motion: S(), character_action: S(), dialogue, prompt: S('Prompt vidéo complet pour Grok Imagine (image vers vidéo)') })),
});

const packSchema = obj({
  thumbnail: obj({ aspect_ratio: S('9:16'), style: S(), prompt: S('Émotion extrême, contraste fort, effet choc') }),
  titles: arr(S(), '5 titres viraux'),
  caption: S('Légende dramatique avec appel à l’action'),
  hashtags: arr(S('Un seul hashtag par élément, avec #'), 'Entre 8 et 15 hashtags de niche et tendance, chacun dans un élément séparé'),
});

export const PHASES: Record<PhaseKey, { number: 1 | 2 | 3 | 4 | 5; key: string; label: string; schema: unknown; requires: string[]; invalidates: string[] }> = {
  concepts: { number: 1, key: 'concepts', label: 'Concepts', schema: conceptsSchema, requires: [], invalidates: ['chosen', 'script', 'images', 'videos', 'pack'] },
  script: { number: 2, key: 'script', label: 'Script & dialogues', schema: scriptSchema, requires: ['concepts', 'chosen'], invalidates: ['images', 'videos', 'pack'] },
  images: { number: 3, key: 'images', label: 'Prompts image', schema: imagesSchema, requires: ['script'], invalidates: ['videos', 'pack'] },
  videos: { number: 4, key: 'videos', label: 'Prompts vidéo', schema: videosSchema, requires: ['script', 'images'], invalidates: ['pack'] },
  pack: { number: 5, key: 'pack', label: 'Miniature & SEO', schema: packSchema, requires: ['script'], invalidates: [] },
};

/** The user turn for a phase, built only from what the user has validated so far. */
export function buildPhasePrompt(phase: PhaseKey, ctx: Record<string, any>): string {
  const concept = ctx.concepts?.[ctx.chosen ?? 0];
  const tweak = ctx.feedback ? `\nAjustements demandés par l'utilisateur : ${ctx.feedback}` : '';
  switch (phase) {
    case 'concepts':
      return `ÉTAPE 1 — SÉLECTION DE L'HISTOIRE. Propose 3 concepts d'histoire extrêmement dramatiques, émotionnels et à enjeux élevés, pensés pour 15 à 20 scènes, chacun traversant plusieurs lieux (maison → rue → ville → clinique → grand final). Inclure trahison, sacrifice, vengeance, amour et rédemption. Pour chacun : titre, personnages, parcours des lieux, synopsis.${ctx.idea ? `\nIdée de départ de l'utilisateur : ${ctx.idea}` : ''}${tweak}`;
    case 'script':
      return `ÉTAPE 2 — SCRIPT SCÈNE PAR SCÈNE. Concept choisi : ${JSON.stringify(concept)}\nDécoupe l'histoire en 15 à 20 scènes qui progressent dans 6 à 8 lieux différents (vraie durée de 60 s et plus). Donne : le résumé des personnages (archétypes + apparence fixe), la feuille de route des lieux, et pour chaque scène : lieu, émotion, action et dialogues exacts (mots expressifs, halètements, pleurs, cris) avec indications de voix pour la synchronisation labiale.${tweak}`;
    case 'images':
      return `ÉTAPE 3 — PROMPTS IMAGE 3D, UN PAR SCÈNE. Script validé : ${JSON.stringify(ctx.script)}\nPour CHAQUE scène, un objet avec scene_number, aspect_ratio "9:16", location_environment, style ("animation 3D style Pixar, textures très détaillées, éclairage studio cinématographique éclatant") et un prompt détaillé (espèce, vêtements, expression, langage corporel, décor, palette). Répète la description complète des personnages présents dans chaque prompt.${tweak}`;
    case 'videos':
      return `ÉTAPE 4 — PROMPTS D'ANIMATION ET DE VIDÉO AVEC DIALOGUES, UN PAR SCÈNE. Script validé : ${JSON.stringify(ctx.script)}\nPrompts image validés : ${JSON.stringify(ctx.images)}\nPour CHAQUE scène : scene_number, aspect_ratio "9:16", camera_motion précis, character_action (micro-expressions, mouvements de bouche, pleurs, déplacements), dialogue (personnage, ton de voix, réplique exacte) et un prompt vidéo complet cohérent avec l'image de la scène.
Le prompt vidéo est destiné à GROK IMAGINE en mode image vers vidéo (grok.com → Imagine) : l'image de la scène est importée comme première image, donc le prompt ne redécrit pas tout le décor, il décrit ce qui BOUGE et ce qu'on ENTEND. Rédige-le en un paragraphe fluide et concret (6 à 10 secondes d'action, 500 caractères maximum), dans cet ordre : le mouvement de caméra ; l'action et les micro-expressions des personnages (rappelle en quelques mots qui est qui : fruit, couleur, vêtement) ; la réplique exacte entre guillemets, précédée du personnage qui parle, de son ton de voix et de « en français » ; l'ambiance sonore (bruits, musique). Style : animation 3D type Pixar, format vertical 9:16. Pas de texte ni de sous-titres à l'écran, pas de changement de plan à l'intérieur d'un clip.${tweak}`;
    case 'pack':
      return `ÉTAPE 5 — MINIATURE ET PACK SEO. Script validé : ${JSON.stringify(ctx.script)}\nDonne : un prompt de miniature 9:16 à fort taux de clic (émotion extrême, contraste, effet choc), 5 titres viraux pour TikTok/Shorts/Reels, une légende dramatique avec appel à l'action, et 8 à 15 hashtags de niche et tendance (#AIFruit #FruitDrama…), un par élément de la liste.${tweak}`;
  }
}

const str = (v: unknown, max = 4000) => String(v ?? '').trim().slice(0, max);

/** Enforces the contract whatever the model returned: 9:16, numbered scenes, sane counts. */
export function normalizePhase(phase: PhaseKey, raw: any): any {
  const scenes = (list: any[]) => (Array.isArray(list) ? list : []).slice(0, 20).map((s, i) => ({ ...s, scene_number: i + 1, ...(phase === 'images' || phase === 'videos' ? { aspect_ratio: '9:16' } : {}) }));
  switch (phase) {
    case 'concepts': {
      const list = (Array.isArray(raw?.concepts) ? raw.concepts : []).slice(0, 3);
      if (list.length === 0) throw new Error('Aucun concept reçu. Réessayez.');
      return list;
    }
    case 'script': {
      const s = { characters: raw?.characters ?? [], locations: raw?.locations ?? [], scenes: scenes(raw?.scenes) };
      if (s.scenes.length < 10) throw new Error('Script trop court reçu. Réessayez.');
      return s;
    }
    case 'images':
      return scenes(raw?.scenes).map((s) => ({ scene_number: s.scene_number, aspect_ratio: '9:16', location_environment: str(s.location_environment, 200), style: str(s.style, 300), prompt: str(s.prompt) }));
    case 'videos':
      return scenes(raw?.scenes).map((s) => ({
        scene_number: s.scene_number, aspect_ratio: '9:16', camera_motion: str(s.camera_motion, 300), character_action: str(s.character_action, 600),
        dialogue: (Array.isArray(s.dialogue) ? s.dialogue : []).map((d: any) => ({ character: str(d.character, 80), voice_accent_tone: str(d.voice_accent_tone, 200), line: str(d.line, 400) })),
        prompt: str(s.prompt),
      }));
    case 'pack':
      return {
        thumbnail: { aspect_ratio: '9:16', style: str(raw?.thumbnail?.style, 300), prompt: str(raw?.thumbnail?.prompt) },
        titles: (Array.isArray(raw?.titles) ? raw.titles : []).slice(0, 5).map((t: unknown) => str(t, 150)),
        caption: str(raw?.caption, 2200),
        // Accept "#A #B" in one item too: split on spaces/commas before cleaning.
        hashtags: [...new Set((Array.isArray(raw?.hashtags) ? raw.hashtags : [])
          .flatMap((h: unknown) => str(h, 400).split(/[\s,]+(?=#)|,\s*/))
          .map((h: string) => '#' + h.trim().replace(/^#+/, '').replace(/\s+/g, '').slice(0, 60)))]
          .filter((h): h is string => typeof h === 'string' && h.length > 1).slice(0, 15),
      };
  }
}
