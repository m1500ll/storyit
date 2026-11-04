import { describe, expect, it } from 'vitest';
import { buildPhasePrompt, MASTER_PROMPT, normalizePhase, PHASES } from '@shared/promptStudio.ts';

const scenes = (n: number) => Array.from({ length: n }, (_, i) => ({ scene_number: 99 - i, location: `L${i}`, emotional_beat: 'rage', action: 'a', dialogue: [] }));

describe('Prompt Studio', () => {
  it('master prompt keeps the rules: French, 9:16, 15-20 scenes, 6-8 locations, text only', () => {
    for (const rule of ['FRANÇAIS', '9:16', '15 à 20 scènes', '6 à 8 lieux', 'NE GÉNÈRE AUCUNE IMAGE']) expect(MASTER_PROMPT).toContain(rule);
  });
  it('each phase requires the previous validated ones and invalidates what depends on it', () => {
    expect(PHASES.script.requires).toEqual(['concepts', 'chosen']);
    expect(PHASES.videos.requires).toContain('images');
    expect(PHASES.concepts.invalidates).toEqual(expect.arrayContaining(['script', 'images', 'videos', 'pack']));
  });
  it('builds phase prompts only from validated data, with the chosen concept and user tweaks', () => {
    const p = buildPhasePrompt('script', { concepts: [{ title: 'A' }, { title: 'La fraise trahie' }], chosen: 1, feedback: 'plus de suspense' });
    expect(p).toContain('La fraise trahie');
    expect(p).not.toContain('"A"');
    expect(p).toContain('plus de suspense');
  });
  it('forces 9:16, renumbers scenes 1..n and caps at 20', () => {
    const imgs = normalizePhase('images', { scenes: scenes(24).map((s) => ({ ...s, aspect_ratio: '16:9', prompt: 'x' })) });
    expect(imgs).toHaveLength(20);
    expect(imgs.map((s: { scene_number: number }) => s.scene_number)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(imgs.every((s: { aspect_ratio: string }) => s.aspect_ratio === '9:16')).toBe(true);
  });
  it('rejects unusable answers instead of saving them (no credit charged)', () => {
    expect(() => normalizePhase('concepts', { concepts: [] })).toThrow();
    expect(() => normalizePhase('script', { scenes: scenes(5) })).toThrow(/trop court/);
  });
  it('keeps exactly 3 concepts, 5 titles, clean hashtags', () => {
    expect(normalizePhase('concepts', { concepts: [1, 2, 3, 4].map((i) => ({ title: `C${i}` })) })).toHaveLength(3);
    const pack = normalizePhase('pack', { thumbnail: { prompt: 'p' }, titles: ['1', '2', '3', '4', '5', '6'], caption: 'c', hashtags: ['AIFruit', '#FruitDrama', 'Fruit Drama', 'AIFruit'] });
    expect(pack.titles).toHaveLength(5);
    expect(pack.hashtags).toEqual(['#AIFruit', '#FruitDrama']);
    expect(pack.thumbnail.aspect_ratio).toBe('9:16');
  });
});
