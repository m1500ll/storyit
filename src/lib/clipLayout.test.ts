import { describe, expect, it } from 'vitest';
import type { ClipFraming } from '@/types/clips';
import { wordTimeline } from './clipAss';
import { classifyFraming, refineCam, type Grey, type Sample } from './clipFraming';
import { fitAspect, followExpr, layoutGraph, panelX, planLayout, resolveLayout } from './clipLayout';

const W = 1920, H = 1080;
const framing = (over: Partial<ClipFraming>): ClipFraming => ({ v: 1, w: W, h: H, kind: 'none', cams: [], segments: [], start: 10, end: 40, ...over });

describe('fitAspect', () => {
  it('keeps the crop inside the frame at the asked shape', () => {
    const r = fitAspect({ x: 1700, y: 900, w: 300, h: 200 }, 4 / 3, W, H);
    expect(r.x + r.w).toBeLessThanOrEqual(W);
    expect(r.y + r.h).toBeLessThanOrEqual(H);
    expect(r.w / r.h).toBeCloseTo(4 / 3, 1);
  });
});

describe('planLayout', () => {
  it('auto: a facecam gives the facecam + gameplay split, title on the line between them', () => {
    const p = planLayout('auto', framing({ kind: 'facecam', cams: [{ x: 1500, y: 700, w: 400, h: 300 }] }), W, H);
    expect(p.layout).toBe('split');
    expect(p.panels).toHaveLength(2);
    expect(p.panels[0]!.dst.y).toBe(0);
    expect(p.panels[1]!.dst.y).toBe(p.dividers[0]);
    expect(p.titleY).toBe(p.dividers[0]);
    expect(p.panels[1]!.dst.y + p.panels[1]!.dst.h).toBe(1280);
  });
  it('auto: two facecams stack both cams over the gameplay', () => {
    const p = planLayout('auto', framing({ kind: 'two_cams', cams: [{ x: 1500, y: 0, w: 400, h: 300 }, { x: 0, y: 0, w: 400, h: 300 }] }), W, H);
    expect(p.layout).toBe('stack');
    expect(p.panels).toHaveLength(3);
    expect(p.panels[0]!.src.x).toBe(0); // left cam first
  });
  it('auto without faces zooms a landscape video on a blurred background', () => {
    const p = planLayout('auto', framing({ kind: 'none' }), W, H);
    expect(p.layout).toBe('zoom');
    expect(p.bg).toBe('blur');
    expect(p.titleY).toBe(p.panels[0]!.dst.y);
  });
  it('a vertical source is simply filled', () => {
    expect(resolveLayout('auto', null, 1080, 1920)).toBe('fill');
  });
  it('split without a detected facecam falls back to zoom', () => {
    expect(resolveLayout('split', framing({}), W, H)).toBe('zoom');
  });
  it('speaker tracking cuts between the speakers, shifted to the clip start', () => {
    const f = framing({ kind: 'people', start: 10, segments: [{ t: 0, cx: 500, cy: 500 }, { t: 4, cx: 1400, cy: 500 }, { t: 9, cx: 500, cy: 500 }] });
    const p = planLayout('track', f, W, H, 12); // clip starts 2 s after the analysed range
    const panel = p.panels[0]!;
    expect(panelX(panel, 0)).toBe(panelX(panel, 1.9));
    expect(panelX(panel, 2.5)).not.toBe(panelX(panel, 0)); // the cut at 4 s (analysis time) is at 2 s in the clip
    expect(followExpr(panel)).toContain('if(lt(t,2.00)');
  });
});

describe('layoutGraph', () => {
  it('builds one crop per panel and the neon line', () => {
    const p = planLayout('split', framing({ kind: 'facecam', cams: [{ x: 1500, y: 700, w: 400, h: 300 }] }), W, H);
    const g = layoutGraph(p, true);
    expect(g).toContain('split=2[a0][a1]');
    expect(g.match(/crop=/g)).toHaveLength(2);
    expect(g).toContain('drawbox');
    expect(g.endsWith('[base]')).toBe(true);
  });
});

describe('classifyFraming', () => {
  const cam = (t: number, jaw = 0.1) => ({ cx: 1750, cy: 900, w: 90, h: 110, jaw: jaw + (t % 2) * 0.01 });
  it('finds a facecam overlay in a gameplay stream', () => {
    const samples: Sample[] = Array.from({ length: 30 }, (_, i) => ({ t: i * 0.4, faces: [cam(i)] }));
    const f = classifyFraming(samples, W, H, 0, 12);
    expect(f.kind).toBe('facecam');
    const c = f.cams[0]!;
    expect(c.x + c.w).toBe(W); // snapped to the right edge
    expect(c.w).toBeGreaterThan(200);
  });
  it('follows the person who speaks in a two-person podcast', () => {
    const samples: Sample[] = Array.from({ length: 40 }, (_, i) => {
      const t = i * 0.4, leftTalks = t < 8;
      return { t, faces: [
        { cx: 600, cy: 450, w: 260, h: 320, jaw: leftTalks ? (i % 2 ? 0.5 : 0.05) : 0.02 },
        { cx: 1350, cy: 460, w: 250, h: 310, jaw: leftTalks ? 0.02 : (i % 2 ? 0.55 : 0.05) },
      ] };
    });
    const captions = [{ start: 0, end: 16, text: 'blabla' }];
    const f = classifyFraming(samples, W, H, 0, 16, captions);
    expect(f.kind).toBe('people');
    expect(f.segments[0]!.cx).toBeLessThan(900);
    expect(f.segments.some((s) => s.cx > 1100 && s.t >= 7.5 && s.t <= 10)).toBe(true);
  });
  it('reports no face', () => {
    expect(classifyFraming([{ t: 0, faces: [] }], W, H, 0, 5).kind).toBe('none');
  });
});

describe('wordTimeline', () => {
  it('one word at a time, no trailing comma, key words flagged, reactions kept whole', () => {
    const items = wordTimeline([
      { start: 0, end: 1, text: 'Salut, toi', words: [{ s: 0, e: 0.4, w: 'Salut,' }, { s: 0.5, e: 1, w: 'toi', hi: true }] },
      { start: 3, end: 4, text: '*RIRE*', action: true },
    ]);
    expect(items.map((w) => w.text)).toEqual(['Salut', 'toi', '*RIRE*']);
    expect(items[0]!.e).toBe(0.5); // holds until the next word
    expect(items[1]!.hi).toBe(true);
  });
});

describe('gameplay crop', () => {
  it('two cams in the top corners: the game is taken below them', () => {
    const p = planLayout('stack', framing({ kind: 'two_cams', cams: [{ x: 20, y: 20, w: 520, h: 290 }, { x: 1380, y: 20, w: 520, h: 230 }] }), W, H);
    const game = p.panels[2]!.src;
    const cams = [{ x: 20, y: 20, w: 520, h: 290 }, { x: 1380, y: 20, w: 520, h: 230 }];
    for (const c of cams) expect(game.x < c.x + c.w && game.x + game.w > c.x && game.y < c.y + c.h && game.y + game.h > c.y).toBe(false);
    expect(game.w).toBeGreaterThan(700);
    expect(p.panels[0]!.src.x).toBeGreaterThanOrEqual(20); // the cam crop stays inside the cam
    expect(p.panels[0]!.src.x + p.panels[0]!.src.w).toBeLessThanOrEqual(540);
  });
  it('slides the gameplay crop away from a facecam on the right', () => {
    const p = planLayout('split', framing({ kind: 'facecam', cams: [{ x: 1336, y: 816, w: 560, h: 240 }] }), W, H);
    const game = p.panels[1]!.src;
    expect(game.x + game.w).toBeLessThanOrEqual(1336);
  });
});

describe('refineCam', () => {
  it('finds the real border of a facecam window from frames where the game moves', () => {
    // 1920×1080 source, frames at 480×270 (÷4). Real cam: x 1336..1920, y 816..1080 → grey x 334.., y 204..
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const greys: Grey[] = Array.from({ length: 6 }, () => {
      const px = new Float32Array(480 * 270);
      for (let y = 0; y < 270; y++) for (let x = 0; x < 480; x++) px[y * 480 + x] = x >= 334 && y >= 204 ? 200 + rnd() * 20 : 40 + rnd() * 30;
      return { w: 480, h: 270, px };
    });
    const guess = { x: 1600, y: 880, w: 320, h: 200 }; // from the face: too small
    const c = refineCam(guess, greys, 1920, 1080);
    expect(Math.abs(c.x - 1336)).toBeLessThan(16);
    expect(Math.abs(c.y - 816)).toBeLessThan(16);
    expect(c.x + c.w).toBeLessThanOrEqual(1920);
  });
});

describe('reaction layout', () => {
  it('camera on the left third, shared screen on the right: the screen part never shows the camera', () => {
    const p = planLayout('split', framing({ kind: 'facecam', cams: [{ x: 4, y: 4, w: 632, h: 1056 }] }), W, H);
    const game = p.panels[1]!.src;
    expect(game.x).toBeGreaterThanOrEqual(636);
    expect(game.x + game.w).toBeLessThanOrEqual(W);
    expect(game.w).toBeGreaterThan(900);
  });
});
