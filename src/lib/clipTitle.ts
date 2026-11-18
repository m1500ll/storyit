import type { TitleStyleId } from '@/types/clips';
import { CLIP_FRAME, wrapTitle } from './clipAss';

/** AI clipping: the clip title drawn on a transparent 720-px-wide PNG, TikTok style. The SAME image is shown in the
 *  preview and burned into the export, so both always match. Where it sits depends on the layout (clipLayout.ts). */
const EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"';
const FONT = `"Clip Caption", "Inter Display", Inter, ${EMOJI}, sans-serif`;
const TIKTOK_FONT = `"Clip Title", Inter, ${EMOJI}, sans-serif`;

async function fontReady(px: number, tiktok: boolean) {
  try { await document.fonts.load(tiktok ? `600 ${px}px "Clip Title"` : `800 ${px}px "Clip Caption"`); } catch { /* fall back to Inter */ }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** the title canvas, or null when there is no title */
export async function drawTitle(title: string, style: TitleStyleId): Promise<HTMLCanvasElement | null> {
  const text = title.trim();
  if (!text) return null;
  const W = CLIP_FRAME.w;
  const cx = W / 2;
  if (style === 'tiktok') {
    // the classic TikTok text box, as clippers use it: semibold black text, one white rounded band per line, 2 lines max
    const size = 31, padX = 14, lineH = 44, r = 9;
    await fontReady(size, true);
    const lines = wrapTitle(text, 34).split('\n').slice(0, 2);
    const c = document.createElement('canvas');
    c.width = W; c.height = lines.length * lineH + 12;
    const ctx = c.getContext('2d')!;
    ctx.font = `600 ${size}px ${TIKTOK_FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const widths = lines.map((l) => Math.min(W - 24, ctx.measureText(l).width + padX * 2));
    ctx.fillStyle = '#FFFFFF';
    lines.forEach((_, i) => { roundRect(ctx, cx - widths[i]! / 2, 6 + i * lineH, widths[i]!, lineH + 0.5, r); ctx.fill(); });
    ctx.fillStyle = '#161616';
    lines.forEach((l, i) => ctx.fillText(l, cx, 6 + i * lineH + lineH / 2 + 1, W - 24 - padX * 2));
    return c;
  }
  const size = style === 'box' ? 44 : 52;
  await fontReady(size, false);
  const lines = wrapTitle(text, style === 'box' ? 24 : 20).split('\n');
  const lineH = Math.round(size * (style === 'box' ? 1.42 : 1.18));
  const H = lines.length * lineH + 60;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  if (style === 'box') {
    // TikTok "classic" text: black letters on a white rounded band per line, the bands merging into one shape
    const padX = 18, r = 14;
    const widths = lines.map((l) => ctx.measureText(l).width + padX * 2);
    ctx.fillStyle = '#FFFFFF';
    lines.forEach((_, i) => { roundRect(ctx, cx - widths[i]! / 2, 20 + i * lineH, widths[i]!, lineH + 1, r); ctx.fill(); });
    ctx.fillStyle = '#111111';
    lines.forEach((l, i) => ctx.fillText(l, cx, 20 + i * lineH + lineH / 2 + 2));
  } else {
    ctx.lineJoin = 'round'; ctx.miterLimit = 2;
    lines.forEach((l, i) => {
      const y = 30 + i * lineH + lineH / 2;
      if (style === 'neon') {
        ctx.shadowColor = 'rgba(217,70,239,0.95)'; ctx.shadowBlur = 22;
        ctx.lineWidth = 9; ctx.strokeStyle = '#3b0764'; ctx.strokeText(l, cx, y);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#FFFFFF'; ctx.fillText(l, cx, y);
      } else {
        ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowOffsetY = 4; ctx.shadowBlur = 0;
        ctx.lineWidth = 12; ctx.strokeStyle = '#000000'; ctx.strokeText(l, cx, y);
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#FFFFFF'; ctx.fillText(l, cx, y);
      }
    });
  }
  return c;
}

export async function titlePngBytes(title: string, style: TitleStyleId): Promise<Uint8Array | null> {
  const c = await drawTitle(title, style);
  if (!c) return null;
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
}
