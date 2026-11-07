// Zod mirror of src/spec.ts (the VideoSpec contract), used as Claude's structured-output schema by the render
// worker (worker/pipeline.ts). Node only.
// Keep it in step with src/spec.ts: a field Claude writes here must exist there, with the same meaning.
import { z } from 'zod';

const V2 = z.tuple([z.number(), z.number()]);
const V3 = z.tuple([z.number(), z.number(), z.number()]);
/** a moment in the narration: word `word` (0-based) of script line `line` (0-based), plus `offset` seconds */
const Cue = z.object({ line: z.number().int(), word: z.number().int(), offset: z.number().optional() });

const Expr = z.enum(['neutral', 'stern', 'grin', 'laugh', 'whistle', 'nervous', 'shock', 'relief', 'relief_open', 'dazed', 'pained', 'smile', 'smile_closed', 'lick']);
const Outfit = z.object({
  name: z.enum(['townsfolk', 'kid', 'owner', 'modern', 'soldier', 'officer', 'rower']),
  variant: z.number().int().optional(),
  color: z.string().optional().describe('hex colour, rowers only'),
});

const Piece = z.union([
  z.object({ kind: z.literal('eights'), lanes: V2, colors: z.tuple([z.string(), z.string()]), pass: Cue, speed: z.number().optional() }),
  z.object({ kind: z.literal('rowboat'), at: V2, lean: Cue, tip: Cue }),
  z.object({ kind: z.literal('barrier'), z: z.number(), sign: z.boolean().optional() }),
]);

const Decor = z.object({
  ground: z.enum(['grass', 'cobble']),
  river: z.boolean(),
  bridge: z.object({ era: z.enum(['old', 'new']) }).optional(),
  town: z.object({ seed: z.number().int() }).optional(),
  props: z.array(z.object({ kit: z.string(), x: z.number(), z: z.number(), h: z.number(), yaw: z.number().optional() })).optional(),
  pieces: z.array(Piece).optional(),
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
  area: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional().describe('[x0, z0, x1, z1]'),
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
  show: z.array(z.enum(['eights', 'rowboat', 'barrier'])).optional(),
  kicks: z.array(z.object({ at: Cue, amount: z.number() })).optional(),
});

const SoundCue = z.object({
  at: Cue,
  kind: z.enum(['cheer', 'murmur', 'whoa', 'creak', 'chain_groan', 'splash', 'crack', 'steps', 'bell', 'whoosh', 'knock']),
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
  const ids = new Set(s.groups.map((g) => g.id));
  if (ids.size !== s.groups.length) out.push('group ids must be unique');
  s.groups.forEach((g) => {
    if (!g.at && !g.area) out.push(`group ${g.id}: give "at" or "area"`);
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
      if ('subject' in c.framing && typeof c.framing.subject === 'string' && c.framing.subject !== 'eights' && !ids.has(c.framing.subject)) out.push(`shot ${sh.id} cam ${i}: unknown subject ${c.framing.subject}`);
    });
    (sh.groups ?? []).forEach((g) => { if (!ids.has(g)) out.push(`shot ${sh.id}: unknown group ${g}`); });
    (sh.fx ?? []).forEach((e, i) => { cue(e.from, `shot ${sh.id} fx ${i}`); cue(e.to, `shot ${sh.id} fx ${i} end`); });
    (sh.kicks ?? []).forEach((e, i) => cue(e.at, `shot ${sh.id} kick ${i}`));
    (sh.dof ?? []).forEach((e, i) => cue(e.at, `shot ${sh.id} dof ${i}`));
    if (sh.bridgeEra && sh.bridgeEra !== 'gone' && !s.decor.bridge) out.push(`shot ${sh.id}: bridgeEra without a bridge in the decor`);
  });
  if (s.decor.bridge && !s.decor.river) out.push('a bridge needs the river');
  if (!s.facts.length) out.push('list the facts the story relies on, with sources');
  return out;
}
