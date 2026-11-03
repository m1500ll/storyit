/**
 * TikTok-style animated captions: one word at a time, shown when it is spoken, with a "pop" animation.
 * Timing comes from the clip's own audio (ffmpeg silencedetect): words are spread over the speech span,
 * proportionally to their length. Output is an ASS subtitle file burned in by libass.
 */

export interface WordTiming { word: string; start: number; end: number }

/** Parses ffmpeg `silencedetect` log lines into the span where someone is talking. */
export function speechSpan(log: string, clipSeconds: number): { start: number; end: number } {
  const starts = [...log.matchAll(/silence_start:\s*([\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...log.matchAll(/silence_end:\s*([\d.]+)/g)].map((m) => Number(m[1]));
  let start = 0;
  let end = clipSeconds;
  // Leading silence: a silence that starts at ~0 and ends before the speech.
  if (starts.length && starts[0]! < 0.15 && ends.length) start = ends[0]!;
  // Trailing silence: the last silence_start with no matching end (or ending at the clip end).
  const lastStart = starts[starts.length - 1];
  if (lastStart !== undefined && lastStart > start + 0.3 && (ends.length < starts.length || ends[ends.length - 1]! >= clipSeconds - 0.1)) end = lastStart;
  if (end - start < 0.6) return { start: Math.min(0.2, clipSeconds / 4), end: clipSeconds * 0.92 };
  return { start, end };
}

/** Spreads words over [start, end], weighting by length (punctuation adds a small pause). */
export function timeWords(line: string, start: number, end: number): WordTiming[] {
  const words = line.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (!words.length) return [];
  const weight = (w: string) => Math.max(w.replace(/[^\p{L}\p{N}]/gu, '').length, 2) + (/[.!?…,]$/.test(w) ? 3 : 0);
  const total = words.reduce((n, w) => n + weight(w), 0);
  const span = Math.max(end - start, 0.4 * words.length);
  let t = start;
  return words.map((word) => {
    const d = (weight(word) / total) * span;
    const timing = { word, start: t, end: t + d };
    t += d;
    return timing;
  });
}

const assTime = (s: number) => {
  const cs = Math.max(0, Math.round(s * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const sec = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
};
const escapeAss = (s: string) => s.replace(/[{}\\]/g, '');

/** Builds the ASS file: big bold word, centred low-middle, pops in; shouted/emotional words turn yellow. */
export function buildAss(words: WordTiming[], width = 720, height = 1280, font = 'Inter Display'): string {
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Word,${font},92,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,7,3,5,40,40,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const y = Math.round(height * 0.7);
  const lines = words.map(({ word, start, end }, i) => {
    // Keep each word on screen until the next one appears (no flicker between words).
    const until = words[i + 1] ? words[i + 1]!.start : end + 0.25;
    const hot = /[!?]/.test(word) || (word.length > 2 && word === word.toUpperCase() && /\p{L}/u.test(word));
    const colour = hot ? '\\c&H0028E0FF&' : ''; // ASS is BGR: yellow
    const pop = `{\\pos(${width / 2},${y})${colour}\\fscx55\\fscy55\\t(0,90,\\fscx118\\fscy118)\\t(90,170,\\fscx100\\fscy100)}`;
    return `Dialogue: 0,${assTime(start)},${assTime(until)},Word,,0,0,0,,${pop}${escapeAss(word)}`;
  });
  return header + lines.join('\n') + '\n';
}
