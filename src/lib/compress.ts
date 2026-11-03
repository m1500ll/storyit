import { loadFFmpeg } from './assemble';

/** Bitrate plan to fit a video under `targetBytes` (pure, tested). */
export function compressionPlan(durationSeconds: number, targetBytes: number, height: number | null) {
  const audioKbps = 128;
  // 7% margin for the MP4 container and rate-control overshoot.
  const totalKbps = Math.floor(((targetBytes * 0.93) * 8) / 1000 / Math.max(durationSeconds, 1));
  const videoKbps = Math.min(8000, totalKbps - audioKbps);
  if (videoKbps < 300) return null; // too long for this size: quality would be unusable
  // Below ~3.5 Mbit/s, 720p looks better than a starved 1080p (and encodes ~2x faster).
  const outHeight = Math.min(height ?? 1920, videoKbps < 3500 ? 1280 : 1920);
  return { videoKbps, audioKbps, outHeight };
}

export type CompressProgress = { step: 'loading' | 'encoding'; ratio: number };

/**
 * Re-encodes a video in the browser (ffmpeg.wasm, H.264 + AAC, MP4) so it fits under `targetBytes`.
 * Nothing leaves the device until the result is uploaded.
 */
export async function compressVideo(file: File, durationSeconds: number, height: number | null, targetBytes: number,
  onProgress: (p: CompressProgress) => void): Promise<File> {
  const plan = compressionPlan(durationSeconds, targetBytes, height);
  if (!plan) throw new Error('This video is too long to fit the size limit with acceptable quality. Shorten it first.');
  onProgress({ step: 'loading', ratio: 0 });
  const ff = await loadFFmpeg();
  const onProg = ({ progress }: { progress: number }) => onProgress({ step: 'encoding', ratio: Math.max(0, Math.min(1, progress)) });
  ff.on('progress', onProg);
  const input = 'in' + (file.name.match(/\.[a-z0-9]+$/i)?.[0] ?? '.mp4');
  try {
    await ff.writeFile(input, new Uint8Array(await file.arrayBuffer()));
    const k = plan.videoKbps;
    const code = await ff.exec([
      '-i', input,
      '-vf', `scale=-2:'min(${plan.outHeight},ih)'`,
      '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', `${k}k`, '-maxrate', `${Math.round(k * 1.2)}k`, '-bufsize', `${k * 2}k`,
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', `${plan.audioKbps}k`, '-movflags', '+faststart', 'out.mp4',
    ]);
    if (code !== 0) throw new Error('Compression failed for this file');
    const data = (await ff.readFile('out.mp4')) as Uint8Array;
    if (data.length > targetBytes) throw new Error(`Still ${Math.round(data.length / 1048576)} MB after compression: shorten the video`);
    return new File([new Uint8Array(data)], file.name.replace(/\.[^.]+$/, '') + '.mp4', { type: 'video/mp4' });
  } finally {
    ff.off('progress', onProg);
    await ff.deleteFile(input).catch(() => {});
    await ff.deleteFile('out.mp4').catch(() => {});
  }
}
