// The render worker: claims the oldest queued animated short and produces it end to end.
//   writing   Claude writes the VideoSpec from the brief transcript (specWriter.ts)
//   voicing   ElevenLabs reads the script, word timings, auto-fit to ~57.5 s (voice.ts)
//   rendering soundtrack (audio/spec_audio.py) + 3D render (render.ts) + mux
//   done      MP4 uploaded to the private `renders` bucket at <user_id>/animated/<project_id>.mp4
// Any failure: status failed, a short customer-facing error, the credits refunded.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, ELEVENLABS_API_KEY, ELEVENLABS_DEFAULT_VOICE.
// Usage: npx tsx worker/pipeline.ts [--once]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { writeSpec, usd } from "./specWriter.js";
import { recordVoice } from "./voice.js";
import { soundTimeline } from "./timeline.js";
import { renderVideo } from "./render.js";
import type { VideoSpec } from "../src/spec.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const WORKER = `${os.hostname()}-${process.pid}`;

type Job = { id: string; user_id: string; transcript: { role: string; text: string }[]; language: string; voice_id: string | null; credits_charged: number };

const set = (id: string, patch: Record<string, unknown>) => db.from("animated_projects").update(patch).eq("id", id);
const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

/** short, customer-facing reason (the technical one goes to the logs) */
const reasonOf = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  if (/refusal/i.test(m)) return "Cette histoire ne peut pas être traitée. Essayez une autre idée.";
  if (/ElevenLabs/i.test(m)) return "La voix n'a pas pu être enregistrée.";
  return "La vidéo n'a pas pu être produite.";
};

export async function produce(job: Job) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `short-${job.id.slice(0, 8)}-`));
  const t0 = Date.now();
  try {
    // 1. VideoSpec
    const brief = job.transcript.map((m) => `${m.role === "user" ? "CUSTOMER" : "PRODUCER"}: ${m.text}`).join("\n\n");
    const { spec, usage, problems } = await writeSpec(brief, job.language, new Anthropic({ maxRetries: 3 }));
    if (problems.length) log(job.id, "spec kept with problems:", problems);
    log(job.id, `spec ok: ${spec.shots.length} shots, $${usd(usage).toFixed(2)}`);
    await set(job.id, { spec, title: spec.title, status: "voicing", progress: 15 });
    // 2. voice
    const voiceId = job.voice_id ?? process.env.ELEVENLABS_DEFAULT_VOICE;
    if (!voiceId) throw new Error("ElevenLabs: no voice id");
    const voice = await recordVoice(spec.script, voiceId, job.language, path.join(dir, "voice"));
    log(job.id, `voice ok: ${voice.seconds.toFixed(1)} s, ${voice.chars} chars`);
    await set(job.id, { words: voice.words, status: "rendering", progress: 25 });
    // 3. soundtrack
    const tl = soundTimeline(spec as VideoSpec, voice.words);
    fs.writeFileSync(path.join(dir, "timeline.json"), JSON.stringify(tl));
    execFileSync(process.env.PYTHON ?? "python3", [path.join(root, "audio/spec_audio.py"), path.join(dir, "timeline.json"), voice.wav, dir],
      { stdio: "inherit", cwd: path.join(root, "audio") });
    await set(job.id, { progress: 30 });
    // 4. picture
    let lastPct = 30;
    const video = await renderVideo(spec as VideoSpec, voice.words, path.join(dir, "mix.wav"), path.join(dir, "render"), (p) => {
      const pct = Math.floor(30 + p * 65);
      if (pct >= lastPct + 5) { lastPct = pct; void set(job.id, { progress: pct }); }
    });
    // 5. upload
    const key = `${job.user_id}/animated/${job.id}.mp4`;
    const { error } = await db.storage.from("renders").upload(key, fs.readFileSync(video), { contentType: "video/mp4", upsert: true });
    if (error) throw new Error("upload: " + error.message);
    await set(job.id, { status: "done", progress: 100, video_path: key, finished_at: new Date().toISOString() });
    log(job.id, `done in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  } catch (e) {
    log(job.id, "FAILED", e);
    await set(job.id, { status: "failed", error: reasonOf(e), finished_at: new Date().toISOString() });
    if (job.credits_charged > 0) {
      const { error } = await db.rpc("grant_credits", { p_user_id: job.user_id, p_amount: job.credits_charged, p_type: "refund",
        p_description: "Animated Studio — remboursement (vidéo non produite)" });
      if (error) log(job.id, "REFUND FAILED", error.message);
      else await set(job.id, { credits_charged: 0 });
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** claims and produces jobs until the queue is empty */
export async function drain() {
  for (;;) {
    const { data, error } = await db.rpc("claim_animated_job", { p_worker: WORKER });
    if (error) throw new Error("claim: " + error.message);
    const job = data as Job | null;
    if (!job || !job.id) return;
    log("claimed", job.id);
    await produce(job);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  drain().then(() => log("queue empty"), (e) => { console.error(e); process.exit(1); });
}
