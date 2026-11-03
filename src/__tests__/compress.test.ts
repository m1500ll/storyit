import { describe, expect, it } from 'vitest';
import { compressionPlan } from '@/lib/compress';

const MB = 1024 * 1024;
describe('compression plan (fit a video under the storage limit)', () => {
  it('96 s, 219 MB 1080p → under 50 MB at ~3.7 Mbit/s, keeps 1080p', () => {
    const p = compressionPlan(96, 49.5 * MB, 1920)!;
    expect(p.videoKbps).toBeGreaterThan(3500);
    expect(((p.videoKbps + p.audioKbps) * 1000 * 96) / 8).toBeLessThan(49.5 * MB);
    expect(p.outHeight).toBe(1920);
  });
  it('longer videos drop to 720p before quality collapses', () => {
    expect(compressionPlan(150, 49.5 * MB, 1920)!.outHeight).toBe(1280);
  });
  it('never upscales and caps the bitrate for short clips', () => {
    const p = compressionPlan(10, 49.5 * MB, 720)!;
    expect(p.outHeight).toBe(720);
    expect(p.videoKbps).toBe(8000);
  });
  it('refuses when the result would be unwatchable', () => expect(compressionPlan(20 * 60, 49.5 * MB, 1920)).toBeNull());
});
