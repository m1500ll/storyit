// Zod mirror of src/spec.ts (the VideoSpec contract), used as Claude's structured-output schema by the render
// worker (worker/pipeline.ts). Node only.
// Keep it in step with src/spec.ts: a field Claude writes here must exist there, with the same meaning.
import { z } from 'zod';

// Fixed-length lists are plain arrays here: the SDK's structured-output converter rejects JSON-schema tuples.
// checkSpec() enforces their lengths (V2 = [x, z], V3 = [x, y, z], area = [x0, z0, x1, z1]).
const V2 = z.array(z.number()).describe('[x, z] in metres (exactly 2 numbers)');
const V3 = z.array(z.number()).describe('[x, y, z] in metres (exactly 3 numbers)');
/** a moment in the narration: word `word` (0-based) of script line `line` (0-based), plus `offset` seconds */
const Cue = z.object({ line: z.number().int(), word: z.number().int(), offset: z.number().optional() });

const Expr = z.enum(['neutral', 'stern', 'grin', 'laugh', 'whistle', 'nervous', 'shock', 'relief', 'relief_open', 'dazed', 'pained', 'smile', 'smile_closed', 'lick']);
const Outfit = z.object({
  name: z.enum(['townsfolk', 'kid', 'owner', 'modern', 'soldier', 'officer', 'rower', 'player', 'referee']),
  variant: z.number().int().optional(),
  color: z.string().optional().describe('hex colour: the rower or player kit'),
});

const Piece = z.union([
  z.object({ kind: z.literal('eights'), lanes: V2, colors: z.array(z.string()).describe('exactly 2 hex colours'), pass: Cue, speed: z.number().optional() }),
  z.object({ kind: z.literal('rowboat'), at: V2, lean: Cue, tip: Cue }),
  z.object({ kind: z.literal('barrier'), z: z.number(), sign: z.boolean().optional() }),
  z.object({ kind: z.literal('ball'), keys: z.array(z.object({ at: Cue, pos: V2, lift: z.number().optional().describe('arc top in metres: a lob or a shot') })).describe('the ball rests at the first key, then moves key to key') }),
]);

const Decor = z.object({
  ground: z.enum(['grass', 'cobble']),
  river: z.boolean(),
  bridge: z.object({ era: z.enum(['old', 'new']) }).optional(),
  town: z.object({ seed: z.number().int() }).optional(),
  props: z.array(z.object({ kit: z.string(), x: z.number(), z: z.number(), h: z.number(), yaw: z.number().optional() })).optional(),
  pieces: z.array(Piece).optional(),
  stadium: z.object({ home: z.string().optional(), away: z.string().optional() }).optional().describe('football stadium: needs river false, no bridge, no town'),
});

const Action = z.object({
  from: Cue,
  do: z.enum(['stand', 'walk', 'stroll', 'sit', 'cheer']),
  to: z.union([V2, z.enum(['rail_minus_x', 'rail_plus_x'])]).optional(),
  speed: z.number().optional(),
  expr: z.union([Expr, z.array(Expr)]).optional(),
  who: z.array(z.number().int()).optional(),
});

const Group = z.object({
  id: z.string(),
  outfit: z.union([Outfit, z.array(Outfit)]),
  at: V2.optional(),
  count: z.number().int().optional(),
  area: z.array(z.number()).optional().describe('[x0, z0, x1, z1] (exactly 4 numbers)'),
  onDeck: z.boolean().optional(),
  enter: Cue.optional(),
  actions: z.array(Action),
  scale: z.number().optional(),
});

const Framing = z.union([
  z.object({ subject: z.union([z.string(), V3]), dist: z.number(), azimuth: z.number(), elevation: z.number(), height: z.number().optional(), fov: z.number().optional(), roll: z.number().optional() }),
  z.object({ pos: V3, look: V3, fov: z.number().optional(), roll: z.number().optional() }),
]);

const CamKey = z.object({
  at: Cue,
  framing: Framing,
  move: z.enum(['cut', 'glide']).optional(),
  dur: z.number().int().optional(),
  push: z.number().optional(),
  punch: z.boolean().optional(),
  zoom: z.boolean().optional(),
});

const Shot = z.object({
  id: z.number().int(),
  start: Cue,
  light: z.enum(['day', 'golden']),
  xfade: z.number().int().optional(),
  groups: z.array(z.string()).optional(),
  cams: z.array(CamKey),
  dof: z.array(z.object({ at: Cue.optional(), cInf: z.number(), focus: z.union([z.string(), V3]).optional() })).optional(),
  bridge: z.array(z.object({ from: Cue, roll: z.number().optional(), sway: z.number().optional(), swayHz: z.number().optional(), to: Cue.optional() })).optional(),
  bridgeEra: z.enum(['old', 'gone', 'new']).optional(),
  fx: z.array(z.object({ kind: z.enum(['creak', 'crack', 'splash', 'burst', 'stars']), from: Cue, to: Cue.optional(), at: V3, size: z.number().optional() })).optional(),
  storyFrom: Cue.optional(),
  show: z.array(z.enum(['eights', 'rowboat', 'barrier', 'ball'])).optional(),
  kicks: z.array(z.object({ at: Cue, amount: z.number() })).optional(),
});

const SoundCue = z.object({
  at: Cue,
  kind: z.enum(['cheer', 'murmur', 'whoa', 'creak', 'chain_groan', 'splash', 'crack', 'steps', 'bell', 'whoosh', 'knock', 'whistle', 'kick']),
  dur: z.number().optional(),
  level: z.number().optional(),
  pan: z.number().optional(),
});

export const VideoSpecSchema = z.object({
  version: z.literal(1),
  title: z.string(),
  language: z.string(),
  script: z.array(z.string()).describe('the narration, one sentence or beat per line; cues index into it'),
  facts: z.array(z.object({ claim: z.string(), source: z.string() })),
  decor: Decor,
  groups: z.array(Group),
  shots: z.array(Shot),
  sound: z.array(SoundCue).optional(),
  music: z.object({
    mood: z.enum(['regatta_march', 'light_comedy', 'tension', 'warm']),
    stops: z.array(Cue).optional(),
    buttons: z.array(Cue).optional(),
  }).optional(),
  flash: Cue.optional(),
});
export type VideoSpecOut = z.infer<typeof VideoSpecSchema>;

/** the same word tokenizer as render-engine/src/resolve.ts */
export const tokens = (line: string) => line.match(/[\p{L}\p{N}'’-]+/gu)?.filter((t) => /[\p{L}\p{N}]/u.test(t)) ?? [];

/** checks the schema cannot express; returns a list of problems in plain English (empty = OK) */
export function checkSpec(s: VideoSpecOut): string[] {
  const out: string[] = [];
  const counts = s.script.map((l) => tokens(l).length);
  const words = counts.reduce((a, b) => a + b, 0);
  if (words < 140 || words > 230) out.push(`script has ${words} words; aim for 170-210 (55-60 s at ~3.5 words/s)`);
  const cue = (c: { line: number; word: number } | undefined, where: string) => {
    if (!c) return;
    if (c.line < 0 || c.line >= counts.length || c.word < 0 || c.word >= counts[c.line]!) out.push(`${where}: cue line ${c.line} word ${c.word} does not exist`);
  };
  const len = (a: unknown[] | undefined, n: number, where: string) => { if (a && a.length !== n) out.push(`${where}: needs exactly ${n} numbers, got ${a.length}`); };
  (s.decor.pieces ?? []).forEach((p, i) => {
    if (p.kind === 'eights') { len(p.lanes, 2, `piece ${i} lanes`); len(p.colors, 2, `piece ${i} colors`); }
    if (p.kind === 'rowboat') len(p.at, 2, `piece ${i} at`);
  });
  const ids = new Set(s.groups.map((g) => g.id));
  if (ids.size !== s.groups.length) out.push('group ids must be unique');
  s.groups.forEach((g) => {
    if (!g.at && !g.area) out.push(`group ${g.id}: give "at" or "area"`);
    len(g.at, 2, `group ${g.id} at`); len(g.area, 4, `group ${g.id} area`);
    g.actions.forEach((a, i) => { if (Array.isArray(a.to)) len(a.to, 2, `group ${g.id} action ${i} to`); });
    cue(g.enter, `group ${g.id} enter`);
    g.actions.forEach((a, i) => cue(a.from, `group ${g.id} action ${i}`));
  });
  if (!s.shots.length) out.push('no shots');
  let prev = -1;
  s.shots.forEach((sh, k) => {
    const pos = sh.start.line * 1000 + sh.start.word;
    if (k > 0 && pos <= prev) out.push(`shot ${sh.id} starts before or with the previous shot`);
    prev = pos;
    cue(sh.start, `shot ${sh.id} start`);
    if (!sh.cams.length) out.push(`shot ${sh.id}: no camera`);
    sh.cams.forEach((c, i) => {
      cue(c.at, `shot ${sh.id} cam ${i}`);
      if ('pos' in c.framing) { len(c.framing.pos, 3, `shot ${sh.id} cam ${i} pos`); len(c.framing.look, 3, `shot ${sh.id} cam ${i} look`); }
      else if (Array.isArray(c.framing.subject)) len(c.framing.subject, 3, `shot ${sh.id} cam ${i} subject`);
      if ('subject' in c.framing && typeof c.framing.subject === 'string' && c.framing.subject !== 'eights' && c.framing.subject !== 'ball' && !ids.has(c.framing.subject)) out.push(`shot ${sh.id} cam ${i}: unknown subject ${c.framing.subject}`);
    });
    (sh.groups ?? []).forEach((g) => { if (!ids.has(g)) out.push(`shot ${sh.id}: unknown group ${g}`); });
    (sh.fx ?? []).forEach((e, i) => { cue(e.from, `shot ${sh.id} fx ${i}`); cue(e.to, `shot ${sh.id} fx ${i} end`); len(e.at, 3, `shot ${sh.id} fx ${i} at`); });
    (sh.kicks ?? []).forEach((e, i) => cue(e.at, `shot ${sh.id} kick ${i}`));
    (sh.dof ?? []).forEach((e, i) => { cue(e.at, `shot ${sh.id} dof ${i}`); if (Array.isArray(e.focus)) len(e.focus, 3, `shot ${sh.id} dof ${i} focus`); });
    if (sh.bridgeEra && sh.bridgeEra !== 'gone' && !s.decor.bridge) out.push(`shot ${sh.id}: bridgeEra without a bridge in the decor`);
  });
  if (s.decor.bridge && !s.decor.river) out.push('a bridge needs the river');
  if (s.decor.stadium && (s.decor.river || s.decor.bridge || s.decor.town)) out.push('the stadium stands alone: river false, no bridge, no town');
  if (s.decor.stadium) s.shots.forEach((sh) => sh.cams.forEach((c, i) => {
    if ('pos' in c.framing && c.framing.pos[1] < 6.4) out.push(`shot ${sh.id} cam ${i}: the lens is under the pitch (y must be above 6.4, the grass is at y = 6)`);
  }));
  const ball = s.decor.pieces?.find((p) => p.kind === 'ball');
  if (ball && 'keys' in ball) ball.keys.forEach((k, i) => { cue(k.at, `ball key ${i}`); len(k.pos, 2, `ball key ${i} pos`); });
  if (s.shots.some((sh) => sh.show?.includes('ball')) && !ball) out.push('a shot shows the ball but decor.pieces has no ball');
  if (s.shots.some((sh) => sh.cams.some((c) => 'subject' in c.framing && c.framing.subject === 'ball')) && !ball) out.push('a camera follows the ball but decor.pieces has no ball');
  if (!s.facts.length) out.push('list the facts the story relies on, with sources');
  return out;
}
