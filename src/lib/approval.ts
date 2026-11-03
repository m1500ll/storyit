import type { Scene } from '@/types/database';

/**
 * Deterministic fingerprint of the editable scene content.
 * Approval stores this hash; any later edit changes it and invalidates the approval.
 */
export function hashScenes(scenes: Pick<Scene, 'position' | 'narration' | 'dialogue' | 'image_prompt' | 'video_prompt'>[]): string {
  const payload = [...scenes]
    .sort((a, b) => a.position - b.position)
    .map((s) => [s.position, s.narration, s.dialogue ?? '', s.image_prompt, s.video_prompt].join('␟'))
    .join('␞');
  let h = 0x811c9dc5; // FNV-1a 32-bit
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
