/**
 * Creative Studio V4 — "Studio mini-drama IA": story → 3D image prompts (ChatGPT) + animation prompts (Grok Imagine),
 * built for retention, pace and engagement. SERVER ONLY for the master prompt; the web app imports the types,
 * STYLES and the pure builders/checks (the same code assembles the prompts on the server and shows the checklist).
 *
 * The model writes the creative parts as JSON. Everything that must be copied WORD FOR WORD (style block, Grok blocks
 * ① to ④, character descriptions) is assembled here by code, so it is never abbreviated or drifts between clips.
 */

import { isUniverse, UNIVERSES, type CastChar } from './characters.ts';
export type PhaseKey = 'concepts' | 'script' | 'images' | 'videos' | 'pack';
export type StyleKey = 'fruits' | 'ongles' | 'objets' | 'pierres';

const LOOK = 'Pixar 3D animated movie still, ultra detailed, strong warm key light, rim light, high contrast, saturated rich colors, slightly low angle, blurred objects in the foreground at the bottom edge, enough space around the characters for camera moves. HUMAN clothed bodies with real hands, ';
export const STYLES: Record<StyleKey, { label: string; emoji: string; text: string; heads: string; block: string; ruleFr: string }> = {
  fruits: {
    label: 'Fruits', emoji: '🍓', text: 'Corps humain, la tête est un gros fruit brillant et entier.',
    heads: 'glossy whole fruit heads, never cut',
    block: 'Pixar 3D animated movie still, ultra detailed, strong warm sunlight, rim light, high contrast, saturated rich colors, slightly low angle, blurred objects in the foreground at the bottom edge, enough space around the characters for camera moves. HUMAN clothed bodies with real hands, WHOLE HEAD is a big glossy whole FRUIT (NOT a gemstone, NOT a vegetable; always whole and intact, never cut, bitten or squeezed) with realistic shiny skin, stylized cartoon face integrated on the fruit (big shiny expressive eyes, expressive eyebrows, clearly visible mouth). No text, no logo, no watermark.',
    ruleFr: 'Fruits entiers, jamais coupés ni pourris.',
  },
  ongles: {
    label: 'Ongles', emoji: '💅', text: 'Corps humain, la tête est un ongle géant verni avec du nail art.',
    heads: 'manicured fingernail heads, not real fingers',
    block: LOOK + 'WHOLE HEAD is a giant glossy manicured FINGERNAIL shape (NOT a real finger, no finger attached, no skin, no damage) covered in thick shiny gel polish with nail-art details, stylized cartoon face integrated on the nail (big shiny expressive eyes, expressive eyebrows, clearly visible mouth). No text, no logo, no watermark.',
    ruleFr: 'Ongles : jamais de vrai doigt.',
  },
  objets: {
    label: 'Objets du quotidien', emoji: '🫖', text: 'Corps humain, la tête est une tasse, une ampoule, un réveil…',
    heads: 'household object heads, not robots',
    block: LOOK + 'WHOLE HEAD is a big generic household OBJECT (NOT a robot, no screen face, no brand, no logo, no readable text) with realistic ceramic, glass, metal or wood, stylized cartoon face integrated on the object (big shiny expressive eyes, expressive eyebrows, clearly visible mouth). No text, no logo, no watermark.',
    ruleFr: 'Objets génériques, pas de marque ni de robot.',
  },
  pierres: {
    label: 'Pierres précieuses', emoji: '💎', text: 'Corps humain, la tête est une gemme taillée.',
    heads: 'gemstone heads, not fruits',
    block: LOOK + 'WHOLE HEAD is a big cut GEMSTONE (NOT a fruit: no stem, no leaf) with crisp facets, light refraction, sparkles and a soft inner glow, stylized cartoon face integrated on the stone (big shiny expressive eyes, expressive eyebrows, clearly visible mouth). No text, no logo, no watermark.',
    ruleFr: 'Pierres : gemme taillée, jamais un fruit.',
  },
};
/** the characters picked for the project (theirs or the library's, max 5): they replace the style's heads, word for word */
export const castOf = (ctx: any): CastChar[] => (Array.isArray(ctx?.cast_chars) ? ctx.cast_chars : []).filter((c: any) => c?.name && c?.look).slice(0, 5);
const CAST_BLOCK = LOOK.replace('HUMAN clothed bodies with real hands, ', '') + 'Every character exactly as described and exactly as in the attached character reference sheets: same face, same skin or head material, same hair, same outfit, same tall adult proportions. No text, no logo, no watermark.';
/** the image style of a project: the library cast when there is one, otherwise the locked head style */
/** scene framing shared by every universe (the universe adds the rendering style and the character rule) */
const FRAME = 'Vertical movie still, ultra detailed, strong key light, rim light, high contrast, rich colors, slightly low angle, blurred objects in the foreground at the bottom edge, enough space around the characters for camera moves. ';
export function lookOf(ctx: any): { label: string; block: string; heads: string } {
  const uk = ctx?.universe; const u = isUniverse(uk) ? UNIVERSES[uk] : null;
  const style = u ? (u.style || 'Exactly the visual style described in the story.') : '';
  if (castOf(ctx).length) return { label: 'Personnages choisis', block: u ? `${FRAME}${style} ${CAST_BLOCK.slice(CAST_BLOCK.indexOf('Every character'))}` : CAST_BLOCK, heads: 'faces, heads and skin materials' };
  if (u) return { label: u.label, block: `${FRAME}${style} No text, no logo, no watermark.`, heads: 'faces, skin and hair' };
  return STYLES[styleOf(ctx?.style)];
}
const castLine = (cast: CastChar[]) => `Casting imposé (personnages choisis par l'utilisateur) : utilise EXACTEMENT ces ${cast.length} personnages, avec ces prénoms, ce caractère et cette voix ; n'invente aucun autre personnage qui parle (des figurants muets en arrière-plan sont permis). Leur apparence est fixée (recopie-la telle quelle dans les descriptions en anglais) :\n${cast.map((c) => `- ${c.name} (${c.role} ; caractère : ${c.personality} ; voix : ${c.voice}) : ${c.look}`).join('\n')}`;
/** after a phase: the library characters keep their own voice and their exact appearance (never the model's paraphrase) */
export function applyCast(phase: PhaseKey, raw: any, ctx: any): any {
  const cast = castOf(ctx);
  if (!cast.length || !raw) return raw;
  const find = (name: unknown) => cast.find((c) => c.name.toLowerCase() === String(name ?? '').trim().toLowerCase());
  if (phase === 'script') for (const ch of raw.characters ?? []) { const c = find(ch.name); if (c) { ch.voice = c.voice; ch.head = c.look.split('; outfit')[0]; } }
  if (phase === 'images') for (const sh of raw.sheet ?? []) { const c = find(sh.name); if (c) sh.description = c.look; }
  return raw;
}
export const styleOf = (s: unknown): StyleKey => (typeof s === 'string' && s in STYLES ? (s as StyleKey) : 'fruits');

export const MASTER_PROMPT = `Tu es scénariste, directeur artistique et réalisateur d'un studio de mini-dramas IA verticaux (9:16), rendu film d'animation 3D. Trois obsessions : qu'on ne swipe pas dans les 3 premières secondes, qu'on reste jusqu'à la fin, qu'on commente ou partage.
Tu travailles étape par étape et tu réponds UNIQUEMENT avec l'objet JSON demandé. Les dialogues, titres et textes pour le public sont en FRANÇAIS ; les descriptions visuelles destinées à ChatGPT et à Grok (décors, têtes, tenues, actions, plans, sons) sont en ANGLAIS. Le code ajoute lui-même le bloc de style et les blocs fixes de Grok : ne les écris jamais.

HISTOIRE ET RYTHME
1. DURÉE : la durée totale imposée dans la demande (par défaut 42 à 50 s). Un clip = une scène dans UN lieu : 6 s (choc, réaction), 10 s (dialogue, le meilleur choix), 15 s (longue scène). Additionne et vérifie. Trop d'histoire = une partie de plus.
2. STRUCTURE : clip 1 = hook ; contexte compris par le conflit, jamais expliqué à froid ; mini-révélation + réplique culte vers 30-40 s ; retournement ; dernier clip = cliffhanger coupé au pic, rien de résolu.
3. CASTING : 3 à 5 personnages, 3 maximum par image ; 2 à 4 lieux par partie.
4. RÉTENTION : la question du hook reste ouverte jusqu'au bout ; du neuf toutes les 5-10 s (info, vanne, émotion, retournement) ; chaque scène est pire que la précédente ; chaque clip finit sur un mini-hook (menace, délai, révélation coupée, arrivée, choix). Aucun plan de décor, d'ambiance ni de quelqu'un qui marche. À bannir : explication à froid, répétition, transition, bonne nouvelle sans prix à payer. Le héros répond, il ne subit pas : chaque scène change le rapport de force.
5. DIALOGUE NATUREL QUI A DU SENS (règle n°1) : on parle comme dans la vraie vie, à 2,6-3,2 mots/s : 6 s ≈ 17 mots (2 répliques), 10 s ≈ 29 mots (3 répliques), 15 s ≈ 44 mots (4-5 répliques). Chaque réplique est une PHRASE FRANÇAISE COMPLÈTE ET CORRECTE (sujet, vrai verbe conjugué, jamais coupée au milieu), qui RÉPOND à la précédente et fait avancer l'histoire. Jamais de mots ajoutés pour faire durer (« maintenant », « ici », « immédiatement », « absolument », « vraiment », « tout » en fin de phrase). Chaque réplique fait 5 mots minimum. Pas de « Quoi ?! » isolé. 1re réplique à 0,1 s, chacune 0,1 s après la précédente, la dernière finit 0,1-0,2 s avant la fin. Un trou se comble par une vanne, jamais par un silence. Seuls les personnages VISIBLES sur l'image parlent, jamais hors champ, jamais d'eux à la 3e personne. Chaque personnage a un vrai PRÉNOM humain (Kévin, Lila, Moussa, Inès…), jamais le nom de son fruit, de son objet ou de sa pierre ; la prononciation s'écrit en syllabes avec des tirets (« Ké-vin »), jamais en alphabet phonétique. Pas de mots rares, une voix décrite par personnage, identique dans tous les clips.

LE HOOK (les 3 premières secondes)
Résume l'histoire en UNE phrase paradoxe. Image du clip 1 = le moment le plus fort DÉJÀ EN COURS (gifle levée, valise jetée dehors, billet déchiré), jamais un décor vide, une marche ou une pose. 1re réplique à 0,1 s, 6 à 10 mots, 1er mot = le choc (chiffre, ordre, accusation, objet) ; jamais « Salut », « Alors », « Écoute » ni un prénom seul ; l'enjeu ou la menace arrive avant 3 s. Écris 5 hooks avec 5 mécaniques différentes (chiffre impossible, ordre humiliant, révélation, rêve brisé, règle absurde, cri, aveu, plan secret, vanne), garde le meilleur. Test : son coupé, on comprend l'image ? Image cachée, on comprend la phrase ? Qui, problème et enjeu compris en 3 s ; un objet, un chiffre ou un lieu précis ; aucune expression imagée. Partie 2+ : la 1re réplique repose l'idée de la série pour les nouveaux, puis le cliffhanger d'avant.

LE DYNAMISME : un changement visible toutes les 1 à 2 s. Coupe nette à chaque changement de locuteur ; une réplique de plus de 3 s = 2 plans du MÊME personnage ; un plan dure 1,5 à 3,5 s ; jamais deux fois le même cadrage de suite (plan moyen, par-dessus l'épaule, gros plan, très gros plan, contre-plongée) ; la caméra bouge à chaque plan (push-in rapide, whip pan, crash zoom sur le mot-choc, tremblement sur un choc, travelling circulaire sur une révélation) ; un geste ou un objet par plan ; ceux qui écoutent réagissent bouche fermée ; fin de clip : 0,5 s de très gros plan muet sur la réaction clé ; son : ambiance du lieu + un bruitage net par moment fort, jamais de silence.

L'ENGAGEMENT : on PROVOQUE, on ne demande pas. 2-3 leviers par partie (référence, méchant culte avec une phrase qui revient, insulte inventée et mignonne jamais sur une origine, une religion ou un handicap, réplique culte de 8 mots max, camp contre camp, UN détail à repérer, scène vécue précise, fin coupée au pic). 2 à 4 références par partie, 1 par clip max (foot, rap, jeux, mangas, séries, télé, vie de jeune : le bac, le permis, le tacos, la flamme Snap, Vinted, la batterie à 1 %). Rêves des jeunes = l'enjeu qui accroche (footballeur pro, rappeur, streamer, riche avant 25 ans, voiture de rêve, Dubaï, sortir sa famille de la galère). Au moins un déclencheur de partage. Écris le commentaire que tu veux voir en haut. Si l'histoire fournie contient une « Réplique à répéter » ou un « Jeu pour les commentaires » (issus de la veille), garde-les : ce sont la réplique culte et le commentaire visé. Grille /10 : méchant /2, débat /2, réplique culte /2, envie de partager /2, fin « PARTIE 2 VITE » /2 ; jamais « like si… » ni « commente OUI ».

DIRECTION ARTISTIQUE : long-métrage d'animation 3D. Têtes : corps humain habillé avec de vraies mains (mains et cou couleur de la tête), visage cartoon intégré (grands yeux, sourcils, bouche visible) ; forme ronde pour les gentils, anguleuse pour le méchant. Une tenue signature par personnage, sans aucun logo, marque ni texte lisible (ni sur les vêtements, ni sur les sacs, ni sur les objets). Image de départ de chaque clip : tous les personnages qui parlent, en entier, séparés, visages lisibles, en plan large ou moyen ; une ACTION EN COURS, jamais une pose ; les objets importants déjà visibles ; aucun texte. Note les raccords du clip d'avant (tache sur la chemise, nuit tombée).

GROK : un clip = une scène de dialogue montée comme un film, plusieurs plans avec une coupe nette à chaque changement de locuteur, caméra toujours en mouvement. Un lieu par clip ; deux personnages qui se ressemblent = un plan continu ; personnage magique en plan moyen ; voix au téléphone = « the lines of X come only from the phone speaker, nobody on screen moves their lips ». Effets qui marchent : transformation (a burst of golden sparkles swallows her; CUT to her transformed), magie (snapping fingers in golden sparkles), émotion (mascara running, crying), sortie (walking away, waving a hand over the shoulder).

SÉCURITÉ : inspiré, jamais copié (têtes, prénoms, décors et détails changés) ; pas de marque, logo ni personne réelle à l'image ; citer une star dans une vanne est OK, se moquer d'une vraie personne non ; tout public : ni sang, ni gore, ni sexualisation, ni gros mots.`;

// ---------------------------------------------------------------- JSON schemas (Gemini format)
const S = (description?: string) => ({ type: 'STRING', ...(description ? { description } : {}) });
const N = (description?: string) => ({ type: 'NUMBER', ...(description ? { description } : {}) });
const I = (description?: string) => ({ type: 'INTEGER', ...(description ? { description } : {}) });
const arr = (items: unknown, description?: string) => ({ type: 'ARRAY', items, ...(description ? { description } : {}) });
const obj = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: 'OBJECT', properties, required });

const line = obj({ character: S('Nom du personnage qui parle (visible sur l’image)'), start: N('Début en secondes, ex. 0.1'), end: N('Fin en secondes'), text: S('Réplique exacte en français, 6 mots minimum') });

const conceptsSchema = obj({
  concepts: arr(obj({
    title: S('Titre accrocheur'), paradox: S('L’histoire en UNE phrase paradoxe'), synopsis: S('3-4 phrases'),
    characters: arr(obj({ name: S(), head: S('Tête dans le style choisi, en français'), role: S() })),
    locations: arr(S(), '2 à 4 lieux'), hook: S('La 1re réplique choc envisagée'),
  }), 'Exactement 3 histoires très différentes'),
});

const scriptSchema = obj({
  title: S('Titre de la série'), paradox: S('Phrase paradoxe'), synopsis: S('3-4 phrases'),
  characters: arr(obj({
    name: S('Vrai prénom humain (pas le nom du fruit)'), phonetic: S('Prénom découpé en syllabes avec des tirets, ex. Ké-vin (pas d’alphabet phonétique)'),
    head: S('IN ENGLISH: the head in the chosen style, detailed (kind, colors, shape round for good guys, angular for the villain)'),
    face: S('IN ENGLISH: cartoon face details'), hands_neck: S('IN ENGLISH: color of hands and neck'),
    outfit: S('IN ENGLISH: signature outfit, complete'), accessory: S('IN ENGLISH: one accessory'),
    voice: S('IN ENGLISH: voice description, e.g. young street voice'), role: S('Rôle, en français'),
  }), '3 à 5 personnages'),
  locations: arr(S(), '2 à 4 lieux'),
  hook_candidates: arr(obj({ mechanic: S('Mécanique (chiffre impossible, ordre humiliant…)'), line: S('Réplique de 6 à 10 mots, 1er mot = le choc') }), 'Exactement 5 hooks, 5 mécaniques différentes'),
  hook: obj({ image: S('Ce que montre l’image du clip 1 : le moment le plus fort déjà en cours'), why: S('Pourquoi ce hook est le meilleur, en une phrase') }),
  backup_hooks: arr(obj({ image: S(), line: S() }), 'Exactement 2 hooks de rechange'),
  clips: arr(obj({
    seconds: I('6, 10 ou 15'), location: S('Un seul lieu'), characters: arr(S(), 'Personnages visibles (3 max)'),
    summary: S('Ce qui se passe, en une phrase'), open_question: S('La question ouverte pour le spectateur'),
    new_thing: S('Ce qui est nouveau dans ce clip'), mini_hook: S('Le mini-hook de fin de clip'),
    lines: arr(line, 'Répliques minutées : phrases complètes et naturelles, 2,6 à 3,2 mots/s'),
  }), 'Entre 2 et 9 clips, à la durée totale imposée'),
  engagement: obj({
    levers: arr(S(), '2-3 leviers'), references: arr(S(), '2 à 4 références et le clip où elles sont placées'),
    cult_line: S('Réplique culte, 8 mots max'), target_comment: S('Le commentaire visé en haut'),
    scores: obj({ villain: I('/2'), debate: I('/2'), cult_line: I('/2'), share: I('/2'), part2: I('/2'), detail: I('bonus 0 ou 1') }),
  }),
  cliffhanger: S('Le cliffhanger final'),
});

const imagesSchema = obj({
  sheet: arr(obj({ name: S(), description: S('IN ENGLISH: full description: head + face + color of hands and neck + complete outfit + accessory, to be copied word for word in every image prompt') }), 'Un élément par personnage'),
  clips: arr(obj({
    setting: S('IN ENGLISH: the set in one rich sentence'),
    characters: arr(obj({ name: S(), action: S('IN ENGLISH: action in progress, emotion, position') })),
    continuity: S('IN ENGLISH: continuity notes from the previous clip, or empty'),
  }), 'Un élément par clip, dans l’ordre'),
});

const videosSchema = obj({
  clips: arr(obj({
    head_lock: arr(obj({ name: S(), head: S('IN ENGLISH: the head in a few words') })),
    look_lock: S('IN ENGLISH: optional LOOK LOCK for a magic or ambiguous character ("It is NOT a …"), or empty'),
    shots: arr(obj({ start: N(), end: N(), text: S('IN ENGLISH: framing + camera move + who is TALKING + gesture; listeners mouths closed') }), 'Un plan par réplique (2 si plus de 3 s), mêmes minutages que le dialogue'),
    sound: S('IN ENGLISH: ambience of the place + 1 to 3 sound effects timed on the strong moments'),
  }), 'Un élément par clip, dans l’ordre'),
});

const packSchema = obj({
  cover: obj({ setting: S('IN ENGLISH: the most iconic set'), characters: arr(obj({ name: S(), pose: S('IN ENGLISH: strong emotion or iconic pose') })), glow: S('IN ENGLISH: a glow color for the title') }),
  caption: S('Une phrase qui donne envie + un emoji + « Partie N »'),
  pinned_comment: S('Un camp ou une théorie'),
  hashtags: arr(S('Un hashtag avec #'), '3 à 5 hashtags de niche'),
});

const fixSchema = obj({
  lines: arr(line, 'Les répliques corrigées du clip (ou les mêmes)'),
  shots: arr(obj({ start: N(), end: N(), text: S() })),
  head_lock: arr(obj({ name: S(), head: S() })),
  look_lock: S(), sound: S(),
  image: obj({ setting: S(), characters: arr(obj({ name: S(), action: S() })), continuity: S() }),
  explanation: S('En français, ce que tu as corrigé, en une phrase'),
});

export const PHASES: Record<PhaseKey, { number: 1 | 2 | 3 | 4 | 5; key: string; label: string; schema: unknown; requires: string[]; invalidates: string[] }> = {
  concepts: { number: 1, key: 'concepts', label: 'Histoires', schema: conceptsSchema, requires: [], invalidates: ['chosen', 'script', 'images', 'videos', 'pack'] },
  script: { number: 2, key: 'script', label: 'Pitch & découpage', schema: scriptSchema, requires: [], invalidates: ['images', 'videos', 'pack'] },
  images: { number: 3, key: 'images', label: 'Prompts image', schema: imagesSchema, requires: ['script'], invalidates: ['videos'] },
  videos: { number: 4, key: 'videos', label: 'Prompts Grok', schema: videosSchema, requires: ['script', 'images'], invalidates: [] },
  pack: { number: 5, key: 'pack', label: 'Couverture & légende', schema: packSchema, requires: ['script'], invalidates: [] },
};
export const FIX_SCHEMA = fixSchema;

export const FIX_PROBLEMS: Record<string, { label: string; rule: string }> = {
  slow: { label: 'Ralenti ou blancs', rule: 'Ajoute une réplique utile ou une vanne (jamais des mots de remplissage) pour atteindre 2,6-3,2 mots/s, répliques collées.' },
  flat: { label: 'Mou, pas assez dynamique', rule: 'Plans plus courts (1,5-3 s), cadrage différent à chaque plan, un geste par plan, crash zooms sur les mots-chocs.' },
  speaker: { label: 'Le mauvais personnage parle', rule: 'Rallonge chaque réplique à 6 mots minimum et précise dans chaque plan « the camera stays on X\'s face for his whole line ».' },
  look: { label: 'L’apparence change', rule: 'Complète le HEAD LOCK et ajoute un LOOK LOCK (« It is NOT a … »), privilégie les plans moyens.' },
  invented: { label: 'Un personnage ou objet inventé', rule: 'Il manquait sur l’image de départ : réécris l’image du clip (image.setting, image.characters) pour que tous les personnages qui parlent et les objets importants y soient visibles.' },
  continuity: { label: 'Un détail change d’un clip à l’autre', rule: 'Écris le raccord précis dans image.continuity.' },
  name: { label: 'Prénom mal dit', rule: 'Écris le prénom phonétiquement dans les répliques.' },
  hook: { label: 'Hook mou (clip 1)', rule: 'Dis ce qu’il rate, garde la meilleure de 3 nouvelles mécaniques, et refais l’image (action déjà en cours) et les répliques du clip 1 (1er mot = le choc, enjeu avant 3 s).' },
};

/** the three video lengths a customer can pick (the script is written for it); 45 s is the default */
export type VideoLength = 30 | 45 | 60;
export const VIDEO_LENGTHS: VideoLength[] = [30, 45, 60];
export const DEFAULT_VIDEO_LENGTH: VideoLength = 45;
export const isVideoLength = (n: unknown): n is VideoLength => n === 30 || n === 45 || n === 60;
/** total clip seconds the script aims for, per length */
/** "1 min" stays above 60 s: TikTok's Creator Rewards only pay videos longer than one minute */
export const LENGTH_RANGE: Record<VideoLength, [number, number]> = { 30: [28, 34], 45: [42, 50], 60: [61, 68] };
/** the length a project's script is written for (projects made before the choice existed were a minute) */
export const projectLength = (ctx: Record<string, any>): VideoLength => (isVideoLength(ctx?.length) ? ctx.length : ctx?.script ? 60 : DEFAULT_VIDEO_LENGTH);
export const lengthLabel = (n: VideoLength) => (n === 60 ? '1 min' : `${n} s`);
const lengthRule = (n: VideoLength) => {
  const [lo, hi] = LENGTH_RANGE[n];
  const plan = n === 30 ? '2 ou 3 clips (ex. 6 + 10 + 15)' : n === 45 ? '4 ou 5 clips (ex. 6 + 10 + 15 + 15)' : '5 ou 6 clips (ex. 6 + 10 + 15 + 15 + 15), toujours plus de 60 s';
  return `DURÉE IMPOSÉE : ${lo} à ${hi} s au total, soit ${plan}. Additionne et vérifie.`;
};

// ---------------------------------------------------------------- user turns
export function buildPhasePrompt(phase: PhaseKey, ctx: Record<string, any>): string {
  const st = STYLES[styleOf(ctx.style)];
  const cast = castOf(ctx);
  const uk = ctx.universe; const uni = isUniverse(uk) ? UNIVERSES[uk] : null;
  const uniLine = uni ? `Univers visuel verrouillé : ${uni.label} (${uni.hint}). Personnages adultes au visage humain réaliste et aux proportions adultes, jamais de visage de bébé.${ctx.universe === 'perso' ? ' Le style visuel est celui que décrit l’utilisateur dans son histoire.' : ''}` : '';
  const style = cast.length ? `${castLine(cast)}${uniLine ? `\n${uniLine}` : ''}` : uniLine || `Style verrouillé : ${st.emoji} ${st.label} (${st.text} ${st.ruleFr})`;
  const part = Number(ctx.part ?? 1) > 1 ? `\nC'est la PARTIE ${ctx.part}. Fin de la partie précédente : ${ctx.previous_end ?? ''}` : '';
  const tweak = ctx.feedback ? `\nAjustements demandés par l'utilisateur : ${ctx.feedback}` : '';
  const story = ctx.concepts?.[ctx.chosen ?? -1] ? `Histoire choisie : ${JSON.stringify(ctx.concepts[ctx.chosen])}` : `Histoire de l'utilisateur (même en vrac ; comble les vides) : ${ctx.story ?? ''}`;
  switch (phase) {
    case 'concepts': {
      const t = ctx.trends as { insights?: string; concepts?: { title: string; fr_status: string | null; hook: string; ending: string; repeat_line: string; screen_line: string }[] } | undefined;
      const veille = t?.concepts?.length
        ? `\nVEILLE DU JOUR (ce qui cartonne en ce moment, chiffres réels) :\n${String(t.insights ?? '').slice(0, 3500)}\nExemples de concepts du jour (🟢 = aucune version française encore) :\n${t.concepts.map((c) => `- ${c.fr_status === 'green' ? '🟢 ' : ''}${c.title} — hook : ${c.hook.replace(/\n/g, ' / ').slice(0, 260)} — fin : ${c.ending.slice(0, 200)} — 🔁 ${c.repeat_line} — 💬 ${c.screen_line}`).join('\n')}\nAppuie-toi sur ces formats qui marchent (mécanique, type de hook, type de fin, réplique à répéter, jeu en commentaire), en priorité ceux sans version française, mais n'en recopie aucun : change les têtes, les prénoms, les décors et 2-3 détails, et donne à chaque histoire son propre hook. Dans "hook", donne la 1re réplique choc ; termine le synopsis par la réplique à répéter et le jeu pour les commentaires.`
        : '';
      return `${style}\nPropose 3 histoires de mini-drama très différentes, pensées pour une vidéo de ${lengthLabel(projectLength(ctx))} (${LENGTH_RANGE[projectLength(ctx)].join(' à ')} s), avec un enjeu qui accroche les jeunes, un méchant, 2 à 4 lieux et un cliffhanger possible.${veille}${ctx.story ? `\nPiste de l'utilisateur : ${ctx.story}` : ''}${tweak}`;
    }
    case 'script':
      return `${style}${part}\n${story}\nLivre : le PITCH (titre, phrase paradoxe, synopsis, 3 à 5 personnages avec prénom phonétique, tête, visage, mains et cou, tenue signature, accessoire, voix), les lieux, les 5 hooks avec 5 mécaniques, le hook retenu (image + pourquoi), 2 hooks de rechange, le DÉCOUPAGE en clips de 6, 10 ou 15 s (${lengthRule(projectLength(ctx))} Clip 1 = le hook retenu) avec pour chaque clip : lieu, personnages visibles, résumé, question ouverte, ce qui est nouveau, mini-hook et répliques qui remplissent tout le clip. BUDGET DE MOTS (compte-les, tous les mots de toutes les répliques du clip) : clip de 6 s = 15 à 19 mots en 2 répliques, 10 s = 26 à 32 mots en 3 répliques, 15 s = 40 à 48 mots en 4-5 répliques ; 5 mots minimum par réplique. LE SENS AVANT TOUT : chaque réplique est une phrase complète, avec un vrai verbe, qu'un ado dirait vraiment, et qui répond à la précédente ; jamais de mots de remplissage pour faire le compte, jamais de phrase coupée. Relis chaque clip à voix haute dans ta tête avant de répondre. Les minutages sont recalculés par le code, l'ENGAGEMENT (leviers, références placées, réplique culte, commentaire visé, notes) et le cliffhanger. Vérifie tes calculs avant de répondre.${tweak}`;
    case 'images':
      return `${style}\nPitch et découpage validés : ${JSON.stringify(ctx.script)}\nLivre la PLANCHE (pour chaque personnage, une description complète en anglais : tête + visage + couleur des mains et du cou + tenue complète + accessoire ; elle sera recopiée mot pour mot) puis, pour CHAQUE clip dans l'ordre, l'image de départ : décor en une phrase riche, pour chaque personnage visible son action en cours (jamais une pose), son émotion et sa position, et les raccords du clip d'avant. Tous les personnages qui parlent dans le clip doivent être sur l'image.${tweak}`;
    case 'videos':
      return `${style}\nDécoupage validé (les répliques et minutages sont définitifs) : ${JSON.stringify(ctx.script?.clips)}\nPersonnages : ${JSON.stringify(ctx.script?.characters)}\nImages de départ : ${JSON.stringify(ctx.images?.clips)}\nPour CHAQUE clip dans l'ordre : le HEAD LOCK (chaque personnage visible et sa tête en quelques mots), un LOOK LOCK si un personnage est magique ou ambigu, la SHOT LIST (un plan par réplique aux mêmes minutages, 2 plans du même personnage si la réplique dure plus de 3 s ; chaque plan = cadrage + mouvement + qui parle + geste ; jamais deux fois le même cadrage de suite ; 0,5 s finale = très gros plan muet de la réaction clé) et le SON (ambiance + 1 à 3 bruitages calés).${tweak}`;
    case 'pack':
      return `${style}${part}\nPitch validé : ${JSON.stringify({ title: ctx.script?.title, paradox: ctx.script?.paradox, characters: ctx.script?.characters, locations: ctx.script?.locations, engagement: ctx.script?.engagement, cliffhanger: ctx.script?.cliffhanger })}\nLivre la COUVERTURE (décor le plus iconique, 2 personnages avec une émotion forte ou une pose iconique, couleur de lueur du titre), la LÉGENDE (une phrase qui donne envie + un emoji + « Partie ${ctx.part ?? 1} »${Number(ctx.part ?? 1) > 1 ? ' + « partie 1 sur mon profil »' : ''}), le COMMENTAIRE ÉPINGLÉ (un camp ou une théorie) et 3 à 5 hashtags de niche.${tweak}`;
  }
}

export function buildFixPrompt(ctx: Record<string, any>, index: number, problem: string, note: string): string {
  const p = FIX_PROBLEMS[problem] ?? FIX_PROBLEMS.flat!;
  return `${`Style verrouillé : ${lookOf(ctx).label}`}\nDÉPANNAGE du clip ${index + 1} uniquement. Problème : ${p.label}. Règle : ${p.rule}${note ? `\nPrécision de l'utilisateur : ${note}` : ''}
Personnages : ${JSON.stringify(ctx.script?.characters)}
Clip (découpage) : ${JSON.stringify(ctx.script?.clips?.[index])}
Image de départ actuelle : ${JSON.stringify(ctx.images?.clips?.[index] ?? null)}
Prompt Grok actuel : ${JSON.stringify(ctx.videos?.clips?.[index] ?? null)}
Renvoie la version corrigée complète de CE clip : répliques minutées (même durée de clip), plans, head_lock, look_lock, son, image de départ, et une explication.`;
}

// ---------------------------------------------------------------- normalisation
const str = (v: unknown, max = 4000) => String(v ?? '').trim().slice(0, max);
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 10) / 10 : d);
function listOf(raw: any, key: string): any[] {
  if (Array.isArray(raw?.[key])) return raw[key];
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    for (const v of Object.values(raw)) if (Array.isArray(v) && v.some((x) => x && typeof x === 'object')) return v as any[];
  }
  return [];
}
export type Line = { character: string; start: number; end: number; text: string };
const lines = (l: unknown): Line[] => (Array.isArray(l) ? l : []).map((x: any) => ({ character: str(x?.character, 60), start: num(x?.start), end: num(x?.end), text: str(x?.text, 400) })).filter((x) => x.text);
const clipSeconds = (s: unknown) => { const n = Number(s); return n >= 13 ? 15 : n >= 8 ? 10 : 6; };
/** Models are poor at timestamps: the code times the lines itself, by word count, exactly as the rules say
 *  (first line at 0.1 s, 0.1 s between two lines, the last one ends 0.15 s before the end of the clip). */
export function retime(seconds: number, ls: Line[]): Line[] {
  if (!ls.length) return ls;
  const gap = 0.1, startAt = 0.1, endAt = seconds - 0.15;
  const speak = Math.max(0.5, endAt - startAt - gap * (ls.length - 1));
  const total = ls.reduce((a, l) => a + Math.max(1, words(l.text)), 0);
  let t = startAt;
  return ls.map((l, k) => {
    const d = (speak * Math.max(1, words(l.text))) / total;
    const start = Math.round(t * 10) / 10;
    const end = k === ls.length - 1 ? Math.round(endAt * 10) / 10 : Math.round((t + d) * 10) / 10;
    t = end + gap;
    return { ...l, start, end };
  });
}

export function normalizePhase(phase: PhaseKey, raw: any): any {
  switch (phase) {
    case 'concepts': {
      const list = listOf(raw, 'concepts').slice(0, 3).map((c: any) => ({
        title: str(c.title, 120), paradox: str(c.paradox, 300), synopsis: str(c.synopsis, 1200), hook: str(c.hook, 200),
        characters: (Array.isArray(c.characters) ? c.characters : []).slice(0, 5).map((p: any) => ({ name: str(p.name, 40), head: str(p.head, 120), role: str(p.role, 120) })),
        locations: (Array.isArray(c.locations) ? c.locations : []).slice(0, 4).map((l: unknown) => str(l, 120)),
      }));
      if (list.length === 0) throw new Error('Aucune histoire reçue. Réessayez.');
      return list;
    }
    case 'script': {
      const clips = listOf(raw, 'clips').slice(0, 10).map((c: any) => ({
        seconds: clipSeconds(c.seconds), location: str(c.location, 160), characters: (Array.isArray(c.characters) ? c.characters : []).slice(0, 3).map((x: unknown) => str(x, 40)),
        summary: str(c.summary, 400), open_question: str(c.open_question, 300), new_thing: str(c.new_thing, 300), mini_hook: str(c.mini_hook, 300), lines: lines(c.lines),
      })).filter((c) => c.lines.length).map((c) => ({ ...c, lines: retime(c.seconds, c.lines) }));
      if (clips.length < 2) throw new Error('Découpage trop court reçu. Réessayez.');
      const sc = raw?.engagement?.scores ?? {};
      const cap = (v: unknown, m: number) => Math.max(0, Math.min(m, Math.round(Number(v) || 0)));
      return {
        title: str(raw?.title, 120) || 'Mini-drama', paradox: str(raw?.paradox, 300), synopsis: str(raw?.synopsis, 1500),
        characters: (Array.isArray(raw?.characters) ? raw.characters : []).slice(0, 5).map((p: any) => ({
          name: str(p.name, 40), phonetic: str(p.phonetic, 60), head: str(p.head, 400), face: str(p.face, 300), hands_neck: str(p.hands_neck, 120),
          outfit: str(p.outfit, 400), accessory: str(p.accessory, 160), voice: str(p.voice, 160), role: str(p.role, 160),
        })),
        locations: (Array.isArray(raw?.locations) ? raw.locations : []).slice(0, 4).map((l: unknown) => str(l, 160)),
        hook_candidates: (Array.isArray(raw?.hook_candidates) ? raw.hook_candidates : []).slice(0, 5).map((h: any) => ({ mechanic: str(h.mechanic, 80), line: str(h.line, 200) })),
        hook: { image: str(raw?.hook?.image, 500), why: str(raw?.hook?.why, 400) },
        backup_hooks: (Array.isArray(raw?.backup_hooks) ? raw.backup_hooks : []).slice(0, 2).map((h: any) => ({ image: str(h.image, 400), line: str(h.line, 200) })),
        clips,
        engagement: {
          levers: (raw?.engagement?.levers ?? []).slice?.(0, 4).map((x: unknown) => str(x, 200)) ?? [],
          references: (raw?.engagement?.references ?? []).slice?.(0, 5).map((x: unknown) => str(x, 200)) ?? [],
          cult_line: str(raw?.engagement?.cult_line, 120), target_comment: str(raw?.engagement?.target_comment, 200),
          scores: { villain: cap(sc.villain, 2), debate: cap(sc.debate, 2), cult_line: cap(sc.cult_line, 2), share: cap(sc.share, 2), part2: cap(sc.part2, 2), detail: cap(sc.detail, 1) },
        },
        cliffhanger: str(raw?.cliffhanger, 400),
      };
    }
    case 'images': {
      const sheet = listOf(raw, 'sheet').slice(0, 5).map((c: any) => ({ name: str(c.name, 40), description: str(c.description, 900) })).filter((c) => c.name && c.description);
      const clips = (Array.isArray(raw?.clips) ? raw.clips : []).slice(0, 10).map((c: any) => ({
        setting: str(c.setting, 600), continuity: str(c.continuity, 400),
        characters: (Array.isArray(c.characters) ? c.characters : []).slice(0, 3).map((p: any) => ({ name: str(p.name, 40), action: str(p.action, 400) })),
      }));
      if (!sheet.length || clips.length < 2) throw new Error('Prompts image incomplets reçus. Réessayez.');
      return { sheet, clips };
    }
    case 'videos': {
      const clips = (Array.isArray(raw?.clips) ? raw.clips : listOf(raw, 'clips')).slice(0, 10).map((c: any) => ({
        head_lock: (Array.isArray(c.head_lock) ? c.head_lock : []).slice(0, 3).map((h: any) => ({ name: str(h.name, 40), head: str(h.head, 200) })),
        look_lock: str(c.look_lock, 500),
        shots: (Array.isArray(c.shots) ? c.shots : []).slice(0, 12).map((s: any) => ({ start: num(s.start), end: num(s.end), text: str(s.text, 400) })).filter((s: any) => s.text),
        sound: str(c.sound, 400),
      }));
      // a clip without shots is rebuilt from its lines by retimeShots (close-ups of each speaker): only an empty answer is rejected
      if (clips.length < 2 || clips.every((c: any) => !c.shots.length)) throw new Error('Prompts Grok incomplets reçus. Réessayez.');
      return { clips };
    }
    case 'pack':
      return {
        cover: {
          setting: str(raw?.cover?.setting, 500), glow: str(raw?.cover?.glow, 40) || 'golden',
          characters: (Array.isArray(raw?.cover?.characters) ? raw.cover.characters : []).slice(0, 2).map((c: any) => ({ name: str(c.name, 40), pose: str(c.pose, 300) })),
        },
        caption: str(raw?.caption, 600), pinned_comment: str(raw?.pinned_comment, 300),
        hashtags: [...new Set((Array.isArray(raw?.hashtags) ? raw.hashtags : []).flatMap((h: unknown) => str(h, 200).split(/[\s,]+/))
          .map((h: string) => '#' + h.trim().replace(/^#+/, '').replace(/\s+/g, '').slice(0, 40)))].filter((h): h is string => typeof h === 'string' && h.length > 2).slice(0, 5),
      };
  }
}

/** clips whose word count is out of the natural 2.6-3.2 words/s budget (tolerance 2.3-3.5) */
export const BUDGET: Record<number, [number, number]> = { 6: [15, 19], 10: [26, 32], 15: [40, 48] };
export function paceProblems(script: any): { clip: number; words: number; target: [number, number] }[] {
  const first = script?.clips?.[0]?.lines?.[0];
  const hook = first ? words(first.text) : 8;
  const out = (script?.clips ?? []).map((c: any, i: number) => {
    const w = c.lines.reduce((a: number, l: Line) => a + words(l.text), 0);
    const wps = w / c.seconds;
    return wps < 2.3 || wps > 3.5 ? { clip: i + 1, words: w, target: BUDGET[c.seconds] ?? [Math.round(c.seconds * 2.6), Math.round(c.seconds * 3.2)] } : null;
  }).filter(Boolean) as { clip: number; words: number; target: [number, number] }[];
  if (hook < 6 || hook > 10) out.push({ clip: 0, words: hook, target: [6, 10] }); // clip 0 = the hook line itself
  return out;
}
const FILLERS = /\b(maintenant|ici|immédiatement|absolument|vraiment|totalement|sinistrement|enfin|tout)\s*[.!?…]*$/i;
const DANGLING = /\b(le|la|les|un|une|des|du|de|d’|d'|à|au|aux|dans|pour|par|sur|sous|avec|sans|et|ou|mais|que|qui|ce|ces|son|sa|ses|mon|ma|mes|ton|ta|tes|notre|votre|leur|leurs|nous|vous|se|en)\s*[.!?…]*$/i;
/** lines that read as broken: cut in the middle, padded with a filler word, or the same word twice in a row */
export function senseProblems(script: any): { clip: number; character: string; text: string; issue: string }[] {
  const out: { clip: number; character: string; text: string; issue: string }[] = [];
  (script?.clips ?? []).forEach((c: any, i: number) => (c.lines ?? []).forEach((l: Line) => {
    const t = String(l.text ?? '').trim();
    const issue = DANGLING.test(t) ? 'phrase coupée au milieu' : FILLERS.test(t) ? 'mot de remplissage en fin de phrase'
      : /\b(\p{L}+)\s+\1\b/iu.test(t) ? 'mot répété' : words(t) < 4 ? 'réplique trop courte' : '';
    if (issue) out.push({ clip: i + 1, character: l.character, text: t, issue });
  }));
  return out;
}
/** second AI pass: a script editor checks that every line makes sense and fixes what does not */
export function buildReviewPrompt(script: any): string {
  const pace = paceProblems(script), sense = senseProblems(script);
  return `Tu es le RELECTEUR du découpage ci-dessous, avant qu'il soit animé et doublé. Voici le découpage : ${JSON.stringify(script)}
Vérifie et CORRIGE les répliques, clip par clip :
1. Chaque réplique est une phrase française complète et correcte (sujet, vrai verbe conjugué), jamais coupée, jamais une suite de mots sans lien.
2. Chaque réplique répond à la précédente ou réagit à ce qui se passe : la conversation a une logique, l'histoire se suit d'un clip à l'autre, on comprend qui veut quoi.
3. Ça sonne comme un vrai ado qui parle : simple, naturel, drôle ou tendu, sans mots rares ni tournures de poème.
4. Aucun mot de remplissage pour faire durer (« maintenant », « ici », « immédiatement », « absolument », « vraiment » en fin de phrase).
5. Rythme naturel : 2,6 à 3,2 mots/s (6 s = 15 à 19 mots, 10 s = 26 à 32 mots, 15 s = 40 à 48 mots, en comptant tous les mots du clip), 5 mots minimum par réplique, 1re réplique du clip 1 = le hook de 6 à 10 mots.
${sense.length ? `Problèmes déjà repérés :\n${sense.map((p) => `- clip ${p.clip}, ${p.character} : « ${p.text} » → ${p.issue}`).join('\n')}\n` : ''}${pace.filter((p) => p.clip > 0).length ? `Clips hors budget de mots : ${pace.filter((p) => p.clip > 0).map((p) => `clip ${p.clip} (${p.words} mots, il en faut ${p.target[0]} à ${p.target[1]})`).join(', ')}\n` : ''}Garde les mêmes personnages, les mêmes lieux, la même histoire, le même nombre de clips et les mêmes durées. Ne change que les répliques qui en ont besoin. Renvoie le JSON complet du découpage, identique pour tout le reste.`;
}
export function buildRepairPrompt(script: any, problems: { clip: number; words: number; target: [number, number] }[]): string {
  return `Voici ton découpage : ${JSON.stringify(script)}
Ces clips ne respectent pas le budget de mots (rythme naturel : 2,6 à 3,2 mots/s) :
${problems.map((p) => (p.clip === 0 ? `- la 1re réplique du clip 1 (le hook) : ${p.words} mots, il en faut entre 6 et 10, 1er mot = le choc (le reste du clip 1 garde son budget)` : `- clip ${p.clip} : ${p.words} mots, il en faut entre ${p.target[0]} et ${p.target[1]}`)).join('\n')}
Réécris UNIQUEMENT les répliques de ces clips pour tomber dans le budget (compte les mots), sans mots de remplissage, en gardant des phrases complètes qui ont du sens, les personnages, le ton et 5 mots minimum par réplique. Renvoie le JSON complet du découpage, identique pour tout le reste.`;
}

/** The shot list follows the dialogue: one shot per line, two shots of the same speaker when a line lasts over 3.5 s.
 *  The model writes what each shot shows; the code sets the timings so they always match the lines. */
export function retimeShots(lines: Line[], shots: { start: number; end: number; text: string }[]) {
  const slots: { start: number; end: number; line: Line }[] = [];
  for (const l of lines) {
    if (l.end - l.start > 3.5) { const mid = Math.round(((l.start + l.end) / 2) * 10) / 10; slots.push({ start: l.start, end: mid, line: l }, { start: mid, end: l.end, line: l }); }
    else slots.push({ start: l.start, end: l.end, line: l });
  }
  if (slots.length) { slots[0]!.start = 0; slots[slots.length - 1]!.end = Math.round((slots[slots.length - 1]!.end + 0.15) * 10) / 10; }
  for (let k = 1; k < slots.length; k++) slots[k]!.start = slots[k - 1]!.end; // hard cuts, no gap between shots
  const texts = shots.map((x) => x.text);
  return slots.map((sl, k) => {
    const i = slots.length === 1 ? 0 : Math.round((k * Math.max(0, texts.length - 1)) / (slots.length - 1));
    const text = texts[i] ?? `CUT to a close-up of ${upper(sl.line.character)} TALKING`;
    const mentions = new RegExp(sl.line.character.normalize('NFD').replace(/[\u0300-\u036f]/g, ''), 'i').test(text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    return { start: sl.start, end: sl.end, text: mentions ? text : `${text}; ${upper(sl.line.character)} TALKING, the camera stays on ${upper(sl.line.character)}'s face for the whole line` };
  });
}

// ---------------------------------------------------------------- prompt builders (word for word)
/** a clause inside a sentence: no trailing period, so the builders never print ".." */
const cl = (t: unknown) => String(t ?? '').trim().replace(/[\s.;,]+$/u, '');
type Char = { name: string; phonetic?: string; head: string; face?: string; hands_neck?: string; outfit: string; accessory?: string; voice?: string };
const upper = (s: string) => s.toUpperCase();
const sheetDesc = (images: any, name: string, script: any) =>
  images?.sheet?.find((c: any) => c.name.toLowerCase() === name.toLowerCase())?.description
  ?? (() => { const c: Char | undefined = script?.characters?.find((x: Char) => x.name.toLowerCase() === name.toLowerCase()); return c ? [c.head, c.face, c.hands_neck && `${c.hands_neck} hands and neck`, c.outfit, c.accessory].filter(Boolean).join(', ') : ''; })();

export function sheetPrompt(d: any): string {
  const st = lookOf(d);
  const sheet: { name: string; description: string }[] = d.images?.sheet ?? [];
  return `Crée une image. Generate this image in 9:16 vertical format. Character reference sheet, ${sheet.length} characters standing side by side, full body, front view, neutral light grey background, each clearly separated${castOf(d).length ? ', each one copied exactly from its own attached reference sheet' : ''}: ${sheet.map((c) => `${upper(c.name)}: ${cl(c.description)}.`).join(' ')} ${st.block}`;
}

export function imagePrompt(d: any, i: number): string {
  const st = lookOf(d);
  const c = d.images?.clips?.[i];
  if (!c) return '';
  const people = c.characters.map((p: any) => `${upper(p.name)}, ${cl(sheetDesc(d.images, p.name, d.script))}, ${cl(p.action)}`).join('; ');
  const together = c.characters.length > 1 ? `${c.characters.length === 2 ? 'Both' : 'All'} fully visible, well separated, face to face, faces clearly readable.` : 'Fully visible, face clearly readable.';
  return `Crée une image. Generate this image in 9:16 vertical format. Same characters as the attached character reference sheet. Setting: ${cl(c.setting)}. ${people}. ${together}${cl(c.continuity) ? ` Continuity from the previous clip: ${cl(c.continuity)}.` : ''} ${st.block}`;
}

export function grokPrompt(d: any, i: number): string {
  const st = lookOf(d);
  const clip = d.script?.clips?.[i];
  const v = d.videos?.clips?.[i];
  if (!clip || !v) return '';
  const chars: Char[] = d.script?.characters ?? [];
  const visible = clip.characters.length ? clip.characters : [...new Set(clip.lines.map((l: Line) => l.character))];
  const names = visible.map(upper);
  const heads = v.head_lock.length ? v.head_lock : visible.map((n: string) => ({ name: n, head: chars.find((c) => c.name === n)?.head ?? '' }));
  const voice = (n: string) => chars.find((c) => c.name.toLowerCase() === n.toLowerCase())?.voice;
  const seen = new Set<string>();
  const dialogue = clip.lines.map((l: Line) => {
    const first = !seen.has(l.character); seen.add(l.character);
    const vc = first && voice(l.character) ? ` (${voice(l.character)})` : '';
    return `${upper(l.character)}${vc} ${l.start.toFixed(1)}-${l.end.toFixed(1)}s: « ${l.text.replace(/^[«"\s]+|[»"\s]+$/g, '')} »`;
  }).join('\n');
  const pron = chars.filter((c) => c.phonetic && visible.some((n: string) => n.toLowerCase() === c.name.toLowerCase())).map((c) => `"${c.name}" = "${c.phonetic}"`).join(', ');
  const list = (a: string[]) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
  return [
    `① Animate this image: ${clip.seconds}-second vertical 9:16 clip, the image is the first frame. MULTI-SHOT scene edited like a Pixar movie: hard cuts between camera angles, each cut lands exactly when the speaker changes. Same characters, same outfits, same ${st.heads}, same set and same light in every shot; faces and proportions never change; no new characters appear; no morphing, no crossfade.`,
    `② HEAD LOCK: ${list(names)} ALWAYS keep their heads exactly as in the first frame (${heads.map((h: any) => `${upper(h.name)}: ${h.head}`).join(', ')}), with NOTHING else on their head; same outfits in every shot.${v.look_lock ? `\n${v.look_lock}` : ''}`,
    `③ SPEAKER LOCK: during each line's time range, the shot shows the face of THAT speaker and ONLY that speaker's mouth moves; the camera never cuts away mid-line; listeners keep their mouths CLOSED; nobody speaks off-screen.`,
    `④ PACE: lively but NATURAL speech, about 3 words per second, every word articulated clearly and pronounced exactly as written, the first word at 0.1s, no long pauses, no slow motion; each line starts right when the previous one ends.`,
    `⑤ Camera always moving: fast push-ins, whip pans on cuts, crash zoom on the key word, slight handheld shake on shocks. Every shot lasts 1.5-3.5 s and never repeats the previous framing; something new happens every 1-2 s. Big expressive cartoon acting with a gesture in every shot; listeners react with mouths closed. The last half-second is a silent extreme close-up of the key reaction.${i === 0 ? ' Fast push-in from the very first frame, a sharp sound effect at 0.0s, cut to the reaction around 2s.' : ''}`,
    `⑥ SHOT LIST:\n${retimeShots(clip.lines, v.shots).map((s) => `${s.start.toFixed(1)}-${s.end.toFixed(1)}s ${s.text}`).join('\n')}`,
    `⑦ DIALOGUE (in French, spoken clearly at a natural pace, word for word):\n${dialogue}`,
    `⑧ ${pron ? `PRONUNCIATION: ${pron}.\n` : ''}SOUND: ${cl(v.sound)}.\nNo music, no subtitles, no text.`,
  ].join('\n\n');
}

export function coverPrompt(d: any): string {
  const c = d.pack?.cover;
  if (!c) return '';
  const title = d.script?.title ?? '';
  const part = Number(d.part ?? 1);
  const names = c.characters.map((x: any) => upper(x.name));
  return `Crée une image. Generate this image in 3:4 vertical format (portrait, 1080x1440). TikTok cover poster, Pixar 3D animated movie style, ultra detailed. Use ${names.join(' and ')} exactly as in the attached character reference sheet. Setting: ${cl(c.setting)}. ${c.characters.map((x: any) => `${upper(x.name)} ${cl(x.pose)}`).join(', ')}, ${names.length > 1 ? 'both' : ''} large, fully readable, filling the frame. In the middle, big bold 3D title text in white letters with a thick black outline and a ${c.glow} glow: « ${title} », and just below a smaller dark banner with « PARTIE ${part} ». Spelling exactly: ${title} / PARTIE ${part}. The title must not cover the faces. High contrast, saturated rich colors, warm rim light. No other text, no logo, no watermark.`;
}

// ---------------------------------------------------------------- checks (shown as the checklist)
export const words = (t: string): number => t.replace(/[«»"“”…!?.,;:()—–-]/g, ' ').split(/\s+/).filter(Boolean).length;
export function clipStats(clip: { seconds: number; lines: Line[] }) {
  const w = clip.lines.reduce((s, l) => s + words(l.text), 0);
  const short = clip.lines.filter((l) => words(l.text) < 6).length;
  const first = clip.lines[0]?.start ?? 0;
  const last = clip.lines[clip.lines.length - 1]?.end ?? 0;
  let gaps = 0;
  for (let k = 1; k < clip.lines.length; k++) if (clip.lines[k]!.start - clip.lines[k - 1]!.end > 0.35) gaps++;
  return { words: w, wps: clip.seconds ? w / clip.seconds : 0, short, first, tail: clip.seconds - last, gaps };
}
export type Check = { ok: boolean; label: string; detail: string };
export function checklist(d: any): Check[] {
  const s = d.script;
  if (!s) return [];
  const clips: { seconds: number; lines: Line[]; mini_hook: string }[] = s.clips ?? [];
  const total = clips.reduce((a, c) => a + c.seconds, 0);
  // projects written before the length choice were 66-75 s
  const range: [number, number] = isVideoLength(d.length) ? LENGTH_RANGE[d.length as VideoLength] : [61, 75];
  const stats = clips.map(clipStats);
  const hookLine = clips[0]?.lines?.[0];
  const hookWords = hookLine ? words(hookLine.text) : 0;
  const badPace = stats.map((x, i) => (x.wps < 2.3 || x.wps > 3.5 ? i + 1 : 0)).filter(Boolean);
  const shortLines = stats.reduce((a, x) => a + x.short, 0);
  const timing = stats.map((x, i) => (x.first > 0.3 || x.gaps || x.tail > 0.6 || x.tail < -0.05 ? i + 1 : 0)).filter(Boolean);
  const sc = s.engagement?.scores ?? {};
  const score = Math.min(10, (sc.villain ?? 0) + (sc.debate ?? 0) + (sc.cult_line ?? 0) + (sc.share ?? 0) + (sc.part2 ?? 0) + (sc.detail ?? 0));
  const out: Check[] = [
    { ok: total >= range[0] && total <= range[1], label: `Durée totale ${range.join('-')} s (vidéo de ${lengthLabel(projectLength(d))})`, detail: `${clips.map((c) => c.seconds).join(' + ')} = ${total} s` },
    { ok: hookWords >= 6 && hookWords <= 10 && (hookLine?.start ?? 1) <= 0.2, label: 'Hook : 1re réplique de 6 à 10 mots à 0,1 s', detail: hookLine ? `${hookWords} mots, à ${hookLine.start} s` : 'pas de réplique' },
    { ok: (s.hook_candidates?.length ?? 0) >= 5 && (s.backup_hooks?.length ?? 0) >= 2, label: '5 hooks écrits, 2 de rechange', detail: `${s.hook_candidates?.length ?? 0} hooks, ${s.backup_hooks?.length ?? 0} de rechange` },
    { ok: clips.every((c) => c.mini_hook), label: 'Un mini-hook à la fin de chaque clip', detail: `${clips.filter((c) => c.mini_hook).length}/${clips.length}` },
    { ok: !senseProblems(s).length, label: 'Phrases complètes, sans remplissage', detail: senseProblems(s).length ? senseProblems(s).slice(0, 3).map((p) => `clip ${p.clip} : « ${p.text.slice(0, 40)}… » (${p.issue})`).join(' · ') : 'aucune phrase cassée repérée' },
    { ok: !badPace.length, label: 'Rythme naturel 2,6-3,2 mots/s par clip', detail: badPace.length ? `à revoir : clip ${badPace.join(', ')}` : stats.map((x) => x.wps.toFixed(1)).join(' · ') },
    { ok: !shortLines, label: 'Répliques de 6 mots minimum', detail: shortLines ? `${shortLines} réplique(s) trop courte(s)` : 'toutes OK' },
    { ok: !timing.length, label: 'Minutage collé (1re à 0,1 s, pas de trou, fin à 0,1-0,2 s)', detail: timing.length ? `à revoir : clip ${timing.join(', ')}` : 'OK' },
    { ok: (s.characters ?? []).every((c: Char) => c.phonetic && c.voice), label: 'Prénoms phonétiques et voix décrites', detail: `${(s.characters ?? []).filter((c: Char) => c.phonetic && c.voice).length}/${s.characters?.length ?? 0}` },
    { ok: score >= 7 && (s.engagement?.references?.length ?? 0) >= 2 && !!s.engagement?.cult_line, label: 'Engagement : note ≥ 7/10, 2-4 références, réplique culte', detail: `${score}/10 · ${s.engagement?.references?.length ?? 0} réf.` },
  ];
  if (d.videos) {
    const bad = (d.videos.clips ?? []).map((c: any, i: number) => (retimeShots(clips[i]?.lines ?? [], c.shots).some((x) => x.end - x.start > 3.6 || x.end - x.start < 1.1) ? i + 1 : 0)).filter(Boolean);
    out.push({ ok: !bad.length, label: 'Plans de 1,5 à 3,5 s', detail: bad.length ? `à revoir : clip ${bad.join(', ')}` : 'OK' });
  }
  if (d.images) out.push({ ok: (d.images.clips ?? []).every((c: any, i: number) => (clips[i]?.lines ?? []).every((l) => c.characters.some((p: any) => p.name.toLowerCase() === l.character.toLowerCase()))), label: 'Chaque locuteur est visible sur son image de départ', detail: 'comparé au découpage' });
  out.push({ ok: !!d.pack, label: 'Couverture, légende et commentaire épinglé livrés', detail: d.pack ? 'OK' : 'étape 5 à faire' });
  return out;
}
