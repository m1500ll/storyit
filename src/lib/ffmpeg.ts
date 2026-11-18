import type { FFFSType, FFmpeg } from '@ffmpeg/ffmpeg';
import type { Caption, CaptionAnimId, CaptionStyleId, ClipFraming, LayoutId, TitleStyleId } from '@/types/clips';
import { buildClipAss } from './clipAss';
import { layoutGraph, planLayout } from './clipLayout';
import { titlePngBytes } from './clipTitle';

/** ONE shared ffmpeg.wasm engine for the whole app (episode assembly, compression, AI clipping). */
let instance: Promise<FFmpeg> | null = null;

/** ffmpeg.wasm core from a CDN (~30 MB, above the 25 MB per-file limit of the site host), pinned to the installed
 *  @ffmpeg/core version and fetched only when it is first needed. Loaded as same-origin blob URLs for the worker. */
const CORE_BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
async function blobURL(url: string, type: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Impossible de télécharger les outils vidéo (${res.status}).`);
  return URL.createObjectURL(new Blob([await res.arrayBuffer()], { type }));
}

/** Lazy-loads ffmpeg.wasm (fetched only when someone exports). */
export function loadFFmpeg(): Promise<FFmpeg> {
  instance ??= (async () => {
    const [{ FFmpeg }, coreURL, wasmURL] = await Promise.all([
      import('@ffmpeg/ffmpeg'),
      blobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
      blobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
    ]);
    const ff = new FFmpeg();
    await ff.load({ coreURL, wasmURL });
    return ff;
  })().catch((e) => { instance = null; throw e; });
  return instance;
}

/** Warm the engine in the background (e.g. when the user picks a file). */
export const preloadFFmpeg = () => { loadFFmpeg().catch(() => {}); };

let queue: Promise<unknown> = Promise.resolve();
/** ffmpeg.wasm runs one command at a time: every job in the app goes through this queue. */
export function exclusive<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job, job);
  queue = next.catch(() => {});
  return next;
}

let fontReady: Promise<void> | null = null;
/** The caption fonts (Inter Display ExtraBold, Anton) in /fonts inside the engine, written once. */
function ensureCaptionFont(ff: FFmpeg): Promise<void> {
  fontReady ??= (async () => {
    await ff.createDir('/fonts').catch(() => {});
    for (const f of ['caption.otf', 'caption-word.ttf']) {
      const res = await fetch(`/fonts/${f}`);
      if (!res.ok) throw new Error('Impossible de charger la police des sous-titres.');
      await ff.writeFile(`/fonts/${f}`, new Uint8Array(await res.arrayBuffer()));
    }
  })().catch((e) => { fontReady = null; throw e; });
  return fontReady;
}

/**
 * Mounts the source read-only (WORKERFS: no copy into memory, so multi-GB files work),
 * runs one ffmpeg command, and reports progress as 0..1 of `duration` seconds.
 */
function run(source: Blob, duration: number, args: (input: string) => string[], output: string, onProgress?: (p: number) => void, before?: (ff: FFmpeg) => Promise<void>) {
  return exclusive(async () => {
    const ff = await loadFFmpeg();
    await before?.(ff);
    const dir = `/in${Date.now()}`;
    await ff.createDir(dir);
    await ff.mount('WORKERFS' as FFFSType, { blobs: [{ name: 'source', data: source }] }, dir);
    // `time` is reliable with -t, `progress` is not
    const onTick = ({ time }: { time: number }) => onProgress?.(Math.min(1, Math.max(0, time / 1_000_000 / duration)));
    ff.on('progress', onTick);
    try {
      const code = await ff.exec(args(`${dir}/source`));
      if (code !== 0) throw new Error('La vidéo n’a pas pu être traitée. Essayez un autre fichier (MP4 ou MOV fonctionnent le mieux).');
      const data = await ff.readFile(output);
      await ff.deleteFile(output).catch(() => {});
      return data as Uint8Array<ArrayBuffer>;
    } finally {
      ff.off('progress', onTick);
      await ff.unmount(dir).catch(() => {});
      await ff.deleteDir(dir).catch(() => {});
    }
  });
}

/** Mono 16 kHz MP3 at 24 kbps (~11 MB per hour): small enough to send to the AI. Keep in sync with clips-analyze. */
export const AUDIO_BITRATE = 24_000;

export async function extractAudio(source: Blob, duration: number, onProgress?: (p: number) => void): Promise<Blob> {
  const data = await run(source, duration,
    // aresample first_pts=0: when the sound starts after the picture (OBS, phones), silence is added in front so the audio
    // keeps the video's timeline (without it every caption came out early by that gap, often ~0.4 s)
    (input) => ['-i', input, '-vn', '-ac', '1', '-ar', '16000', '-af', 'aresample=async=1:first_pts=0', '-c:a', 'libmp3lame', '-b:a', '24k', 'audio.mp3'],
    'audio.mp3', onProgress);
  return new Blob([data], { type: 'audio/mpeg' });
}

/** height of a PNG, read from its header */
const pngHeight = (png: Uint8Array) => new DataView(png.buffer, png.byteOffset).getUint32(20);

export interface RenderClipOptions {
  source: Blob;
  start: number;
  end: number;
  captions: Caption[];
  title: string | null;
  style: CaptionStyleId;
  layout: LayoutId;
  captionSize: number;
  captionPos: number;
  captionAnim: CaptionAnimId;
  titleStyle: TitleStyleId;
  framing: ClipFraming | null;
  divider: boolean;
  /** source video size in pixels */
  width: number;
  height: number;
  onProgress?: (p: number) => void;
}

/** Cuts [start, end], reframes to vertical 9:16, burns in captions and title. Returns an MP4. */
export async function renderClip(o: RenderClipOptions): Promise<Blob> {
  const duration = Math.max(1, o.end - o.start);
  const plan = planLayout(o.layout, o.framing, o.width, o.height, o.start);
  const title = o.title ? await titlePngBytes(o.title, o.titleStyle) : null;
  const base = `${layoutGraph(plan, o.divider)};[base]subtitles=subs.ass:fontsdir=/fonts`;
  // the title is the same PNG as in the preview, centred on the layout's title line for the whole clip
  const titleTop = title ? Math.max(0, Math.round(plan.titleY - pngHeight(title) / 2)) : 0;
  const graph = title ? `${base}[s];[s][1:v]overlay=0:${titleTop}:format=auto[v]` : `${base}[v]`;
  // input seeking (-ss before -i) resets timestamps: the ASS times are relative to the clip start
  const data = await run(o.source, duration, (input) => [
    '-ss', o.start.toFixed(2), '-i', input, ...(title ? ['-i', 'title.png'] : []),
    '-filter_complex', graph, '-map', '[v]', '-map', '0:a?',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p', '-r', '30',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-t', duration.toFixed(2), 'clip.mp4',
  ], 'clip.mp4', o.onProgress, async (ff) => {
    await ensureCaptionFont(ff);
    await ff.writeFile('subs.ass', buildClipAss({ captions: o.captions, start: o.start, end: o.end, style: o.style, size: o.captionSize, pos: o.captionPos, anim: o.captionAnim }));
    if (title) await ff.writeFile('title.png', title);
  });
  return new Blob([data], { type: 'video/mp4' });
}
