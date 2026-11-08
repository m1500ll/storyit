// Renders a VideoSpec to MP4 with Remotion (three.js in headless Chrome), then muxes the soundtrack.
// One Chrome shares one GPU process (capped at 4 GB by Remotion's --force-gpu-mem-available-mb=4096): with many tabs
// the heavy three.js scenes (4096 shadow maps, full-HD post passes) exhaust it and "Error creating WebGL context".
// So the frames are split into RENDER_CHUNKS slices rendered in parallel by separate browsers (RENDER_CONCURRENCY tabs
// each), then joined without re-encoding.
// Without a GPU use REMOTION_GL=swangle (software); with one, angle-egl. CHROME_BIN overrides Remotion's browser.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { VideoSpec, Word } from "../src/spec.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let serveUrl: string | null = null;

export async function renderVideo(spec: VideoSpec, words: Word[], mixWav: string, outDirIn: string, onProgress: (p: number) => void) {
  const outDir = path.resolve(outDirIn);
  fs.mkdirSync(outDir, { recursive: true });
  serveUrl ??= await bundle({ entryPoint: path.join(root, "src/index.ts"), publicDir: path.join(root, "public") });
  const inputProps = { spec, words };
  const gl = (process.env.REMOTION_GL ?? "angle-egl") as "angle-egl" | "swangle" | "angle" | "vulkan" | "egl" | "swiftshader";
  const chromiumOptions = { gl };
  const browserExecutable = process.env.CHROME_BIN || null;
  const composition = await selectComposition({ serveUrl, id: "AnimatedShort", inputProps, chromiumOptions, browserExecutable });
  // tests only: RENDER_FRAMES="0-29" renders a slice instead of the whole short
  const [first, last] = process.env.RENDER_FRAMES ? (process.env.RENDER_FRAMES.split("-").map(Number) as [number, number]) : [0, composition.durationInFrames - 1];
  const chunks = Math.max(1, Math.min(Number(process.env.RENDER_CHUNKS ?? 4), Math.ceil((last - first + 1) / 30)));
  const size = Math.ceil((last - first + 1) / chunks);
  const parts = Array.from({ length: chunks }, (_, k) => [first + k * size, Math.min(last, first + (k + 1) * size - 1)] as [number, number]).filter(([a, b]) => a <= b);
  const progress = parts.map(() => 0);
  const files = await Promise.all(parts.map(async (range, k) => {
    const file = path.join(outDir, `part_${String(k).padStart(2, "0")}.mp4`);
    await renderMedia({
      serveUrl: serveUrl!, composition, inputProps, chromiumOptions, browserExecutable,
      codec: "h264", crf: 18, outputLocation: file, muted: true, frameRange: range,
      concurrency: Number(process.env.RENDER_CONCURRENCY ?? 4),
      timeoutInMilliseconds: 600_000,
      onProgress: ({ progress: p }) => { progress[k] = p; onProgress(progress.reduce((s, x) => s + x, 0) / parts.length); },
    });
    return file;
  }));
  const list = path.join(outDir, "parts.txt");
  fs.writeFileSync(list, files.map((f) => `file '${f}'`).join("\n"));
  const silent = path.join(outDir, "video_silent.mp4");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", silent]);
  const final = path.join(outDir, "video.mp4");
  // re-encoded with a capped bitrate: the crf 18 parts weigh ~100 MB per minute, over Supabase Storage's 50 MB per-file limit
  const mux = (video: string[]) => execFileSync("ffmpeg", ["-v", "error", "-y", "-i", silent, "-i", path.resolve(mixWav), "-map", "0:v:0", "-map", "1:a:0",
    "-c:v", "libx264", "-preset", "medium", ...video, "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-af", "volume=-0.5dB", "-shortest", "-movflags", "+faststart", final]);
  mux(["-crf", "20", "-maxrate", "4500k", "-bufsize", "6M"]);
  const LIMIT = 48e6;
  if (fs.statSync(final).size > LIMIT) { // safety net: a fixed average bitrate that fits
    const secs = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", final]).toString());
    const kbps = Math.floor((LIMIT * 8 * 0.95) / secs / 1000) - 200;
    mux(["-b:v", `${kbps}k`, "-maxrate", `${kbps}k`, "-bufsize", `${kbps * 2}k`]);
  }
  return final;
}
