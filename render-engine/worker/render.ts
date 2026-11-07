// Renders a VideoSpec to MP4 with Remotion (three.js in headless Chrome), then muxes the soundtrack.
// GPU machines: REMOTION_GL=angle-egl (default here) uses the GPU through ANGLE/EGL; without a GPU use swangle
// (software, ~10 s a frame). CHROME_BIN overrides the browser Remotion downloads.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { VideoSpec, Word } from "../src/spec.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let serveUrl: string | null = null;

export async function renderVideo(spec: VideoSpec, words: Word[], mixWav: string, outDir: string, onProgress: (p: number) => void) {
  fs.mkdirSync(outDir, { recursive: true });
  serveUrl ??= await bundle({ entryPoint: path.join(root, "src/index.ts"), publicDir: path.join(root, "public") });
  const inputProps = { spec, words };
  const gl = (process.env.REMOTION_GL ?? "angle-egl") as "angle-egl" | "swangle" | "angle" | "vulkan" | "egl" | "swiftshader";
  const chromiumOptions = { gl };
  const browserExecutable = process.env.CHROME_BIN || null;
  const composition = await selectComposition({ serveUrl, id: "AnimatedShort", inputProps, chromiumOptions, browserExecutable });
  const silent = path.join(outDir, "video_silent.mp4");
  await renderMedia({
    serveUrl, composition, inputProps, chromiumOptions, browserExecutable,
    codec: "h264", crf: 18, outputLocation: silent, muted: true,
    concurrency: Number(process.env.RENDER_CONCURRENCY ?? 4),
    timeoutInMilliseconds: 600_000,
    onProgress: ({ progress }) => onProgress(progress),
  });
  const final = path.join(outDir, "video.mp4");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", silent, "-i", mixWav, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-af", "volume=-0.5dB", "-shortest", "-movflags", "+faststart", final]);
  return final;
}
