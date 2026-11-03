import type { SceneDraft, StoryConcept } from '@/types/domain';

const STYLE = 'hyper-real 3D fruit characters, glossy subsurface skin, cinematic soft key light, shallow depth of field, vertical 9:16';

const beats: [string, string, string | null, string][] = [
  ['The Fruit Bowl at Dawn', 'Morning light spills over the kitchen counter fruit bowl.', null, 'slow dolly-in across the counter, dust motes in light'],
  ['Lemon Arrives', 'Lemon rolls in, polished and smug, wearing tiny sunglasses.', 'Lemon: "Did someone order zest?"', 'lemon rolls into frame and stops with a spin'],
  ['Strawberry Notices', 'Strawberry glances up from her leaf, cheeks deepening red.', null, 'rack focus from lemon to strawberry'],
  ['The Compliment', 'Lemon compliments Kiwi\'s fuzz, loudly.', 'Lemon: "Kiwi, that texture is iconic."', 'over-the-shoulder two-shot'],
  ['Jealousy Spark', 'Strawberry\'s seeds tremble. A single juice tear forms.', 'Strawberry: "Iconic? Really?"', 'extreme close-up on strawberry, slow push'],
  ['Banana Gossip', 'Banana leans in to whisper to Grape cluster.', 'Banana: "Oh, this is going to split."', 'whip pan to banana and grapes'],
  ['Confrontation', 'Strawberry slides across the bowl to face Lemon.', 'Strawberry: "We need to talk. Now."', 'low angle hero shot of strawberry'],
  ['Lemon Deflects', 'Lemon adjusts sunglasses, unbothered.', 'Lemon: "Jealousy isn\'t your color, babe."', 'static medium shot, lemon smirks'],
  ['The Bowl Gasps', 'Every fruit in the bowl turns at once.', 'Grapes: "Ohhhh!"', 'quick circular orbit around the bowl'],
  ['Flashback', 'Sepia memory: Lemon and Strawberry at the farmers market.', null, 'dreamy handheld, warm sepia grade'],
  ['The Secret', 'Strawberry reveals she saw Lemon with Lime last night.', 'Strawberry: "I know about Lime."', 'dramatic zoom on lemon\'s face'],
  ['Lemon Cracks', 'A crack of vulnerability — Lemon\'s sunglasses slip.', 'Lemon: "Lime is... my cousin."', 'sunglasses slide off in slow motion'],
  ['Twist', 'Lime appears at the edge of the bowl, waving shyly.', 'Lime: "Hi, I\'m the cousin."', 'reveal shot, lime peeks over rim'],
  ['Reconciliation', 'Strawberry and Lemon lean together, sheepish.', 'Strawberry: "...So, smoothie later?"', 'warm two-shot, golden backlight'],
  ['Cliffhanger', 'A human hand reaches into the bowl — toward Strawberry.', 'Narrator: "Next episode: The Blender."', 'top-down shot, shadow falls over bowl, cut to black'],
];

export const FRUIT_DRAMA_SCENES: SceneDraft[] = beats.map(([title, narration, dialogue, camera], i) => ({
  position: i + 1,
  title,
  narration,
  dialogue,
  image_prompt: `${narration} ${STYLE}`,
  video_prompt: `${camera}, 3–4s, ${STYLE}`,
  duration_seconds: i === 14 ? 5 : 4,
}));

export const FRUIT_DRAMA_CONCEPTS: StoryConcept[] = [
  {
    id: 'c1',
    title: 'Zest & Jealousy',
    logline: 'A possessive strawberry suspects her arrogant lemon boyfriend of cheating — with a lime.',
    tone: 'Telenovela melodrama',
    hook: 'Opens on a single juice tear rolling down a strawberry.',
    characters: [
      { name: 'Fresa', species: 'Strawberry', personality: 'Jealous, passionate, secretly insecure', visual_description: 'Ripe red strawberry, glossy seeds, leafy crown worn like a tiara' },
      { name: 'Limon', species: 'Lemon', personality: 'Arrogant, charming, allergic to apologies', visual_description: 'Bright yellow lemon with tiny aviator sunglasses' },
    ],
  },
  {
    id: 'c2',
    title: 'Sour Grapes Society',
    logline: 'Lemon becomes the bowl\'s new influencer; Strawberry plots her comeback.',
    tone: 'Satirical reality-TV',
    hook: 'Confessional cam: "I\'m not here to make fruit salad."',
    characters: [
      { name: 'Berry', species: 'Strawberry', personality: 'Ambitious, competitive', visual_description: 'Strawberry with ring light reflection in her seeds' },
      { name: 'Citro', species: 'Lemon', personality: 'Vain, viral-obsessed', visual_description: 'Lemon holding a tiny phone selfie-style' },
    ],
  },
  {
    id: 'c3',
    title: 'The Smoothie Wedding',
    logline: 'Days before the wedding, the bride-strawberry finds a lemon love letter.',
    tone: 'Romantic thriller',
    hook: 'A crumpled letter dripping with lemon juice.',
    characters: [
      { name: 'Rosa', species: 'Strawberry', personality: 'Romantic, fierce when betrayed', visual_description: 'Strawberry in a tiny lace veil' },
      { name: 'Agrio', species: 'Lemon', personality: 'Cold, calculating, poetic', visual_description: 'Waxy lemon with a pencil mustache' },
    ],
  },
];
