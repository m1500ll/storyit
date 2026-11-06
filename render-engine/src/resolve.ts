// Turns a VideoSpec + the voice's word timings into absolute times (seconds / frames) the engine can play.
import type { Cue, VideoSpec, Word } from "./spec";

export const FPS = 30;

/** the word tokenizer shared with the voice tools (letters incl. accents, apostrophes, hyphens) */
export const tokens = (line: string) => line.match(/[\p{L}\p{N}'’-]+/gu)?.filter((t) => /[\p{L}\p{N}]/u.test(t)) ?? [];

/** give every timed word its script line + index (voice tools return one flat list for the whole text) */
export const assignLines = (script: string[], words: { word: string; start: number; end: number }[]): Word[] => {
  const out: Word[] = [];
  let k = 0;
  script.forEach((line, li) => {
    for (const _t of tokens(line)) {
      const w = words[k++];
      if (!w) return;
      out.push({ word: w.word, start: w.start, end: w.end, line: li });
    }
  });
  return out;
};

export type Timeline = {
  spec: VideoSpec;
  words: Word[];
  /** [line][word] -> start seconds */
  starts: number[][];
  ends: number[][];
  frames: number;
  t: (c: Cue | undefined, fallback?: number) => number;
  f: (c: Cue | undefined, fallback?: number) => number;
};

export const timeline = (spec: VideoSpec, words: Word[]): Timeline => {
  const starts: number[][] = spec.script.map(() => []), ends: number[][] = spec.script.map(() => []);
  for (const w of words) { starts[w.line]!.push(w.start); ends[w.line]!.push(w.end); }
  const last = words.length ? words[words.length - 1]!.end : 0;
  const duration = spec.duration ?? Math.ceil((last + 2.5) * FPS) / FPS;
  const t = (c: Cue | undefined, fallback = 0): number => {
    if (!c) return fallback;
    if ("at" in c) return c.at;
    const row = starts[c.line];
    if (!row || !row.length) return fallback;
    const s = row[Math.max(0, Math.min(row.length - 1, c.word))]!;
    return s + (c.offset ?? 0);
  };
  return { spec, words, starts, ends, frames: Math.round(duration * FPS), t, f: (c, fb = 0) => Math.round(t(c, fb / FPS) * FPS) };
};
