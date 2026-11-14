import { describe, expect, it } from 'vitest';
import { applyCast, buildPhasePrompt, castOf, lookOf, STYLES } from '@shared/promptStudio.ts';
import { buildVideoPlan } from '@shared/promptVideo.ts';
import { characterSheetPrompt, UNIVERSES, type CastChar } from '@shared/characters.ts';

const adam: CastChar = { id: 'u1', name: 'Adam', role: 'Le héros', personality: 'ambitieux', voice: 'voix posée', look: 'a man whose SKIN is DIAMOND; outfit: a navy suit', sheet: 'storage:u/u1.jpg' };

describe('characters', () => {
  it('sheet prompt asks for adult realistic faces and tall proportions', () => {
    const p = characterSheetPrompt('matieres', adam.look);
    expect(p).toMatch(/NOT a baby face/);
    expect(p).toMatch(/7\.5 heads tall/);
    expect(p).toContain('navy suit');
    expect(characterSheetPrompt('perso', 'x'.repeat(20))).not.toContain('undefined');
    expect(Object.keys(UNIVERSES)).toHaveLength(10);
  });

  it('a cast replaces the style and is written into the phase prompts', () => {
    const ctx = { style: 'fruits', cast_chars: [adam] };
    expect(castOf(ctx)).toHaveLength(1);
    expect(lookOf(ctx).block).not.toContain('FRUIT');
    expect(lookOf({ style: 'fruits' }).block).toBe(STYLES.fruits.block);
    const p = buildPhasePrompt('script', { ...ctx, story: 'une histoire' });
    expect(p).toContain('Casting imposé');
    expect(p).toContain(adam.look);
  });

  it('keeps the exact look and voice of picked characters after a phase', () => {
    const ctx = { cast_chars: [adam] };
    const script = applyCast('script', { characters: [{ name: 'adam', voice: 'autre', head: 'autre' }] }, ctx);
    expect(script.characters[0].voice).toBe('voix posée');
    const images = applyCast('images', { sheet: [{ name: 'Adam', description: 'paraphrase' }] }, ctx);
    expect(images.sheet[0].description).toBe(adam.look);
  });

  it('passes the picked sheets to the video plan', () => {
    const d = { cast_chars: [adam], script: { title: 'T', clips: [{ seconds: 6, characters: ['Adam'], lines: [] }] }, images: { sheet: [{ name: 'Adam', description: adam.look }], clips: [] }, videos: { clips: [] } };
    expect(buildVideoPlan(d, 'eco').sheet_refs).toEqual(['storage:u/u1.jpg']);
  });
});
