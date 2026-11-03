import { describe, expect, it } from 'vitest';
import { buildAss, speechSpan, timeWords } from '@/lib/captions';
import { spokenLine, wrapCaption } from '@/lib/assemble';

describe('speechSpan', () => {
  it('skips leading and trailing silence', () => {
    const log = 'silence_start: 0\nsilence_end: 0.42 | silence_duration: 0.42\nsilence_start: 4.8\n';
    expect(speechSpan(log, 6)).toEqual({ start: 0.42, end: 4.8 });
  });
  it('keeps mid-sentence pauses inside the span', () => {
    const log = 'silence_start: 0\nsilence_end: 0.3\nsilence_start: 2.1\nsilence_end: 2.6\n';
    expect(speechSpan(log, 6)).toEqual({ start: 0.3, end: 6 });
  });
  it('falls back to most of the clip when no speech is found', () => {
    const span = speechSpan('silence_start: 0\nsilence_end: 5.9\n', 6);
    expect(span.end - span.start).toBeGreaterThan(3);
  });
});

describe('timeWords', () => {
  it('covers the span in order, longer words get more time', () => {
    const w = timeWords('Non ! Tu mens complètement', 1, 4);
    expect(w.map((x) => x.word)).toEqual(['Non', '!', 'Tu', 'mens', 'complètement']);
    expect(w[0]!.start).toBe(1);
    expect(w.at(-1)!.end).toBeCloseTo(4, 5);
    for (let i = 1; i < w.length; i++) expect(w[i]!.start).toBeCloseTo(w[i - 1]!.end, 5);
    expect(w[4]!.end - w[4]!.start).toBeGreaterThan(w[2]!.end - w[2]!.start);
  });
  it('returns nothing for an empty line', () => expect(timeWords('   ', 0, 2)).toEqual([]));
});

describe('buildAss', () => {
  it('writes one popping event per word and highlights shouted words', () => {
    const ass = buildAss(timeWords('Va-t-en MAINTENANT !', 0.5, 2.5));
    const events = ass.split('\n').filter((l) => l.startsWith('Dialogue:'));
    expect(events).toHaveLength(3);
    expect(events[0]).toContain('\\t(0,90,\\fscx118');
    expect(events[1]).toContain('\\c&H0028E0FF&');
    expect(ass).toContain('PlayResY: 1280');
  });
  it('strips ASS control characters from words', () => {
    expect(buildAss(timeWords('{hack}', 0, 1))).not.toContain('{hack}');
  });
});

describe('caption text', () => {
  it('keeps only the spoken line', () => {
    expect(spokenLine('Fraise (sobbing): "Pourquoi tu m\'as fait ça ?"')).toBe("Pourquoi tu m'as fait ça ?");
    expect(spokenLine('Pomme: Je pars.')).toBe('Je pars.');
    expect(spokenLine(null)).toBeNull();
  });
  it('wraps to 3 lines max', () => expect(wrapCaption('un deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze seize', 12).split('\n')).toHaveLength(3));
});
