// The VideoSpec: everything one animated short needs, as data. Claude (Anthropic API) writes it from the client's
// brief; the engine (src/engine/*) renders it. Times are never written as seconds by Claude: every cue points at a
// word of the narration ({ line, word }), and resolve.ts turns it into seconds from the voice's word timings, so the
// same spec re-times itself to any voice, language or speed.
//
// World units are metres. Axes (inherited from the bridge template): y up; the river (when present) runs along x
// between banks at z = -30 / +30; the bridge deck (when present) spans z = -30..30 at height 6 (D0).

export type V3 = [number, number, number];
export type V2 = [number, number];

/** a moment in the narration: word `word` (0-based) of script line `line` (0-based); `offset` seconds after its start */
export type Cue = { line: number; word: number; offset?: number } | { at: number }; // { at } = absolute seconds (engine use)

export type Light = "day" | "golden";
export type Expr = "neutral" | "stern" | "grin" | "laugh" | "whistle" | "nervous" | "shock" | "relief" | "relief_open" | "dazed"
  | "pained" | "smile" | "smile_closed" | "lick";

/** Kenney CC0 models shipped in public/kenney (see KITS in catalog.ts) */
export type KitName = string;

export type Decor = {
  /** the ground everywhere that is not water, quay or road */
  ground: "grass" | "cobble";
  /** a river along x between the banks (z = +-30), with stone embankments and quays */
  river: boolean;
  /** the template's chain suspension bridge across the river (needs river) */
  bridge?: { era: "old" | "new" };
  /** the painted 19th-century town on both banks (houses, chapel, mill, market); seed changes the layout */
  town?: { seed: number };
  /** extra Kenney props: base on the ground at (x, z), height h metres, yaw radians */
  props?: { kit: KitName; x: number; z: number; h: number; yaw?: number }[];
  /** animated set pieces: racing eights on the river, a rowing boat that tips, a road barrier with a no-cars sign */
  pieces?: Piece[];
  /** a football stadium centred on the origin (pitch 105 x 68 m, length along x; goals at x = -52.5 / +52.5, touchlines
   *  at z = -34 / +34): painted crowd in the two teams' colours, boards, roofs, floodlights. Needs river: false. */
  stadium?: { home?: string; away?: string };
  /** a medieval castle centred on the origin: curtain walls at x, z = +-30 (9 m), corner towers, the keep at the back
   *  (x -8..8, z -24..-8), the gate in the front wall at z = +30 (x -2.6..2.6), a cobbled courtyard. Needs river: false. */
  castle?: { roof?: string; banner?: "red" | "green" };
  /** a modern city: main road along x (z -7..7), cross street along z (x -7..7), pavements to |z| = 12, buildings beyond;
   *  lab: also a laboratory interior centred on (0, -220). Needs river: false. */
  city?: { lab?: boolean };
  /** a harbour: land and quay for z >= 0 (houses from z = 15), the sea for z < 0, a pier out to z = -40 (x -3..3), two
   *  moored sailing ships, a breakwater and a lighthouse at (70, -62). Needs river: false. */
  harbour?: { hull?: string };
  /** a farm: dirt yard around the origin, red barn (x -22..-6, z -24..-12), farmhouse at (16, -18), paddock (x 6..26,
   *  z 2..18), pond at (-16, 12), haystacks, crop fields, a windmill. Animals are story drawings (art). river: false. */
  farm?: Record<string, never>;
  /** flag on the bridge towers */
  flag?: "england" | "union" | "france" | "none";
};

export type Piece =
  | { kind: "eights"; lanes: [number, number]; colors: [string, string]; pass: Cue; speed?: number }
  | { kind: "rowboat"; at: V2; lean: Cue; tip: Cue; hull?: string }
  | { kind: "barrier"; z: number; sign?: boolean }
  /** a football: rests at the first key's spot, then travels key to key (rolling on the grass, or flying in an arc
   *  whose top is `lift` m above the ground when the key has one: a lob, a shot, a clearance); rests after the last */
  | { kind: "ball"; keys: { at: Cue; pos: V2; lift?: number }[] }
  /** a car driving along the main road (city) in lane z, from x0 at cue `from` to x1 at cue `to` (heading toward x1) */
  | { kind: "car"; color?: string; lane: number; x0: number; x1: number; from: Cue; to: Cue }
  /** a sailing ship on the sea (harbour) in lane z, from x0 at cue `from` to x1 at cue `to` (bow toward x1) */
  | { kind: "ship"; hull?: string; sail?: string; lane: number; x0: number; x1: number; from: Cue; to: Cue };

export type OutfitName = "townsfolk" | "kid" | "owner" | "modern" | "soldier" | "officer" | "rower" | "player" | "referee" | "knight" | "king" | "queen" | "peasant" | "scientist" | "sailor" | "captain" | "fisherman" | "farmer" | "art";
export type Outfit = { name: OutfitName; variant?: number; color?: string; /** name "art": the id of a drawing in spec.art */ art?: string };

/** what a group of characters does from a cue onward */
export type Action = {
  from: Cue;
  /** stand: hold position; walk: move to `to` at `speed` m/s then stand; stroll: wander back and forth along z; sit; cheer: stand + wave */
  do: "stand" | "walk" | "stroll" | "sit" | "cheer";
  to?: V2 | "rail_minus_x" | "rail_plus_x";
  speed?: number;
  expr?: Expr | Expr[];
  /** only these members of the group (indices); default all */
  who?: number[];
};

export type Group = {
  id: string;
  outfit: Outfit | Outfit[];
  /** one person at `at`, or `count` people spread over the rectangle `area` [x0, z0, x1, z1] */
  at?: V2;
  count?: number;
  area?: [number, number, number, number];
  /** stand on the bridge deck (follows its roll/sway) */
  onDeck?: boolean;
  /** appear from this cue (walking in from the nearest bridge end when onDeck) */
  enter?: Cue;
  actions: Action[];
  scale?: number;
};

/** a camera framing relative to a subject: the lens sits `dist` m away at `azimuth` deg (0 = looking +z, 90 = looking -x)
 *  and `elevation` deg above the subject point; or explicit pos/look */
export type Framing =
  | { subject: string | V3; dist: number; azimuth: number; elevation: number; height?: number; fov?: number; roll?: number }
  | { pos: V3; look: V3; fov?: number; roll?: number };

export type CamKey = {
  at: Cue;
  framing: Framing;
  /** cut (hard) or glide (smootherstep over `dur` frames, default 24) into this framing */
  move?: "cut" | "glide";
  dur?: number;
  /** push-in rate per frame (0.0015-0.0035), and an optional punch for ~1 s */
  push?: number;
  punch?: boolean;
  /** zoom push (lens stays put) instead of a dolly push, for lenses next to walls */
  zoom?: boolean;
};

export type BridgeMotion = { from: Cue; roll?: number; sway?: number; swayHz?: number; to?: Cue };

export type Shot = {
  id: number;
  start: Cue; // the shot ends where the next one starts
  light: Light;
  /** crossfade length (frames) into this shot; 0 = cut */
  xfade?: number;
  /** groups visible in this shot (default all) */
  groups?: string[];
  cams: CamKey[];
  /** depth of field: blur-disc radius in px at 1080 for infinity (0 = all sharp); focus = group id / point (default look point) */
  dof?: { at?: Cue; cInf: number; focus?: string | V3 }[];
  bridge?: BridgeMotion[];
  /** hide the bridge (demolished) or paint it green and gold */
  bridgeEra?: "old" | "gone" | "new";
  /** effect cards: creaks on the chain, a crack on a wall, a splash, a burst */
  fx?: { kind: "creak" | "crack" | "splash" | "burst" | "stars"; from: Cue; to?: Cue; at: V3; size?: number }[];
  /** flash-forward: inside this shot, story time runs as if the shot started at this cue (the hook shows the climax) */
  storyFrom?: Cue;
  /** set pieces visible in this shot (default none) */
  show?: Piece["kind"][];
  /** impact shakes */
  kicks?: { at: Cue; amount: number }[];
};

export type SoundCue = {
  at: Cue;
  kind: "cheer" | "murmur" | "whoa" | "creak" | "chain_groan" | "splash" | "crack" | "steps" | "bell" | "whoosh" | "knock" | "whistle" | "kick";
  dur?: number;
  level?: number; // LU relative to the voice, before the -6 dB event rule (default per kind)
  pan?: number;
};

export type MusicPlan = {
  mood: "regatta_march" | "light_comedy" | "tension" | "warm";
  /** dead stops (silence) and buttons (a chord hit) on narration cues */
  stops?: Cue[];
  buttons?: Cue[];
  /** music level vs the voice, LU (default -14) */
  level?: number;
};

export type VideoSpec = {
  version: 1;
  title: string;
  language: string; // "fr", "en", ...
  /** the narration, one sentence or beat per line (cues index into it) */
  script: string[];
  /** facts and sources (shown to the client, never on screen) */
  facts?: { claim: string; source: string }[];
  decor: Decor;
  /** story-specific drawings (SVG, house style) for characters, animals and objects the engine has no model for */
  art?: { id: string; what: string; svg: string; alt?: string; height: number }[];
  /** every character, animal and object the narration names, and the group that shows it on screen */
  cast?: { name: string; shows: string }[];
  groups: Group[];
  shots: Shot[];
  sound?: SoundCue[];
  music?: MusicPlan;
  /** white flash frames after the hook (frame index is resolved from this cue) */
  flash?: Cue;
  /** total length in seconds (default: last word + 2.5 s) */
  duration?: number;
};

/** word timings of the recorded voice (ElevenLabs alignment or Kokoro durations), seconds from the start of voice.wav */
export type Word = { word: string; start: number; end: number; line: number };
