// Local integration test of the worker chain with Claude and ElevenLabs mocked (no paid call).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { writeSpec } from "./specWriter.js";
import { recordVoice } from "./voice.js";
import { soundTimeline } from "./timeline.js";
import { renderVideo } from "./render.js";
import type { VideoSpec } from "../src/spec.js";
const [mp3, wordsP, out] = process.argv.slice(2) as [string, string, string];
fs.mkdirSync(out, { recursive: true });
// 1. Claude (mock: the shipped example)
const example = JSON.parse(fs.readFileSync("examples/hammersmith.en.json", "utf8"));
const fake = { beta: { messages: { stream: () => ({ finalMessage: async () => ({ stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: "text", text: JSON.stringify(example) }] }) }) } } };
const { spec, problems } = await writeSpec("brief", "en", fake as any);
console.log("1 spec ok, problems:", problems.length);
// 2. ElevenLabs (mock: a real narration mp3 + a character alignment built from its word timings, read with a pause added)
const words = JSON.parse(fs.readFileSync(wordsP, "utf8")) as { word: string; start: number; end: number }[];
const chars: string[] = [], st: number[] = [], en: number[] = [];
words.forEach((w, i) => { const d = (w.end - w.start) / w.word.length; [...w.word].forEach((c, k) => { chars.push(c); st.push(w.start - 0.25 + k * d); en.push(w.start - 0.25 + (k + 1) * d); }); if (i < words.length - 1) { chars.push(" "); st.push(w.end - 0.25); en.push(words[i + 1]!.start - 0.25); } });
globalThis.fetch = (async () => new Response(JSON.stringify({ audio_base64: fs.readFileSync(mp3).toString("base64"),
  alignment: { characters: chars, character_start_times_seconds: st, character_end_times_seconds: en } }), { status: 200 })) as typeof fetch;
process.env.ELEVENLABS_API_KEY = "test";
const voice = await recordVoice(spec.script, "voice-id", "en", path.join(out, "voice"), 52); // 52 s cap forces the fit-to-length path
console.log("2 voice ok:", voice.seconds.toFixed(2), "s,", voice.words.length, "words, last word ends", voice.words.at(-1)!.end, "s");
// 3. soundtrack
const tl = soundTimeline(spec as unknown as VideoSpec, voice.words);
fs.writeFileSync(path.join(out, "timeline.json"), JSON.stringify(tl));
execFileSync(process.env.PYTHON ?? "python3", ["spec_audio.py", path.resolve(out, "timeline.json"), path.resolve(voice.wav), path.resolve(out)], { stdio: "inherit", cwd: "audio" });
console.log("3 soundtrack ok");
// 4. picture (a slice) + mux
const video = await renderVideo(spec as unknown as VideoSpec, voice.words, path.join(out, "mix.wav"), path.join(out, "render"), () => undefined);
console.log("4 video ok:", video);
