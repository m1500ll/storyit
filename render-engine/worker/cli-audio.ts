// usage: npx tsx worker/cli-audio.ts <spec.json> <words.json> <voice.wav> <outDir>  — soundtrack only (for tests)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { soundTimeline } from "./timeline.js";
const [specP, wordsP, voice, out] = process.argv.slice(2);
fs.mkdirSync(out!, { recursive: true });
const tl = soundTimeline(JSON.parse(fs.readFileSync(specP!, "utf8")), JSON.parse(fs.readFileSync(wordsP!, "utf8")));
fs.writeFileSync(path.join(out!, "timeline.json"), JSON.stringify(tl, null, 1));
execFileSync(process.env.PYTHON ?? "python3", ["audio/spec_audio.py", path.join(out!, "timeline.json"), voice!, out!], { stdio: "inherit" });
