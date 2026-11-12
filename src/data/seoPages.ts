/**
 * Search landing pages (one per search intent, in French and English). Rendered by src/pages/SeoPage.tsx, pre-rendered at
 * build time (src/entry-server.tsx) and listed in public/sitemap.xml. `alt` is the same page in the other language (hreflang).
 * Every claim must stay true to the product: prices come from src/services/credits.ts.
 */
export type SeoLang = 'fr' | 'en';
export interface SeoPageData {
  path: string; lang: SeoLang; alt?: string;
  title: string; description: string;
  eyebrow: string; h1: string; highlight: string; intro: string;
  cta: { label: string; to: string };
  videos: string[];
  steps: { title: string; body: string }[];
  sections: { h2: string; body: string[] }[];
  faqs: { q: string; a: string }[];
}

const FR_CTA = { label: 'Créer ma vidéo gratuitement', to: '/app' };
const EN_CTA = { label: 'Create my video for free', to: '/app' };

export const SEO_PAGES: SeoPageData[] = [
  {
    path: '/fr/generateur-video-ia-fruits', lang: 'fr', alt: '/en/ai-fruit-video-generator',
    title: 'Générateur de vidéos IA de fruits (Fruit Drama) pour TikTok — Storyit',
    description: 'Crée des vidéos de fruits IA qui se disputent, les fameux Fruit Drama de TikTok : histoire, personnages, images, animation et montage automatiques. Essai gratuit.',
    eyebrow: 'Fruit Drama IA', h1: 'Générateur de vidéos IA', highlight: 'de fruits.',
    intro: 'Les mini-dramas de fruits explosent sur TikTok : une fraise trahie, un citron jaloux, une banane honnête… Storyit écrit l’histoire, crée les personnages, anime chaque scène et monte la vidéo finale pour toi.',
    cta: FR_CTA,
    videos: ['banane-honnete', 'plaque-de-cuisson', 'chevelure-sans-fin', 'puits-magique', 'mensonge-mere', 'prix-de-la-trahison'],
    steps: [
      { title: 'Choisis le style', body: 'Fruits, ongles, objets du quotidien ou pierres précieuses : le style reste le même pour toute la série.' },
      { title: 'Raconte en vrac', body: 'Quelques lignes suffisent, ou demande 3 histoires au studio. Les concepts tendance du jour sont proposés aussi.' },
      { title: 'Script et prompts', body: 'Hook, découpage minuté de 66 à 75 secondes, dialogues, prompts d’images et d’animation, couverture et légende.' },
      { title: 'Vidéo automatique', body: 'Clique sur « Générer la vidéo » : images, animation et montage sont faits, la vidéo arrive dans ta bibliothèque.' },
    ],
    sections: [
      { h2: 'Pourquoi les vidéos de fruits IA marchent autant', body: [
        'Des personnages reconnaissables en une seconde, des émotions exagérées et des histoires de trahison, de famille ou d’argent : le Fruit Drama coche toutes les cases de la rétention. Chaque épisode se termine sur un cliffhanger qui pousse à suivre le compte pour voir la suite.',
        'Le Prompt Studio applique ces règles à chaque projet : première réplique choc dès 0,1 seconde, 4 à 5 mots par seconde, un mini-hook à la fin de chaque plan et une réplique culte qui donne envie de commenter.',
      ] },
      { h2: 'Des personnages qui restent les mêmes d’une scène à l’autre', body: [
        'Le plus dur avec l’IA, c’est la cohérence. Storyit dessine d’abord une planche de personnages, puis chaque image de scène à partir de cette planche, et verrouille la tête et la tenue de chaque personnage dans les prompts d’animation.',
      ] },
      { h2: 'Combien ça coûte', body: [
        'Un projet complet du Prompt Studio (histoire, script et tous les prompts) coûte 1 500 crédits. La vidéo automatique se paie selon la qualité choisie et la durée, avec le prix affiché avant de lancer, et tes crédits sont rendus si la génération échoue.',
      ] },
    ],
    faqs: [
      { q: 'Quelle IA anime les vidéos de fruits ?', a: 'Les images sont dessinées avec ChatGPT et chaque plan est animé avec Grok Imagine, avec les voix et les bruitages. Tu n’as besoin d’aucun compte chez eux.' },
      { q: 'Je peux faire une suite ?', a: 'Oui : coche « C’est une suite », colle la fin de la partie précédente et le studio continue l’histoire avec les mêmes personnages.' },
      { q: 'Les vidéos font combien de temps ?', a: 'Entre 66 et 75 secondes, au-dessus d’une minute, la durée récompensée par le programme créateurs de TikTok.' },
    ],
  },
  {
    path: '/fr/video-animee-3d-ia', lang: 'fr', alt: '/en/ai-3d-animated-video-generator',
    title: 'Créer une vidéo animée 3D avec l’IA pour TikTok — Storyit',
    description: 'Transforme une histoire vraie en vidéo animée 3D : décor, personnages cartoon, narration, musique, titre et sous-titres. 30 s, 1 min ou 2 min. Essai gratuit.',
    eyebrow: 'Animation 3D IA', h1: 'Crée une vidéo animée', highlight: 'en 3D avec l’IA.',
    intro: 'Choisis une histoire vraie, un décor et une voix : l’Animated Studio écrit le script, anime le monde 3D et les personnages, enregistre le narrateur et ajoute le titre accrocheur, les sous-titres et la musique.',
    cta: { label: 'Créer ma vidéo 3D', to: '/app/studio' },
    videos: ['fenetres-murees', 'coq-oeuf', 'interdit-de-mourir', 'geant-coule-au-port', 'shogun-des-chiens', 'palais-de-glace'],
    steps: [
      { title: 'Choisis un thème', body: 'Histoire absurde, inventions ratées, sport insolite, animaux, lois folles, rois capricieux… ou ton idée.' },
      { title: 'Clique les propositions', body: 'Le studio te propose un format, une histoire vraie, un décor et une voix : tu choisis en un clic.' },
      { title: 'Choisis la durée', body: '30 secondes, 1 minute ou 2 minutes, et le style du titre accrocheur.' },
      { title: 'Rendu automatique', body: 'Script, plans de caméra, voix, rendu 3D, musique et bruitages : la vidéo arrive prête à publier.' },
    ],
    sections: [
      { h2: 'Des histoires vraies qui retiennent jusqu’à la fin', body: [
        'Les faits réels qui semblent inventés font partie des contenus les plus partagés : un pont qui s’effondre à cause de soldats au pas, un coq jugé pour avoir pondu un œuf, une ville où il est interdit de mourir. Le studio vérifie les faits et construit un hook, un rebondissement et une chute.',
      ] },
      { h2: 'Un vrai monde 3D, pas un diaporama', body: [
        'Chaque vidéo est rendue image par image : décor peint en 3D, personnages cartoon animés, mouvements de caméra, narration synchronisée, sous-titres mot à mot et titre géant pendant les premières secondes.',
      ] },
      { h2: 'Prix', body: [
        'Une vidéo de 30 secondes coûte 3 500 crédits, 1 minute 6 000 crédits et 2 minutes 12 000 crédits. La discussion avec le studio est gratuite et les crédits sont rendus si le rendu échoue.',
      ] },
    ],
    faqs: [
      { q: 'Dans quelles langues ?', a: 'La narration peut être en français, en anglais ou en espagnol, avec plusieurs voix au choix.' },
      { q: 'Combien de temps prend le rendu ?', a: 'Comptez une quinzaine de minutes pour une vidéo d’une minute. Tu peux fermer la page : la vidéo arrive dans ta bibliothèque.' },
      { q: 'Combien de vidéos par mois ?', a: 'Jusqu’à 12 vidéos de 30 secondes par mois avec l’offre Creator, 30 avec Pro et 45 avec Studio.' },
    ],
  },
  {
    path: '/fr/monetiser-tiktok-video-ia', lang: 'fr', alt: '/en/make-money-tiktok-ai-videos',
    title: 'Monétiser TikTok avec des vidéos IA : le guide — Storyit',
    description: 'Comment gagner de l’argent sur TikTok avec des vidéos IA : règles du programme créateurs, durée de plus d’une minute, label IA, formats qui marchent et comment les produire chaque jour.',
    eyebrow: 'Guide monétisation', h1: 'Monétiser TikTok', highlight: 'avec des vidéos IA.',
    intro: 'Les vidéos IA peuvent être monétisées sur TikTok si elles respectent les règles : contenu original, plus d’une minute, label « contenu généré par IA ». Voici ce qu’il faut savoir et comment produire ce format chaque jour avec Storyit.',
    cta: FR_CTA,
    videos: ['banane-honnete', 'fenetres-murees', 'prix-de-la-trahison', 'grecs-150-contre-1', 'mensonge-mere', 'cache-oreilles'],
    steps: [
      { title: 'Vérifie l’éligibilité', body: 'Le programme de TikTok demande 18 ans, un pays éligible (la France l’est), 10 000 abonnés et 100 000 vues sur 30 jours.' },
      { title: 'Publie plus d’une minute', body: 'Seules les vidéos originales de plus d’une minute sont rémunérées : c’est la durée des vidéos du Prompt Studio.' },
      { title: 'Labellise l’IA', body: 'Active le label « contenu généré par IA » à la publication : c’est obligatoire et ça protège ton compte.' },
      { title: 'Publie régulièrement', body: 'Une série avec des cliffhangers donne une raison de revenir. Storyit te permet d’en produire une par jour.' },
    ],
    sections: [
      { h2: 'Les vidéos IA sont-elles autorisées ?', body: [
        'Oui, à condition d’être originales et clairement signalées comme générées par IA. Les contenus copiés, les compilations et les vidéos trompeuses sont exclus. Une histoire originale écrite et animée avec Storyit est une création originale : tu en gardes tous les droits.',
      ] },
      { h2: 'Les formats qui font des vues', body: [
        'Les mini-dramas de fruits et les histoires vraies en 3D combinent ce que l’algorithme récompense : une accroche immédiate, une forte rétention, des commentaires (« Team fraise ou Team citron ? ») et des partages. Une série en plusieurs parties fait revenir les mêmes spectateurs.',
      ] },
      { h2: 'Ce qu’il faut savoir sur les revenus', body: [
        'Les revenus dépendent des vues qualifiées, du pays de ton audience et des règles de TikTok, qui changent souvent. Sur nos propres comptes, ce format a déjà généré des revenus réels, mais personne ne peut te garantir un montant : vise la régularité et la qualité.',
      ] },
    ],
    faqs: [
      { q: 'Combien rapporte TikTok pour 1 000 vues ?', a: 'Cela varie selon le pays de l’audience, la durée de visionnage et les règles du programme. Les vidéos de plus d’une minute avec une bonne rétention sont les mieux rémunérées.' },
      { q: 'Faut-il montrer son visage ?', a: 'Non. Les vidéos de fruits et d’animation 3D permettent de créer un compte sans jamais apparaître à l’écran.' },
      { q: 'Instagram et YouTube paient aussi ?', a: 'Oui, chacun a ses propres programmes et règles. Les vidéos verticales de Storyit fonctionnent sur TikTok, Reels et Shorts.' },
    ],
  },
  {
    path: '/fr/traduire-video-ia', lang: 'fr', alt: '/en/ai-video-translator',
    title: 'Traduire une vidéo avec l’IA (voix et sous-titres) — Storyit',
    description: 'Traduis une vidéo verticale en anglais, espagnol ou français : nouvelle voix, musique d’origine conservée, sous-titres incrustés remplacés. 3 500 crédits par minute.',
    eyebrow: 'Traduction vidéo IA', h1: 'Traduis une vidéo', highlight: 'avec l’IA.',
    intro: 'Envoie une vidéo verticale : Storyit sépare la voix de la musique, traduit chaque phrase pour qu’elle tienne au même moment, enregistre une nouvelle voix et remplace les sous-titres incrustés. Le montage, la musique et les bruitages restent identiques.',
    cta: { label: 'Traduire une vidéo', to: '/app/translate' },
    videos: ['fenetres-murees', 'fenetres-murees-en'],
    steps: [
      { title: 'Envoie ta vidéo', body: 'MP4, MOV ou WebM, jusqu’à 3 minutes. Une vidéo horizontale est recadrée en 9:16.' },
      { title: 'Choisis la langue', body: 'Français, anglais ou espagnol, et la nouvelle voix parmi plusieurs narrateurs.' },
      { title: 'L’IA traduit', body: 'Séparation voix/musique, transcription, traduction au même tempo, nouvelle voix et nouveaux sous-titres.' },
      { title: 'Télécharge', body: 'La vidéo traduite arrive dans ta bibliothèque en 5 à 10 minutes, prête à publier.' },
    ],
    sections: [
      { h2: 'Touche d’autres pays avec la même vidéo', body: [
        'Une vidéo qui marche en français a de bonnes chances de marcher en anglais ou en espagnol. La traduction te permet d’ouvrir un compte dans une autre langue sans refaire tes vidéos.',
      ] },
      { h2: 'La musique et le montage ne bougent pas', body: [
        'La voix d’origine est séparée de la musique et des effets, puis remplacée par la nouvelle voix au même volume. Les sous-titres blancs incrustés sont effacés et remplacés par des sous-titres traduits mot à mot.',
      ] },
    ],
    faqs: [
      { q: 'Combien ça coûte ?', a: '3 500 crédits par minute de vidéo commencée, remboursés si la traduction échoue.' },
      { q: 'Je peux garder l’image intacte ?', a: 'Oui : décoche « Remplacer les sous-titres incrustés » et seule la voix est traduite.' },
    ],
  },
  // ---------------------------------------------------------------- English
  {
    path: '/en/ai-fruit-video-generator', lang: 'en', alt: '/fr/generateur-video-ia-fruits',
    title: 'AI Fruit Video Generator (Fruit Drama) for TikTok — Storyit',
    description: 'Make the viral AI fruit videos (Fruit Drama) from TikTok: story, characters, images, animation and editing done for you. Start free with 3,000 credits.',
    eyebrow: 'AI Fruit Drama', h1: 'AI fruit video', highlight: 'generator.',
    intro: 'Fruit mini-dramas are exploding on TikTok: a betrayed strawberry, a jealous lemon, an honest banana. Storyit writes the story, creates the characters, animates every scene and edits the final video for you.',
    cta: EN_CTA,
    videos: ['banane-honnete', 'plaque-de-cuisson', 'chevelure-sans-fin', 'puits-magique', 'mensonge-mere', 'prix-de-la-trahison'],
    steps: [
      { title: 'Pick the style', body: 'Fruits, nails, everyday objects or gemstones: the style stays locked for the whole series.' },
      { title: 'Tell the story', body: 'A few lines are enough, or ask the studio for 3 stories. Today’s trending concepts are suggested too.' },
      { title: 'Script and prompts', body: 'Hook, a timed 66-75 second breakdown, dialogue, image and animation prompts, cover and caption.' },
      { title: 'Automatic video', body: 'Click “Generate the video”: images, animation and editing are done and the video lands in your library.' },
    ],
    sections: [
      { h2: 'Why AI fruit videos work so well', body: [
        'Characters you recognise in a second, exaggerated emotions and stories about betrayal, family or money: Fruit Drama ticks every retention box. Each episode ends on a cliffhanger that makes viewers follow for the next part.',
        'The Prompt Studio applies these rules to every project: a shock first line at 0.1 s, 4-5 words per second, a mini-hook at the end of each shot and a quotable line that drives comments.',
      ] },
      { h2: 'Characters that stay the same from scene to scene', body: [
        'Consistency is the hard part with AI. Storyit draws a character sheet first, then every scene image from that sheet, and locks each character’s head and outfit in the animation prompts.',
      ] },
      { h2: 'Pricing', body: [
        'A full Prompt Studio project (story, script and every prompt) costs 1,500 credits. The automatic video is priced by quality and length, shown before you start, and refunded if the generation fails.',
      ] },
    ],
    faqs: [
      { q: 'Which AI animates the fruit videos?', a: 'Images are drawn with ChatGPT and every shot is animated with Grok Imagine, with voices and sound effects. You don’t need an account with either.' },
      { q: 'Can I make a part 2?', a: 'Yes: tick “It’s a sequel”, paste the end of the previous part and the studio continues the story with the same characters.' },
      { q: 'How long are the videos?', a: '66 to 75 seconds, over one minute, the length TikTok’s Creator Rewards Program pays for.' },
    ],
  },
  {
    path: '/en/ai-3d-animated-video-generator', lang: 'en', alt: '/fr/video-animee-3d-ia',
    title: 'AI 3D Animated Video Generator for TikTok — Storyit',
    description: 'Turn a true story into a 3D animated video: decor, cartoon characters, narration, music, hook title and captions. 30 s, 1 min or 2 min. Start free.',
    eyebrow: 'AI 3D animation', h1: 'AI 3D animated', highlight: 'video generator.',
    intro: 'Pick a true story, a decor and a voice: the Animated Studio writes the script, animates the 3D world and the characters, records the narrator and adds the hook title, captions and music.',
    cta: { label: 'Create my 3D video', to: '/app/studio' },
    videos: ['fenetres-murees', 'coq-oeuf', 'interdit-de-mourir', 'geant-coule-au-port', 'shogun-des-chiens', 'palais-de-glace'],
    steps: [
      { title: 'Choose a theme', body: 'Absurd history, failed inventions, odd sports, clever animals, crazy laws, whimsical kings… or your own idea.' },
      { title: 'Click the proposals', body: 'The studio suggests a format, a true story, a decor and a voice: you pick in one click.' },
      { title: 'Choose the length', body: '30 seconds, 1 minute or 2 minutes, and the style of the hook title.' },
      { title: 'Automatic render', body: 'Script, camera shots, voice, 3D render, music and sound effects: the video arrives ready to post.' },
    ],
    sections: [
      { h2: 'True stories that keep people watching', body: [
        'Real facts that sound made up are among the most shared videos: a bridge brought down by marching soldiers, a rooster put on trial for laying an egg, a town where dying is forbidden. The studio checks the facts and builds a hook, a twist and an ending.',
      ] },
      { h2: 'A real 3D world, not a slideshow', body: [
        'Every video is rendered frame by frame: a painted 3D decor, animated cartoon characters, camera moves, synced narration, word-by-word captions and a giant hook title in the first seconds.',
      ] },
      { h2: 'Pricing', body: [
        'A 30-second video costs 3,500 credits, 1 minute 6,000 credits and 2 minutes 12,000 credits. Chatting with the studio is free and credits are refunded if the render fails.',
      ] },
    ],
    faqs: [
      { q: 'Which languages?', a: 'Narration in English, French or Spanish, with several voices to choose from.' },
      { q: 'How long does a render take?', a: 'About fifteen minutes for a one-minute video. You can close the page: the video lands in your library.' },
      { q: 'How many videos a month?', a: 'Up to 12 thirty-second videos a month with Creator, 30 with Pro and 45 with Studio.' },
    ],
  },
  {
    path: '/en/make-money-tiktok-ai-videos', lang: 'en', alt: '/fr/monetiser-tiktok-video-ia',
    title: 'How to Make Money on TikTok with AI Videos — Storyit',
    description: 'Can AI videos be monetized on TikTok? The Creator Rewards rules, the one-minute length, the AI label, the formats that work and how to make one every day.',
    eyebrow: 'Monetization guide', h1: 'Make money on TikTok', highlight: 'with AI videos.',
    intro: 'AI videos can be monetized on TikTok when they follow the rules: original content, longer than one minute, labeled as AI-generated. Here is what you need to know, and how to produce this format every day with Storyit.',
    cta: EN_CTA,
    videos: ['banane-honnete', 'fenetres-murees', 'prix-de-la-trahison', 'grecs-150-contre-1', 'mensonge-mere', 'cache-oreilles'],
    steps: [
      { title: 'Check eligibility', body: 'TikTok’s program asks for 18+, an eligible country, 10,000 followers and 100,000 views in the last 30 days.' },
      { title: 'Post over one minute', body: 'Only original videos longer than one minute are paid: that is the length of Prompt Studio videos.' },
      { title: 'Label the AI', body: 'Turn on the “AI-generated content” label when you post: it is required and it protects your account.' },
      { title: 'Post consistently', body: 'A series with cliffhangers gives viewers a reason to come back. Storyit lets you make one every day.' },
    ],
    sections: [
      { h2: 'Are AI videos allowed?', body: [
        'Yes, as long as they are original and clearly labeled as AI-generated. Copied content, compilations and misleading videos are excluded. An original story written and animated with Storyit is your own creation: you keep all rights.',
      ] },
      { h2: 'The formats that get views', body: [
        'Fruit mini-dramas and 3D true stories combine what the algorithm rewards: an instant hook, strong retention, comments (“Team strawberry or Team lemon?”) and shares. A multi-part series brings the same viewers back.',
      ] },
      { h2: 'What to know about earnings', body: [
        'Earnings depend on qualified views, your audience’s country and TikTok’s rules, which change often. This format has earned real money on our own accounts, but nobody can promise you an amount: aim for consistency and quality.',
      ] },
    ],
    faqs: [
      { q: 'How much does TikTok pay per 1,000 views?', a: 'It varies with the audience’s country, watch time and the program’s rules. Videos over one minute with strong retention earn the most.' },
      { q: 'Do I need to show my face?', a: 'No. Fruit and 3D animation videos let you grow an account without ever appearing on screen.' },
      { q: 'Do Instagram and YouTube pay too?', a: 'Yes, each has its own programs and rules. Storyit’s vertical videos work on TikTok, Reels and Shorts.' },
    ],
  },
  {
    path: '/en/ai-video-translator', lang: 'en', alt: '/fr/traduire-video-ia',
    title: 'AI Video Translator (Voice and Captions) — Storyit',
    description: 'Translate a vertical video into English, Spanish or French: a new voice, the original music kept, burned-in captions replaced. 3,500 credits per minute.',
    eyebrow: 'AI video translation', h1: 'Translate any video', highlight: 'with AI.',
    intro: 'Upload a vertical video: Storyit separates the voice from the music, translates each sentence so it fits the same moment, records a new voice and replaces the burned-in captions. The edit, the music and the sound effects stay exactly the same.',
    cta: { label: 'Translate a video', to: '/app/translate' },
    videos: ['fenetres-murees', 'fenetres-murees-en'],
    steps: [
      { title: 'Upload your video', body: 'MP4, MOV or WebM, up to 3 minutes. A horizontal video is cropped to 9:16.' },
      { title: 'Pick the language', body: 'English, Spanish or French, and the new voice from several narrators.' },
      { title: 'The AI translates', body: 'Voice and music separation, transcription, same-tempo translation, a new voice and new captions.' },
      { title: 'Download', body: 'The translated video lands in your library in 5 to 10 minutes, ready to post.' },
    ],
    sections: [
      { h2: 'Reach new countries with the same video', body: [
        'A video that works in one language has a good chance of working in another. Translation lets you open an account in a new language without remaking your videos.',
      ] },
      { h2: 'The music and the edit stay the same', body: [
        'The original voice is separated from the music and effects, then replaced by the new voice at the same level. White burned-in captions are erased and replaced by word-by-word translated captions.',
      ] },
    ],
    faqs: [
      { q: 'How much does it cost?', a: '3,500 credits per started minute of video, refunded if the translation fails.' },
      { q: 'Can I keep the picture untouched?', a: 'Yes: untick “Replace burned-in captions” and only the voice is translated.' },
    ],
  },
];

export const seoPage = (path: string) => SEO_PAGES.find((p) => p.path === path);
