import type { FFmpeg } from '@ffmpeg/ffmpeg';

export interface AssemblyScene {
  clipUrl: string;
  audioUrl: string | null;
  caption: string;
  /** Minimum on-screen time; extended to fit the voice-over. */
  duration: number;
}

export type AssemblyProgress = { step: 'loading' | 'scene' | 'joining'; current: number; total: number };

const W = 720;
const H = 1280;
let instance: Promise<FFmpeg> | null = null;

/** Lazy-loads ffmpeg.wasm (self-hosted, ~30 MB, fetched only when someone exports). */
function loadFFmpeg(): Promise<FFmpeg> {
  instance ??= (async () => {
    const [{ FFmpeg }, core, wasm] = await Promise.all([
      import('@ffmpeg/ffmpeg'),
      import('@ffmpeg/core?url'),
      import('@ffmpeg/core/wasm?url'),
    ]);
    const ff = new FFmpeg();
    await ff.load({ coreURL: core.default, wasmURL: wasm.default });
    return ff;
  })().catch((e) => { instance = null; throw e; });
  return instance;
}

async function fetchBytes(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download ${url.split('?')[0]} (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Duration of a PCM WAV from its header (what our TTS step produces). */
function wavSeconds(bytes: Uint8Array): number {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const byteRate = v.getUint32(28, true);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    const size = v.getUint32(offset + 4, true);
    if (id === 'data') return byteRate ? size / byteRate : 0;
    offset += 8 + size + (size % 2);
  }
  return 0;
}

/** Wraps caption text into at most 3 short lines (TikTok-style, centred). */
export function wrapCaption(text: string, max = 22, lines = 3): string {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const out: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > max && line) { out.push(line); line = w; } else line = (line + ' ' + w).trim();
  }
  if (line) out.push(line);
  if (out.length > lines) { out.length = lines; out[lines - 1] = out[lines - 1]!.replace(/\W*$/, '') + '…'; }
  return out.join('\n');
}

/**
 * Builds the final 9:16 episode: each clip is looped/trimmed to its scene length, voice-over is laid
 * on top, captions are burned in, then all scenes are concatenated. Runs entirely in the browser.
 */
export async function assembleEpisode(scenes: AssemblyScene[], onProgress: (p: AssemblyProgress) => void): Promise<Blob> {
  onProgress({ step: 'loading', current: 0, total: scenes.length });
  const ff = await loadFFmpeg();
  await ff.writeFile('caption.otf', await fetchBytes('/fonts/caption.otf'));

  const list: string[] = [];
  for (const [i, s] of scenes.entries()) {
    onProgress({ step: 'scene', current: i + 1, total: scenes.length });
    const clip = `clip${i}.mp4`;
    const seg = `seg${i}.mp4`;
    await ff.writeFile(clip, await fetchBytes(s.clipUrl));
    await ff.writeFile(`cap${i}.txt`, wrapCaption(s.caption));

    let duration = s.duration;
    const audioArgs: string[] = [];
    if (s.audioUrl) {
      const voice = await fetchBytes(s.audioUrl);
      duration = Math.max(duration, wavSeconds(voice) + 0.35);
      await ff.writeFile(`voice${i}.wav`, voice);
      audioArgs.push('-i', `voice${i}.wav`);
    } else {
      audioArgs.push('-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono');
    }

    const video = [
      `scale=${W}:${H}:force_original_aspect_ratio=increase`, `crop=${W}:${H}`, 'fps=30', 'setsar=1',
      `drawtext=fontfile=caption.otf:textfile=cap${i}.txt:fontcolor=white:fontsize=46:borderw=5:bordercolor=black@0.85:line_spacing=10:x=(w-text_w)/2:y=h*0.70`,
    ].join(',');
    const code = await ff.exec([
      '-stream_loop', '-1', '-i', clip, ...audioArgs,
      '-t', duration.toFixed(2),
      '-filter_complex', `[0:v]${video}[v];[1:a]aresample=44100,apad[a]`,
      '-map', '[v]', '-map', '[a]',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '24', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-ac', '1', '-shortest', seg,
    ]);
    if (code !== 0) throw new Error(`Could not process scene ${i + 1}`);
    list.push(`file '${seg}'`);
    await ff.deleteFile(clip).catch(() => {});
  }

  onProgress({ step: 'joining', current: scenes.length, total: scenes.length });
  await ff.writeFile('list.txt', list.join('\n'));
  const code = await ff.exec(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', '-movflags', '+faststart', 'episode.mp4']);
  if (code !== 0) throw new Error('Could not join the scenes');
  const data = await ff.readFile('episode.mp4');
  for (const [i] of scenes.entries()) {
    await ff.deleteFile(`seg${i}.mp4`).catch(() => {});
    await ff.deleteFile(`voice${i}.wav`).catch(() => {});
  }
  return new Blob([new Uint8Array(data as Uint8Array)], { type: "video/mp4" });
}
