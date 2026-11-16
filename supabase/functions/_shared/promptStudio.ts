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
3. CASTING : 3 à 5 personnages par partie ; 2 personnages par clip (3 seulement si c'est indispensable, jamais plus). Lieux : 2 ou 3 pour 30 s, 3 à 4 pour 45 s, 4 à 6 scènes courtes pour 1 min (un lieu par clip) : ça change toutes les 5 à 10 s, jamais de temps mort. Moins de monde à l'image = moins d'erreurs de l'IA.
4. RÉTENTION : la question du hook reste ouverte jusqu'au bout ; du neuf toutes les 5-10 s (info, vanne, émotion, retournement) ; chaque scène est pire que la précédente ; chaque clip finit sur un mini-hook (menace, délai, révélation coupée, arrivée, choix). Aucun plan de décor, d'ambiance ni de quelqu'un qui marche. À bannir : explication à froid, répétition, transition, bonne nouvelle sans prix à payer. Le héros répond, il ne subit pas : chaque scène change le rapport de force.
5. JEU D'ACTEUR : chaque réplique a son intonation (champ tone, en anglais) : rire moqueur, ricanement, chuchoté, crié, sanglot, soupir, sarcasme, panique… Varie d'une réplique à l'autre, comme de vrais acteurs ; les rires et soupirs se jouent dans la voix, jamais écrits dans le texte.
5 bis. DIALOGUE NATUREL QUI A DU SENS (règle n°1) : on parle comme dans la vraie vie, à 2,9-3,5 mots/s, avec du peps : 6 s ≈ 19 mots (2 répliques), 10 s ≈ 32 mots (3 répliques), 15 s ≈ 48 mots (4-5 répliques). Chaque réplique est une PHRASE FRANÇAISE COMPLÈTE ET CORRECTE (sujet, vrai verbe conjugué, jamais coupée au milieu), qui RÉPOND à la précédente et fait avancer l'histoire. Jamais de mots ajoutés pour faire durer (« maintenant », « ici », « immédiatement », « absolument », « vraiment », « tout » en fin de phrase). Chaque réplique fait 5 mots minimum. Pas de « Quoi ?! » isolé. 1re réplique à 0,1 s, chacune 0,1 s après la précédente, la dernière finit 0,1-0,2 s avant la fin. Un trou se comble par une vanne, jamais par un silence. Seuls les personnages VISIBLES sur l'image parlent, jamais hors champ, jamais d'eux à la 3e personne. Chaque personnage a un vrai PRÉNOM humain (Kévin, Lila, Moussa, Inès…), jamais le nom de son fruit, de son objet ou de sa pierre ; la prononciation s'écrit en syllabes avec des tirets (« Ké-vin »), jamais en alphabet phonétique. Pas de mots rares, une voix décrite par personnage, identique dans tous les clips.

LES IDÉES QUI CARTONNENT
Modèle n°1, celui qui marche le mieux en ce moment : L'IRONIE DRAMATIQUE. Le spectateur sait tout dès la 1re seconde (le méchant annonce son plan en le faisant), la victime, elle, ne sait rien. Le méchant est culotté (la victime vient lui demander de l'aide, il fait semblant d'être outré), on a envie de crier « c'est lui ! » en commentaire, puis le karma se prépare (un piège, une caméra, un témoin) et la fin promet qu'il va se faire prendre. Enjeu tiré du quotidien (un objet volé, de l'argent, un chiffre précis), compris en 2 secondes. Les personnages disent ce qu'ils font et pensent tout haut (« Je vais descendre voir dehors », « Faut que je cache ça vite ») : on comprend l'histoire même sans regarder l'écran.
Les autres modèles qui font des millions de vues (choisis-en UN par histoire) :
Modèle n°2, LE SUSPENSE « ON SAIT, ELLE NON » : un personnage gentil fait entrer le danger (elle ouvre la porte, elle prend un inconnu en voiture). Un plus faible a compris et prévient (« N'ouvre surtout pas ! »), personne ne l'écoute. Au milieu, LE MESSAGER confirme au spectateur que c'est bien le danger : un flash info à la radio ou à la télé, un policier au téléphone (« vous êtes la cinquième à nous appeler »), un résultat d'analyse. Il donne LE SIGNE pour le reconnaître (« il ne cligne jamais des yeux »), puis on voit ce signe sur le méchant. Le gentil laisse le plus faible seul avec lui (« je reviens dans deux minutes ») et le méchant prononce la dernière phrase, calme et glaçante. La menace reste dans les mots et les regards, jamais montrée.
Modèle n°3, LE ZÉRO QUI CACHAIT SA FORCE : un champion arrogant humilie les nouveaux devant tout le monde. Le plus banal (gris, cabossé, sans pouvoir) obtient un score nul et tout le monde rit. Il répond calmement au lieu de pleurer, encaisse le coup « fatal »… et ne bouge pas : « T'as fini ? ». Le spectateur attend la revanche de la partie 2.
Modèle n°4, L'ESCALADE ABSURDE DE LA MATIÈRE : le problème du personnage vient de ce qu'il EST (un steak transpire de la graisse, un citron est acide, un glaçon fond), et la solution « médicale » ou « pro » est en fait ce qu'on fait vraiment à cette matière (le chirurgien d'un steak le cuit : « tu es à point »). Toutes les vannes sont des jeux de mots sur sa matière (« persillé », « œuf dur », « que du cholestérol »), un prix délirant et précis (180 000 €, « en 300 fois »), et une mère dramatique qui en fait trop.
Modèle n°5, LE RICHE ET L'HUMBLE + L'ENQUÊTE : une riche capricieuse paie une fortune (un chiffre précis) pour un service ; une personne simple et chaleureuse la soigne à sa façon (corvées, histoire de chèvre racontée) et ça marche. Puis un indice révèle un sabotage (le flacon a été trafiqué) : on lance la chasse au coupable, à suivre.
Modèle n°6, L'HABIT NE FAIT PAS LE MOINE (le format n°1 des comptes à plusieurs millions de vues) : une personne d'apparence modeste (mamie, femme en vieux vêtements, homme fatigué) entre dans un lieu chic (bijouterie, concession, port de yachts, entreprise). Le personnel la méprise, la chasse ou lui jette une pièce (« le magasin de seconde main, c'est trois rues plus loin »). Puis elle achète tout, cash (« celui-là et celui d'à côté »), et retourne leurs phrases contre eux (« tout à l'heure, mes chaussures allaient salir votre bateau »). Variante : la mère du patron se déguise en pauvre pour tester les employés de son fils. La fin pose LA question de la partie 2 : « Qui est vraiment cette femme ? ».
Modèle n°7, LE DON SECRET : le héros moqué a un don que lui seul possède (il voit à travers les objets, il entend les pensées, il sent le mensonge). Il achète pour presque rien ce que tout le monde méprise (un fauteuil pourri à 200 €) et le moqueur FILME pour l'humilier… la caméra tourne quand le trésor apparaît. Puis un inconnu appelle : « C'est moi qui l'ai mis là pour toi », et la dernière image révèle quelqu'un de très proche (« Maman ? »).
Modèle n°8, L'ASCENSION ET LA CHUTE (la cupidité punie) : un personnage fauché découvre un produit miracle au résultat visible tout de suite (une sève qui fait repousser les cheveux sous nos yeux). Montée express en 3 ou 4 scènes très courtes : le premier client bluffé, l'associé qui flaire le jackpot, la cliente riche, puis le luxe (valise de billets, villa, son propre portrait géant). Il dit son erreur tout haut : « Je suis riche, mais ça ne suffit pas encore. » Il retourne en prendre une dernière fois… et les gardiens du secret l'attendent. Fin : il supplie (« Je rendrai l'argent ») et la sentence tombe, coupée avant d'être montrée. Le spectateur jubile parce qu'il l'avait vu venir.
Modèle n°9, LE CHOUCHOU ET LE MAL-AIMÉ (l'injustice en famille) : un parent gâte son préféré devant l'autre (« la moto la plus puissante pour Enzo, et pour toi la vieille épave à dix balles »), le frère chouchou se moque. Le mal-aimé ne se plaint pas, il bricole, travaille, répare… et son cadeau minable cache un secret (l'épave est la plus puissante de toutes). Partie 2 : le défi public contre le chouchou, avec un enjeu chiffré. Variante : le fils est le seul à voir que l'adversaire de son père triche, personne ne l'écoute, le père perd, le fils relève le défi à sa place.
Modèle n°10, L'ARROSEUR ARROSÉ (la petite vengeance du quotidien) : quelqu'un « emprunte » toujours la même chose en douce (le dentifrice, le chargeur, le repas dans le frigo) et ment (« pourquoi j'aurais fait ça ? »). La victime prépare un piège inoffensif et drôle (un dentifrice qui colore les dents en bleu la veille de sa grande photo). Le menteur tombe dedans devant tout le monde, et la victime lui renvoie sa propre phrase (« je croyais que tu avais tout ce qu'il fallait »). Très partagé, parce que tout le monde connaît un « Brad ».
Modèle n°11, LE RITUEL DE LA RÉVÉLATION (parfait pour les univers fruits et matières) : le jour de ses 16 ans, on découvre ce que chacun a À L'INTÉRIEUR (on ouvre le couvercle, on casse la coque, on soulève la pierre). Le frère est en or, la sœur en rubis… et le héros est en gravier, ou complètement vide. Humiliation devant tout le lycée, la fille qu'il aime est juste devant, le père dit « j'ai eu deux trésors… et un gravier ». Puis, au pire moment, une lumière sort de lui : sa matière cachée est la plus rare de toutes.
Modèle n°12, LE CORPS QUI VAUT DE L'OR (la famille exploitée) : la matière d'un personnage se vend très cher (ses larmes sont du sirop, son jus guérit, ses cheveux repoussent en or). D'abord c'est pour payer le loyer en retard et nourrir l'enfant ; puis un proche devient cupide et le fait « produire » sans arrêt (« tant que ça coule »), la boutique cartonne, les clients en redemandent, un rival exige la recette. Tout public : seulement ce qui coule ou repousse tout seul (larmes, jus, cheveux, feuilles), jamais de coupure, de membre arraché ni de blessure.
Modèle n°13, L'ÉCHANGE D'IDENTITÉ : deux personnages identiques (même tête, même matière). Celui qui a tout à perdre échange sa place en douce, la veille du grand jour (le prisonnier libérable demain, le marié, l'héritier). L'autre se réveille avec la mauvaise vie, personne ne le croit, et il le retrouve (« je te retrouverai, même dans cent ans »).
Modèle n°14, LA REVANCHE APRÈS LA TRANSFORMATION (10 millions de vues mesurées) : la fille qu'on traite de « moche » se fait inviter à une fête… c'est un piège, la bande la filme et l'humilie. Elle revient transformée (nouveau style, confiance, talent révélé), toute l'école est bluffée, mais les brutes continuent (« un nouveau visage ne change pas ce que tu es »). Cette fois, c'est ELLE qui a la caméra : leur méchanceté est montrée à tout le monde, la brute supplie, et elle annonce la suite (« Dis à ta reine qu'elle est la prochaine »). Tout public : la transformation vient du style, de la confiance ou d'un talent, jamais de la chirurgie ni de se faire du mal.
Modèle n°15, LE FAUX COUPLE PAYÉ : une héritière refuse le mari riche choisi par ses parents et paie un inconnu (un sans-abri, un livreur) une somme folle pour jouer son fiancé (« Un demi-million pour jouer mon fiancé. — C'est une caméra cachée ? »). Relooking express, dîner chez les parents… et les parents le reconnaissent : « C'est vous ? » Mystère pour la partie 2 : d'où se connaissent-ils ?
LA QUESTION AU PUBLIC (le compte qui fait 4 millions de vues termine TOUTES ses vidéos comme ça) : juste après le cliffhanger, un personnage pose au spectateur un vrai dilemme à deux choix, court et facile (« Je lâche ma mère ou mon âme ? », « Le pardonner ou l'humilier ? », « Vous auriez fait quoi ? »). Les gens répondent en commentaire, et les commentaires poussent la vidéo. Les dialogues parlent comme les jeunes en France (« wesh », « frérot », « askip », « la daronne », « belek »), sans gros mots.
À éviter (flops mesurés) : les aventures où les personnages enchaînent les gags d'un lieu à l'autre sans méchant ni enjeu, les légendes et prophéties à expliquer (« seul l'élu pourra faire pleurer la statue »), les objets qui vivent dans un monde absurde sans enjeu humain clair, les histoires d'amour gentilles sans méchant ni retournement, les trahisons où le gentil perd tout et où les méchants gagnent à la fin (personne pour qui trembler, aucune revanche promise).
Les ingrédients qu'on retrouve dans TOUTES ces vidéos : le titre « PARTIE 1 - … » avec une promesse en 3 mots ; un compte à rebours dit à voix haute (« dans dix minutes », « dix secondes ») ; un chiffre précis ; un adulte qui ne voit rien pendant que le spectateur sait ; la dernière image coupe en pleine action, sur la phrase la plus forte. Une SÉRIE se pense dès l'épisode 1 : il pose le mystère (qui est-elle vraiment ? d'où vient l'or ?) et l'épisode 2 le révèle ; c'est l'épisode 2 qui fait le plus de vues, à condition que la question soit claire. Change d'histoire après 3 ou 4 épisodes : une série étirée à 9 épisodes s'essouffle. L'épisode 1 démarre DIRECTEMENT sur la scène la plus forte (l'humiliation, le couvercle qu'on ouvre devant tout le lycée), jamais par la présentation des personnages : mesuré, la même histoire fait 37 000 vues quand elle commence par « voici Cola et son frère », et 2,4 millions quand elle commence par « Vas-y, ouvre ! ». Après une révélation, une NOUVELLE MENACE plus forte arrive tout de suite, sinon les vues s'effondrent : l'échelle des méchants (le grand frère de la brute, puis le rival d'il y a deux ans, puis le lieutenant, puis le boss… qui connaît le secret du héros parce que c'est lui qui le lui a appris). Les sujets lourds racontés au premier degré (handicap, maladie, abandon d'un bébé) font des flops : le public veut de la revanche, du mystère ou du rire, pas de la tristesse sans retournement.
Une bonne histoire tient en une phrase et repose sur un moteur émotionnel universel : trahison d'un proche, secret de couple ou de famille, argent et héritage, humiliation puis revanche, injustice au travail ou à l'école, mensonge qui se retourne, karma immédiat, choix impossible. Enjeu concret et compréhensible par un ado (argent, honneur, amour, famille, réputation), méchant qu'on adore détester, retournement inattendu MAIS logique (préparé par un détail montré avant). Pas de rêve, pas de « tout ça n'était qu'un cauchemar », pas de magie qui règle tout, pas d'univers compliqué à expliquer.

FAISABLE PAR L'IA (anti-hallucinations, règle aussi importante que le sens)
La vidéo est animée par une IA : écris uniquement ce qu'elle rend bien.
- OUI : des personnages qui se parlent face à face, réagissent, pointent du doigt, croisent les bras, se lèvent, pleurent, rient, tiennent un GROS objet simple déjà visible sur l'image de départ (lettre, enveloppe, valise, téléphone écran éteint, clé, bague, bouquet).
- NON : foule ou figurants, bagarre, poursuite, véhicule qui roule, chute, explosion, feu, eau qui coule, animal (sauf s'il est un personnage), miroir ou reflet, écran ou texte lisible (SMS, panneau, journal), mains qui manipulent de petits objets (écrire, taper, compter des billets, cuisiner en détail), personnage qui entre ou sort du cadre en plein clip, nouvel objet ou nouveau personnage qui apparaît en cours de clip, transformation (sauf l'effet listé plus bas).
- Une action par clip, qui commence déjà sur l'image de départ ; décor simple et identique du début à la fin du clip.

BIBLIOTHÈQUE DE HOOKS (formules qui arrêtent le scroll ; adapte-les, ne les recopie jamais mot pour mot)
0. Le plan du méchant (ironie dramatique) : il annonce ce qu'il fait PENDANT qu'il le fait (« Je vais revendre le vélo de mon voisin, ça va me rapporter gros. »).
1. L'ultimatum : « Tu as 24 heures pour quitter ma maison. »
2. La découverte : « J'ai trouvé 50 000 euros dans le sac de mon mari. »
3. L'aveu brutal : « Ce bébé n'est pas de toi, et ta mère le sait. »
4. Le chiffre impossible : « Elle m'a fait payer 3 000 euros pour un verre d'eau. »
5. L'humiliation publique : « Il m'a quittée devant 200 invités, au micro. »
6. La règle absurde : « Dans cette famille, celui qui pleure est déshérité. »
7. Le retournement de rôle : « Mon stagiaire vient de devenir mon patron. »
8. Le mensonge démasqué : « Tu disais être au travail ? Tu étais à mon mariage. »
9. La menace : « Si tu ouvres cette lettre, tu perds ta fille. »
10. La trahison du proche : « Ma meilleure amie porte ma robe de mariée. »
11. Le karma immédiat : « Elle s'est moquée du serveur. Le serveur, c'était le propriétaire. »
12. Le choix impossible : « Ton frère ou ton héritage. Tu as dix secondes. »
13. Le secret de famille : « Papa a une deuxième famille, à trois rues d'ici. »
14. L'injustice : « On m'a virée pour avoir aidé une cliente. »
15. Le piège : « Je savais que tu viendrais voler ce coffre. »
16. L'avertissement ignoré : « Maman, ne lui ouvre surtout pas la porte ! »
17. Le ras-le-bol de la matière : « Je ne supporte plus ce corps qui fond au soleil. »
18. La loi du plus fort : « Ici, les nouveaux sont des déchets, et je suis le champion. »
19. Le caprice à prix fou : « 150 000 euros, et il n'y a même pas la clim ? »
20. Le flash info : « Flash spécial : l'homme recherché ne cligne jamais des yeux. »
21. Le mépris de classe : « Madame, la boutique pour les gens comme vous, c'est trois rues plus loin. »
22. Le trésor caché : « Il y a des lingots d'or dans ce vieux fauteuil, et personne ne le voit. »
23. Le test secret : « Voyons comment elles traitent les gens quand mon fils n'est pas là. »
24. Le miracle en direct : « Mes cheveux ! Ce truc vient de me faire repousser les cheveux. »
25. Le cadeau injuste : « Pour Enzo, la moto la plus puissante. Pour toi, l'épave à dix balles. »
26. La triche que personne ne voit : « Papa, il a mis quelque chose dans ses gants ! »
27. Le piège de la victime : « Il me pique encore mon dentifrice ? Cette fois, il va le regretter. »
28. Le rituel : « Seize ans. Il est temps de découvrir ce que tu caches à l'intérieur. »
29. L'échange : « Toi, tu sors demain. Moi, dans cent ans. Pourquoi toi et pas moi ? »
30. L'exploitation : « Encore une larme, la dernière, la boutique a encore des commandes. »
31. Le grand frère vengeur : « Qui a osé humilier mon petit frère ? Montre-toi. »
32. La victime qui accuse : « Tu m'as traitée de moche. Tu m'as filmée. Tu as écrasé mon maquillage. »
33. L'offre absurde : « Un demi-million d'euros pour jouer mon fiancé. C'est oui ou c'est non ? »

PLANS MINUTÉS (le squelette de l'histoire)
- 30 s : 0-3 s choc + enjeu ; 3-12 s le conflit monte (qui veut quoi) ; 12-22 s le pire arrive / la révélation ; 22-30 s retournement préparé + coupure au pic.
- 45 s : 0-3 s choc ; 3-12 s conflit ; 12-25 s escalade (chaque réplique empire la situation) ; 25-35 s révélation + réplique culte ; 35-45 s retournement + cliffhanger.
- 1 min : 0-3 s choc ; 3-15 s conflit ; 15-30 s escalade ; 30-42 s révélation + réplique culte ; 42-55 s retournement ; 55-65 s cliffhanger coupé au pic.
Le retournement doit être préparé par un détail montré ou dit avant (un objet, une phrase), pour qu'on se dise « mais oui ! ».
FIN EN BOUCLE (au choix avec le cliffhanger) : la dernière réplique fait écho à la toute première (le méchant répète son plan, une phrase revient retournée), avec une menace qui promet la suite : le spectateur relance la vidéo et réclame la partie 2. Mesuré : la vidéo à 10 millions de vues se termine sur les 3 mêmes phrases qu'au début (« Pourquoi je suis si moche ? »), et chaque visionnage relancé compte une vue de plus.

LE HOOK (les 3 premières secondes)
Résume l'histoire en UNE phrase paradoxe. Image du clip 1 = le moment le plus fort DÉJÀ EN COURS (gifle levée, valise jetée dehors, billet déchiré), jamais un décor vide, une marche ou une pose. 1re réplique à 0,1 s, 6 à 10 mots, 1er mot = le choc (chiffre, ordre, accusation, objet) ; jamais « Salut », « Alors », « Écoute » ni un prénom seul ; l'enjeu ou la menace arrive avant 3 s. Écris 5 hooks avec 5 mécaniques différentes (chiffre impossible, ordre humiliant, révélation, rêve brisé, règle absurde, cri, aveu, plan secret, vanne), garde le meilleur. Test : son coupé, on comprend l'image ? Image cachée, on comprend la phrase ? Qui, problème et enjeu compris en 3 s ; un objet, un chiffre ou un lieu précis ; aucune expression imagée. Partie 2+ : la 1re réplique repose l'idée de la série pour les nouveaux, puis le cliffhanger d'avant.

LE DYNAMISME (sans casser l'image) : coupe nette à chaque changement de locuteur, et seulement là ; 2 à 4 plans par clip ; un plan dure 2 à 4 s ; jamais deux fois le même cadrage de suite (plan moyen, par-dessus l'épaule, gros plan, contre-plongée) ; caméra fluide et maîtrisée (push-in lent, léger panoramique, petit travelling), jamais de whip pan, de crash zoom ni de caméra qui tremble : ces mouvements déforment les visages ; un geste ou un objet par plan ; ceux qui écoutent réagissent bouche fermée ; fin de clip : 0,5 s de très gros plan muet sur la réaction clé ; son : ambiance du lieu + un bruitage net par moment fort, jamais de silence.

L'ENGAGEMENT : on PROVOQUE, on ne demande pas. 2-3 leviers par partie (référence, méchant culte avec une phrase qui revient, insulte inventée et mignonne jamais sur une origine, une religion ou un handicap, réplique culte de 8 mots max, camp contre camp, UN détail à repérer, scène vécue précise, fin coupée au pic). 2 à 4 références par partie, 1 par clip max (foot, rap, jeux, mangas, séries, télé, vie de jeune : le bac, le permis, le tacos, la flamme Snap, Vinted, la batterie à 1 %). Rêves des jeunes = l'enjeu qui accroche (footballeur pro, rappeur, streamer, riche avant 25 ans, voiture de rêve, Dubaï, sortir sa famille de la galère). Au moins un déclencheur de partage. Écris le commentaire que tu veux voir en haut. Si l'histoire fournie contient une « Réplique à répéter » ou un « Jeu pour les commentaires » (issus de la veille), garde-les : ce sont la réplique culte et le commentaire visé. Grille /10 : méchant /2, débat /2, réplique culte /2, envie de partager /2, fin « PARTIE 2 VITE » /2 ; jamais « like si… » ni « commente OUI ».

DIRECTION ARTISTIQUE : long-métrage d'animation 3D. Têtes : corps humain habillé avec de vraies mains (mains et cou couleur de la tête), visage cartoon intégré (grands yeux, sourcils, bouche visible) ; forme ronde pour les gentils, anguleuse pour le méchant. Une tenue signature par personnage, sans aucun logo, marque ni texte lisible (ni sur les vêtements, ni sur les sacs, ni sur les objets). Image de départ de chaque clip : tous les personnages qui parlent, en entier, séparés, visages lisibles, en plan large ou moyen ; une ACTION EN COURS, jamais une pose ; les objets importants déjà visibles ; aucun texte. Note les raccords du clip d'avant (tache sur la chemise, nuit tombée).

GROK : un clip = une scène de dialogue montée comme un film, 2 à 4 plans avec une coupe nette à chaque changement de locuteur, caméra fluide. Un lieu par clip ; deux personnages qui se ressemblent = un plan continu ; personnage magique en plan moyen ; voix au téléphone = « the lines of X come only from the phone speaker, nobody on screen moves their lips ». Effets qui marchent : transformation (a burst of golden sparkles swallows her; CUT to her transformed), magie (snapping fingers in golden sparkles), émotion (mascara running, crying), sortie (walking away, waving a hand over the shoulder).

SÉCURITÉ : inspiré, jamais copié (têtes, prénoms, décors et détails changés) ; pas de marque, logo ni personne réelle à l'image ; citer une star dans une vanne est OK, se moquer d'une vraie personne non ; tout public : ni sang, ni gore, ni sexualisation, ni gros mots.`;

// ---------------------------------------------------------------- JSON schemas (Gemini format)
const S = (description?: string) => ({ type: 'STRING', ...(description ? { description } : {}) });
const N = (description?: string) => ({ type: 'NUMBER', ...(description ? { description } : {}) });
const I = (description?: string) => ({ type: 'INTEGER', ...(description ? { description } : {}) });
const arr = (items: unknown, description?: string) => ({ type: 'ARRAY', items, ...(description ? { description } : {}) });
const obj = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: 'OBJECT', properties, required });

const line = obj({ character: S('Nom du personnage qui parle (visible sur l’image)'), start: N('Début en secondes, ex. 0.1'), end: N('Fin en secondes'), text: S('Réplique exacte en français, 6 mots minimum'),
  tone: S('IN ENGLISH, 2 to 6 words: HOW the line is acted (e.g. "laughing mockingly", "whispering, terrified", "shouting in anger", "sobbing", "sarcastic, rolling eyes", "sighing, exhausted"); vary from line to line') });

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
    lines: arr(line, 'Répliques minutées : phrases complètes et naturelles, 2,9 à 3,5 mots/s'),
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
  slow: { label: 'Ralenti ou blancs', rule: 'Ajoute une réplique utile ou une vanne (jamais des mots de remplissage) pour atteindre 2,9-3,5 mots/s, répliques collées.' },
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
  const look = cast.length ? `${castLine(cast)}${uniLine ? `\n${uniLine}` : ''}` : uniLine || `Style verrouillé : ${st.emoji} ${st.label} (${st.text} ${st.ruleFr})`;
  // the image generator refuses these scenes: the story never needs them (horror works through mood, looks and sound)
  const style = `${look}\nIMAGES GRAND PUBLIC : jamais de sang, de blessure, de cadavre, d'arme ni d'enfant (même fantôme ou apparition : tous les personnages sont adultes) ; la peur et la tension passent par l'ambiance, les regards, la lumière et les sons.`;
  const part = Number(ctx.part ?? 1) > 1 ? `\nC'est la PARTIE ${ctx.part}. Fin de la partie précédente : ${ctx.previous_end ?? ''}` : '';
  const tweak = ctx.feedback ? `\nAjustements demandés par l'utilisateur : ${ctx.feedback}` : '';
  const story = ctx.concepts?.[ctx.chosen ?? -1] ? `Histoire choisie : ${JSON.stringify(ctx.concepts[ctx.chosen])}` : `Histoire de l'utilisateur (même en vrac ; comble les vides) : ${ctx.story ?? ''}`;
  switch (phase) {
    case 'concepts': {
      const t = ctx.trends as { insights?: string; concepts?: { title: string; fr_status: string | null; hook: string; ending: string; repeat_line: string; screen_line: string }[] } | undefined;
      const veille = t?.concepts?.length
        ? `\nVEILLE DU JOUR (ce qui cartonne en ce moment, chiffres réels) :\n${String(t.insights ?? '').slice(0, 3500)}\nExemples de concepts du jour (🟢 = aucune version française encore) :\n${t.concepts.map((c) => `- ${c.fr_status === 'green' ? '🟢 ' : ''}${c.title} — hook : ${c.hook.replace(/\n/g, ' / ').slice(0, 260)} — fin : ${c.ending.slice(0, 200)} — 🔁 ${c.repeat_line} — 💬 ${c.screen_line}`).join('\n')}\nAppuie-toi sur ces formats qui marchent (mécanique, type de hook, type de fin, réplique à répéter, jeu en commentaire), en priorité ceux sans version française, mais n'en recopie aucun : change les têtes, les prénoms, les décors et 2-3 détails, et donne à chaque histoire son propre hook. Dans "hook", donne la 1re réplique choc ; termine le synopsis par la réplique à répéter et le jeu pour les commentaires.`
        : '';
      return `${style}\nPropose 3 histoires de mini-drama très différentes (3 moteurs émotionnels différents parmi LES IDÉES QUI CARTONNENT, toutes FAISABLES PAR L'IA : 2 personnages par scène, actions simples), pensées pour une vidéo de ${lengthLabel(projectLength(ctx))} (${LENGTH_RANGE[projectLength(ctx)].join(' à ')} s), avec un enjeu qui accroche les jeunes, un méchant, 2 à 4 lieux et un cliffhanger possible.${veille}${ctx.story ? `\nPiste de l'utilisateur : ${ctx.story}` : ''}${tweak}`;
    }
    case 'script':
      return `${style}${part}\n${story}\nLivre : le PITCH (titre, phrase paradoxe, synopsis, 3 à 5 personnages avec prénom phonétique, tête, visage, mains et cou, tenue signature, accessoire, voix), les lieux, les 5 hooks avec 5 mécaniques, le hook retenu (image + pourquoi), 2 hooks de rechange, le DÉCOUPAGE en clips de 6, 10 ou 15 s (${lengthRule(projectLength(ctx))} Clip 1 = le hook retenu) avec pour chaque clip : lieu, personnages visibles, résumé, question ouverte, ce qui est nouveau, mini-hook et répliques qui remplissent tout le clip. BUDGET DE MOTS (compte-les, tous les mots de toutes les répliques du clip) : clip de 6 s = 17 à 21 mots en 2 répliques, 10 s = 29 à 35 mots en 3 répliques, 15 s = 44 à 52 mots en 4-5 répliques ; 5 mots minimum par réplique. LE SENS AVANT TOUT : chaque réplique est une phrase complète, avec un vrai verbe, qu'un ado dirait vraiment, et qui répond à la précédente ; jamais de mots de remplissage pour faire le compte, jamais de phrase coupée. Relis chaque clip à voix haute dans ta tête avant de répondre. Les minutages sont recalculés par le code, l'ENGAGEMENT (leviers, références placées, réplique culte, commentaire visé, notes) et le cliffhanger. Vérifie tes calculs avant de répondre.\nMÉTHODE DE LA SALLE DES SCÉNARISTES (dans ta réflexion, pas dans la réponse) : 1) choisis le moteur émotionnel ; 2) écris 10 hooks avec 10 formules différentes de la BIBLIOTHÈQUE et note-les /10 (arrêt du scroll, clarté, enjeu), garde le meilleur ; 3) pose le PLAN MINUTÉ de la durée demandée ; 4) écris le découpage ; 5) relis-le comme un critique exigeant (hook, tension qui monte, retournement préparé et surprenant, réplique culte, fin coupée au pic, chaque personnage a sa façon de parler) et réécris tout passage en dessous de 8/10. Ne livre que la version finale.${tweak}`;
    case 'images':
      return `${style}\nPitch et découpage validés : ${JSON.stringify(ctx.script)}\nLivre la PLANCHE (pour chaque personnage, une description complète en anglais : tête + visage + couleur des mains et du cou + tenue complète + accessoire ; elle sera recopiée mot pour mot) puis, pour CHAQUE clip dans l'ordre, l'image de départ : décor en une phrase riche, pour chaque personnage visible son action en cours (jamais une pose), son émotion et sa position, et les raccords du clip d'avant. Tous les personnages qui parlent dans le clip doivent être sur l'image.${tweak}`;
    case 'videos':
      return `${style}\nDécoupage validé (les répliques et minutages sont définitifs) : ${JSON.stringify(ctx.script?.clips)}\nPersonnages : ${JSON.stringify(ctx.script?.characters)}\nImages de départ : ${JSON.stringify(ctx.images?.clips)}\nPour CHAQUE clip dans l'ordre : le HEAD LOCK (chaque personnage visible et sa tête en quelques mots), un LOOK LOCK si un personnage est magique ou ambigu, la SHOT LIST (un plan par réplique aux mêmes minutages, jamais plus de 4 plans dans le clip ; chaque plan = cadrage + mouvement de caméra DOUX + qui parle + un geste simple ; jamais deux fois le même cadrage de suite ; seulement les personnages déjà sur l'image de départ ; 0,5 s finale = gros plan muet de la réaction clé) et le SON (ambiance + 1 à 3 bruitages calés).${tweak}`;
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
export type Line = { character: string; start: number; end: number; text: string; tone?: string };
const lines = (l: unknown): Line[] => (Array.isArray(l) ? l : []).map((x: any) => ({ character: str(x?.character, 60), start: num(x?.start), end: num(x?.end), text: str(x?.text, 400), ...(str(x?.tone, 60) ? { tone: str(x?.tone, 60) } : {}) })).filter((x) => x.text);
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

/** clips whose word count is out of the lively 2.9-3.5 words/s budget (tolerance 2.6-3.8) */
export const BUDGET: Record<number, [number, number]> = { 6: [17, 21], 10: [29, 35], 15: [44, 52] };
export function paceProblems(script: any): { clip: number; words: number; target: [number, number] }[] {
  const first = script?.clips?.[0]?.lines?.[0];
  const hook = first ? words(first.text) : 8;
  const out = (script?.clips ?? []).map((c: any, i: number) => {
    const w = c.lines.reduce((a: number, l: Line) => a + words(l.text), 0);
    const wps = w / c.seconds;
    return wps < 2.6 || wps > 3.8 ? { clip: i + 1, words: w, target: BUDGET[c.seconds] ?? [Math.round(c.seconds * 2.9), Math.round(c.seconds * 3.5)] } : null;
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
  return `Tu es le CRITIQUE et RELECTEUR du découpage ci-dessous, avant qu'il soit animé et doublé. Voici le découpage : ${JSON.stringify(script)}
D'abord, note l'histoire comme un producteur exigeant de séries TikTok (dans ta réflexion) : hook qui arrête le scroll /2, enjeu clair avant 10 s /2, tension qui monte à chaque clip /2, retournement préparé ET surprenant /2, fin coupée au pic qui donne envie de la suite /2. Pour tout critère sous 2, réécris les répliques concernées (garde les mêmes clips, durées, lieux et personnages ; renforce le hook avec la BIBLIOTHÈQUE DE HOOKS si besoin ; ajoute une réplique culte de 8 mots max si elle manque).
Ensuite, vérifie et CORRIGE les répliques, clip par clip :
1. Chaque réplique est une phrase française complète et correcte (sujet, vrai verbe conjugué), jamais coupée, jamais une suite de mots sans lien.
2. Chaque réplique répond à la précédente ou réagit à ce qui se passe : la conversation a une logique, l'histoire se suit d'un clip à l'autre, on comprend qui veut quoi.
3. Ça sonne comme un vrai ado qui parle : simple, naturel, drôle ou tendu, sans mots rares ni tournures de poème.
4. Aucun mot de remplissage pour faire durer (« maintenant », « ici », « immédiatement », « absolument », « vraiment » en fin de phrase).
5. Rythme vivant : 2,9 à 3,5 mots/s (6 s = 17 à 21 mots, 10 s = 29 à 35 mots, 15 s = 44 à 52 mots, en comptant tous les mots du clip), 5 mots minimum par réplique, 1re réplique du clip 1 = le hook de 6 à 10 mots.
${sense.length ? `Problèmes déjà repérés :\n${sense.map((p) => `- clip ${p.clip}, ${p.character} : « ${p.text} » → ${p.issue}`).join('\n')}\n` : ''}${pace.filter((p) => p.clip > 0).length ? `Clips hors budget de mots : ${pace.filter((p) => p.clip > 0).map((p) => `clip ${p.clip} (${p.words} mots, il en faut ${p.target[0]} à ${p.target[1]})`).join(', ')}\n` : ''}Garde les mêmes personnages, les mêmes lieux, la même histoire, le même nombre de clips et les mêmes durées. Ne change que les répliques qui en ont besoin. Renvoie le JSON complet du découpage, identique pour tout le reste.`;
}
export function buildRepairPrompt(script: any, problems: { clip: number; words: number; target: [number, number] }[]): string {
  return `Voici ton découpage : ${JSON.stringify(script)}
Ces clips ne respectent pas le budget de mots (rythme vivant : 2,9 à 3,5 mots/s) :
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
  return `Crée une image. Generate this image in 9:16 vertical format. Same characters as the attached character reference sheet. Setting: ${cl(c.setting)}. ${people}. ${together} Only these characters in the image (no other people, no crowd), a simple uncluttered set, every important object large and clearly visible.${cl(c.continuity) ? ` Continuity from the previous clip: ${cl(c.continuity)}.` : ''} ${st.block}`;
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
    const tone = l.tone ? ` [${cl(l.tone)}]` : '';
    return `${upper(l.character)}${vc}${tone} ${l.start.toFixed(1)}-${l.end.toFixed(1)}s: « ${l.text.replace(/^[«"\s]+|[»"\s]+$/g, '')} »`;
  }).join('\n');
  const pron = chars.filter((c) => c.phonetic && visible.some((n: string) => n.toLowerCase() === c.name.toLowerCase())).map((c) => `"${c.name}" = "${c.phonetic}"`).join(', ');
  const list = (a: string[]) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
  return [
    `① Animate this image: ${clip.seconds}-second vertical 9:16 clip, the image is the first frame. MULTI-SHOT scene edited like a Pixar movie: hard cuts between camera angles, each cut lands exactly when the speaker changes. Same characters, same outfits, same ${st.heads}, same set and same light in every shot; faces and proportions never change; ONLY the characters of the first frame, no extra people, no crowd, no new object appearing; hands with five fingers; no morphing between characters, no crossfade, no text, no logo.`,
    `② HEAD LOCK: ${list(names)} ALWAYS keep their heads exactly as in the first frame (${heads.map((h: any) => `${upper(h.name)}: ${h.head}`).join(', ')}), with NOTHING else on their head; same outfits in every shot.${v.look_lock ? `\n${v.look_lock}` : ''}`,
    `③ SPEAKER LOCK: during each line's time range, the shot shows the face of THAT speaker and ONLY that speaker's mouth moves; the camera never cuts away mid-line; listeners keep their mouths CLOSED; nobody speaks off-screen.`,
    `④ PACE: brisk, lively and natural speech, about 3.3 words per second (a little faster than a calm conversation), every word articulated clearly and pronounced exactly as written, the first word at 0.1s, no long pauses, no slow motion; each line starts right when the previous one ends.`,
    `⑤ Smooth, controlled camera: slow push-ins, gentle pans and small dolly moves; no whip pans, no crash zooms, no shaky cam (they distort the faces). 2 to 4 shots in the clip, each 2-4 s, cuts only when the speaker changes, never the same framing twice in a row. Characters stay where they are: nobody enters or leaves the frame. Expressive acting with one clear gesture per shot; listeners react with mouths closed. The last half-second is a silent close-up of the key reaction.${i === 0 ? ' Slow push-in from the very first frame and a sharp sound effect at 0.0s.' : ''}`,
    `⑥ SHOT LIST:\n${retimeShots(clip.lines, v.shots).map((s) => `${s.start.toFixed(1)}-${s.end.toFixed(1)}s ${s.text}`).join('\n')}`,
    `⑦ DIALOGUE (in French, spoken clearly at a brisk pace, word for word; each line ACTED with the emotion in [brackets]: real laughs, sighs, sobs, whispers, shouts and mocking tones in the voice and on the face, never spoken aloud as words):\n${dialogue}`,
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
    { ok: !badPace.length, label: 'Rythme vivant 2,9-3,5 mots/s par clip', detail: badPace.length ? `à revoir : clip ${badPace.join(', ')}` : stats.map((x) => x.wps.toFixed(1)).join(' · ') },
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
