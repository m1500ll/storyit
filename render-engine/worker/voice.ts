// Narration with ElevenLabs (text-to-speech with character timestamps) -> voice.wav (48 kHz mono, 0.25 s lead-in)
// + word timings on the script lines. If the read runs long, long pauses are shortened and then the voice is sped up
// a little (at most x1.15), and the word timings follow both edits. Key: ELEVENLABS_API_KEY (worker secret).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { assignLines, tokens } from "../src/resolve.js";
import type { Word } from "../src/spec.js";

const SR = 48000, LEAD = 0.25;
const run = (cmd: string, args: string[]) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 30 });

type Timed = { word: string; start: number; end: number };

async function elevenlabs(text: string, voiceId: string, language: string) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is not set");
  const model = process.env.ELEVENLABS_MODEL ?? "eleven_multilingual_v2";
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=${process.env.ELEVENLABS_FORMAT ?? "mp3_44100_128"}`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: model, language_code: language,
      voice_settings: { stability: 0.3, similarity_boost: 0.75, style: 0.6, use_speaker_boost: true } }),
    signal: AbortSignal.timeout(300_000),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as { audio_base64: string; alignment: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] } };
}

/** runs of letters/digits (accents, apostrophes, hyphens inside) timed from their first and last character */
const wordsFromAlignment = (a: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] }): Timed[] => {
  const out: Timed[] = [];
  let cur: Timed | null = null;
  a.characters.forEach((c, i) => {
    if (/[\p{L}\p{N}'’-]/u.test(c)) cur = cur ? { ...cur, word: cur.word + c, end: a.character_end_times_seconds[i]! } : { word: c, start: a.character_start_times_seconds[i]!, end: a.character_end_times_seconds[i]! };
    else if (cur) { if (/[\p{L}\p{N}]/u.test(cur.word)) out.push(cur); cur = null; }
  });
  if (cur && /[\p{L}\p{N}]/u.test((cur as Timed).word)) out.push(cur);
  return out;
};

const readF32 = (file: string) => {
  const buf = run("ffmpeg", ["-v", "error", "-i", file, "-ac", "1", "-ar", String(SR), "-f", "f32le", "-"]);
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
};
const writeWav = (file: string, x: Float32Array) => {
  const raw = file + ".f32";
  fs.writeFileSync(raw, Buffer.from(x.buffer, x.byteOffset, x.byteLength));
  run("ffmpeg", ["-v", "error", "-y", "-f", "f32le", "-ar", String(SR), "-ac", "1", "-i", raw, "-c:a", "pcm_s24le", file]);
  fs.rmSync(raw);
};

/** shorten every pause longer than 0.28 s to 0.24 s; returns the new signal and a time map old -> new */
const tightenPauses = (x: Float32Array) => {
  const hop = SR / 100, n = Math.floor(x.length / hop), quiet: boolean[] = [];
  for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < hop; k++) s += x[i * hop + k]! ** 2; quiet.push(10 * Math.log10(s / hop + 1e-12) < -42); }
  const cuts: [number, number][] = []; // [startSample, endSample) removed
  for (let i = 0; i < n;) {
    if (!quiet[i]) { i++; continue; }
    let j = i; while (j < n && quiet[j]) j++;
    if (j - i > 28) cuts.push([(i + 12) * hop, (j - 12) * hop]);
    i = j;
  }
  const kept = x.length - cuts.reduce((s, [a, b]) => s + (b - a), 0), y = new Float32Array(kept);
  let o = 0, p = 0;
  for (const [a, b] of cuts) { y.set(x.subarray(p, a), o); o += a - p; p = b; }
  y.set(x.subarray(p), o);
  const map = (t: number) => { const s = t * SR; let removed = 0; for (const [a, b] of cuts) { if (s >= b) removed += b - a; else if (s > a) removed += s - a; } return (s - removed) / SR; };
  return { y, map };
};

export async function recordVoice(script: string[], voiceId: string, language: string, outDir: string, maxSeconds = 57.5): Promise<{ wav: string; words: Word[]; seconds: number; chars: number }> {
  fs.mkdirSync(outDir, { recursive: true });
  const text = script.join(" ");
  const r = await elevenlabs(text, voiceId, language);
  const mp3 = path.join(outDir, "voice_el.mp3");
  fs.writeFileSync(mp3, Buffer.from(r.audio_base64, "base64"));
  let timed = wordsFromAlignment(r.alignment);
  let x = readF32(mp3);
  let seconds = x.length / SR;
  if (seconds > maxSeconds) {
    const t = tightenPauses(x);
    x = t.y; timed = timed.map((w) => ({ ...w, start: t.map(w.start), end: t.map(w.end) }));
    seconds = x.length / SR;
  }
  let tempo = 1;
  if (seconds > maxSeconds) {
    tempo = Math.min(1.15, seconds / maxSeconds);
    const tmp = path.join(outDir, "voice_tight.wav");
    writeWav(tmp, x);
    const sped = path.join(outDir, "voice_tempo.wav");
    run("ffmpeg", ["-v", "error", "-y", "-i", tmp, "-af", `atempo=${tempo.toFixed(4)}`, sped]);
    x = readF32(sped);
    timed = timed.map((w) => ({ ...w, start: w.start / tempo, end: w.end / tempo }));
  }
  const lead = new Float32Array(Math.round(LEAD * SR) + x.length);
  lead.set(x, Math.round(LEAD * SR));
  const wav = path.join(outDir, "voice.wav");
  writeWav(wav, lead);
  timed = timed.map((w) => ({ ...w, start: +(w.start + LEAD).toFixed(3), end: +(w.end + LEAD).toFixed(3) }));
  const expected = script.reduce((s, l) => s + tokens(l).length, 0);
  if (timed.length !== expected) console.warn(`voice: ${timed.length} timed words for ${expected} script words (lines re-assigned in order)`);
  const words = assignLines(script, timed);
  fs.writeFileSync(path.join(outDir, "words.json"), JSON.stringify(words));
  return { wav, words, seconds: lead.length / SR, chars: text.length };
}
