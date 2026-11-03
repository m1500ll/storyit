import type { StoryWithScenes } from '@/types/domain';

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
const srtTime = (s: number) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(Math.floor(s % 60))},${pad(Math.round((s % 1) * 1000), 3)}`;

/** Subtitles: one cue per scene, dialogue if any, otherwise narration. Ready for CapCut / TikTok captions. */
export function toSrt(story: StoryWithScenes): string {
  let t = 0;
  return story.scenes.map((s, i) => {
    const start = t;
    t += s.duration_seconds;
    return `${i + 1}\n${srtTime(start)} --> ${srtTime(t)}\n${s.dialogue ?? s.narration}\n`;
  }).join('\n');
}

/** Prompt sheet for pasting into external image/video generators. */
export function toPromptSheet(story: StoryWithScenes): string {
  const cast = story.characters.map((c) => `- ${c.name} (${c.species}): ${c.visual_description}`).join('\n');
  const scenes = story.scenes.map((s) => `## Scene ${s.position} — ${s.title} (${s.duration_seconds}s)\nIMAGE: ${s.image_prompt}\nVIDEO: ${s.video_prompt}${s.dialogue ? `\nLINE: ${s.dialogue}` : ''}`).join('\n\n');
  return `# ${story.title}\n${story.logline ?? ''}\n\n# Characters\n${cast}\n\n${scenes}\n`;
}

export function toJson(story: StoryWithScenes): string {
  const { title, logline, genre, aspect_ratio, episode_number, approved_at, approved_hash, characters, scenes } = story;
  return JSON.stringify({
    title, logline, genre, aspect_ratio, episode_number, approved_at, approved_hash,
    characters: characters.map(({ name, species, personality, visual_description, voice_style }) => ({ name, species, personality, visual_description, voice_style })),
    scenes: scenes.map(({ position, title: t, narration, dialogue, image_prompt, video_prompt, duration_seconds }) => ({ position, title: t, narration, dialogue, image_prompt, video_prompt, duration_seconds })),
  }, null, 2);
}

export function download(filename: string, content: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

export const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'episode';
