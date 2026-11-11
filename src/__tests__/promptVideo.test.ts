import { describe, expect, it } from 'vitest';
import { normalizePhase } from '@shared/promptStudio.ts';
import { buildVideoPlan, firstClips, projectSeconds, VIDEO_TIERS, videoBlocker, videoCost } from '@shared/promptVideo.ts';

const line = (character: string, start: number, end: number, text: string) => ({ character, start, end, text });
const clip = (seconds: number) => ({ seconds, location: 'kitchen', characters: ['Kévin', 'Lila'], summary: 's', open_question: 'q', new_thing: 'n', mini_hook: 'm',
  lines: [line('Kévin', 0.1, 3.3, 'Cent mille euros pour dormir chez moi ce soir'), line('Lila', 3.4, 6.6, 'Tu as signé le contrat sans même le lire')] });
const project = () => {
  const script = normalizePhase('script', {
    title: 'Le billet déchiré', paradox: 'p', synopsis: 's',
    characters: [{ name: 'Kévin', phonetic: 'Ké-vin', head: 'watermelon head', face: 'f', hands_neck: 'green', outfit: 'red hoodie', accessory: 'cap', voice: 'young voice', role: 'héros' },
      { name: 'Lila', phonetic: 'Li-la', head: 'lemon head', face: 'f', hands_neck: 'yellow', outfit: 'black suit', accessory: 'ring', voice: 'cold voice', role: 'méchante' }],
    locations: ['kitchen'], hook_candidates: [1, 2, 3, 4, 5].map((i) => ({ mechanic: `m${i}`, line: 'l' })), hook: { image: 'i', why: 'w' }, backup_hooks: [{ image: 'a', line: 'b' }, { image: 'c', line: 'd' }],
    clips: [clip(10), clip(15), clip(6), clip(10), clip(10)], cliffhanger: 'c',
    engagement: { levers: ['a'], references: ['x'], cult_line: 'c', target_comment: 't', scores: { villain: 2, debate: 2, cult_line: 2, share: 1, part2: 2, detail: 1 } },
  });
  const img = { setting: 'a kitchen', continuity: '', characters: [{ name: 'Kévin', action: 'shouting' }, { name: 'Lila', action: 'smirking' }] };
  const vid = { head_lock: [], look_lock: '', shots: [{ start: 0, end: 3.3, text: 'push-in on KÉVIN TALKING' }], sound: 'kitchen ambience' };
  return { v4: true, style: 'fruits', part: 1, script,
    images: { sheet: [{ name: 'Kévin', description: 'watermelon head, red hoodie' }, { name: 'Lila', description: 'lemon head, black suit' }], clips: [img, img, img, img, img] },
    videos: { clips: [vid, vid, vid, vid, vid] } };
};

describe('Prompt Studio → video', () => {
  it('prices follow the length: about 70 / 150 / 300 credits a minute, rounded up to 5', () => {
    expect(videoCost('eco', 60)).toBe(70);
    expect(videoCost('standard', 60)).toBe(150);
    expect(videoCost('premium', 60)).toBe(300);
    expect(videoCost('eco', 70)).toBe(85);
    expect(videoCost('premium', 72)).toBe(360);
    expect(videoCost('eco', 1) % 5).toBe(0);
  });
  it('an admin test keeps the first clips that fit', () => {
    expect(firstClips([6, 10, 10, 15, 15, 10].map((seconds) => ({ seconds })), 30)).toBe(3);
    expect(firstClips([{ seconds: 15 }], 5)).toBe(1);
  });
  it('the cheapest tier is the Lite animation in 480p', () => {
    expect(VIDEO_TIERS.eco).toMatchObject({ video_model: 'grok-imagine-video-1.5-lite', resolution: '480p' });
  });
  it('needs the script, the image prompts and the Grok prompts', () => {
    const d = project();
    expect(videoBlocker(d)).toBeNull();
    expect(videoBlocker({ ...d, videos: undefined })).toMatch(/étape 4/);
    expect(videoBlocker({ ...d, images: undefined })).toMatch(/étape 3/);
    expect(videoBlocker({ ...d, v4: false })).toMatch(/ancienne/);
    expect(projectSeconds(d)).toBe(51);
  });
  it('freezes one image and one Grok prompt per clip, with the clip length', () => {
    const plan = buildVideoPlan(project(), 'standard');
    expect(plan.clips.map((c) => c.seconds)).toEqual([10, 15, 6, 10, 10]);
    expect(plan.sheet_prompt).toContain('KÉVIN: watermelon head, red hoodie.');
    expect(plan.clips[0]!.image_prompt).toContain('Same characters as the attached character reference sheet');
    expect(plan.clips[1]!.grok_prompt).toMatch(/① Animate this image: 15-second[\s\S]*⑦ DIALOGUE/);
    expect(plan.cover_prompt).toBe('');
    expect(plan).toMatchObject({ video_model: 'grok-imagine-video', resolution: '720p', title: 'Le billet déchiré' });
  });
});
