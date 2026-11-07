// The sound timeline of a VideoSpec (all times in seconds), read by audio/spec_audio.py. It uses the engine's own
// runtime (story.ts: shots, camera keys, cues), so picture and sound are timed by the same code.
import type { VideoSpec, Word } from "../src/spec.js";
import { FPS } from "../src/resolve.js";
import { loadSpec, SHOTS, TL, FLASH_AT, TOTAL, GROUPS } from "../src/engine/story.js";

export function soundTimeline(spec: VideoSpec, words: Word[]) {
  loadSpec(spec, words);
  const crowdOf = (gids: string[] | null) => GROUPS.filter((g) => !gids || gids.includes(g.g.id)).reduce((s, g) => s + g.homes.length, 0);
  return {
    duration: TOTAL / FPS,
    seed: [...spec.title].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7),
    river: spec.decor.river,
    flash: FLASH_AT >= 0 ? FLASH_AT / FPS : null,
    words: words.map((w) => ({ start: w.start, end: w.end })),
    shots: SHOTS.map((s) => ({
      start: s.a / FPS, end: s.b / FPS, light: s.light, xfade: s.xfade, show: s.show, crowd: crowdOf(s.groups),
      cuts: s.keys.slice(1).filter((k) => k.cut).map((k) => k.f / FPS),
    })),
    cues: (spec.sound ?? []).map((c) => ({ t: TL.t(c.at), kind: c.kind, dur: c.dur, level: c.level, pan: c.pan })),
    fx: spec.shots.flatMap((s) => (s.fx ?? []).map((e) => ({ t: TL.t(e.from), kind: e.kind }))),
    music: {
      mood: spec.music?.mood ?? "regatta_march",
      level: spec.music?.level,
      stops: (spec.music?.stops ?? []).map((c) => TL.t(c)),
      buttons: (spec.music?.buttons ?? []).map((c) => TL.t(c)),
    },
  };
}
