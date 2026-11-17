import type { Caption, CaptionStyleId } from '@/types/clips';

/** AI clipping: the ASS subtitle file burned into an exported clip (title box on top, captions in the lower third). */

/** Output frame. Matches the export resolution in ffmpeg.ts and the preview (ClipPlayer). */
export const CLIP_FRAME = { w: 720, h: 1280 } as const;
/** Family name inside public/fonts/caption.otf (Inter Display ExtraBold). */
export const CAPTION_FONT = 'Inter Display ExtraBold';

// ASS colours are &HAABBGGRR (alpha 00 = opaque).
const STYLES: Record<CaptionStyleId, { size: number; primary: string; outline: string; back: string; border: 1 | 3; outlineW: number; upper: boolean }> = {
  bold: { size: 68, primary: '&H00FFFFFF', outline: '&H00000000', back: '&H80000000', border: 1, outlineW: 6, upper: true },
  pop: { size: 68, primary: '&H004DE1FF', outline: '&H00000000', back: '&H80000000', border: 1, outlineW: 6, upper: true },
  clean: { size: 52, primary: '&H00FFFFFF', outline: '&H99000000', back: '&H99000000', border: 3, outlineW: 14, upper: false },
};

const ts = (s: number) => {
  const cs = Math.max(0, Math.round(s * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const sec = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
};

const escapeText = (t: string) => t.replace(/\\/g, '\\\\').replace(/[{}]/g, '').replace(/\s*\n\s*/g, '\\N').trim();

/** Wraps a title onto at most 3 lines of ~`max` characters. */
export function wrapTitle(text: string, max = 24): string {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if (line && (line + ' ' + w).length > max) { lines.push(line); line = w; } else line = (line + ' ' + w).trim();
  }
  if (line) lines.push(line);
  return lines.slice(0, 3).join('\n');
}

/** Captions that fall inside [start, end], shifted to clip time (0 = clip start). */
export function captionsForClip(captions: Caption[], start: number, end: number): Caption[] {
  return captions
    .filter((c) => c.end > start && c.start < end && c.text.trim())
    .map((c) => ({ start: Math.max(0, c.start - start), end: Math.min(end, c.end) - start, text: c.text.trim() }));
}

/** Builds an Advanced SubStation file: timed captions near the bottom, optional title on top. */
export function buildClipAss(opts: { captions: Caption[]; start: number; end: number; style: CaptionStyleId; title: string | null }): string {
  const s = STYLES[opts.style];
  const duration = opts.end - opts.start;
  const head = `[Script Info]
ScriptType: v4.00+
PlayResX: ${CLIP_FRAME.w}
PlayResY: ${CLIP_FRAME.h}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,${CAPTION_FONT},${s.size},${s.primary},&H00FFFFFF,${s.outline},${s.back},-1,0,0,0,100,100,0,0,${s.border},${s.outlineW},0,2,60,60,330,1
Style: Title,${CAPTION_FONT},50,&H00111111,&H00FFFFFF,&H00FFFFFF,&H00FFFFFF,-1,0,0,0,100,100,0,0,3,16,0,8,70,70,150,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const lines: string[] = [];
  if (opts.title?.trim()) {
    lines.push(`Dialogue: 1,${ts(0)},${ts(duration)},Title,,0,0,0,,${escapeText(wrapTitle(opts.title))}`);
  }
  for (const c of captionsForClip(opts.captions, opts.start, opts.end)) {
    const text = s.upper ? c.text.toLocaleUpperCase() : c.text;
    lines.push(`Dialogue: 0,${ts(c.start)},${ts(c.end)},Caption,,0,0,0,,${escapeText(text)}`);
  }
  return head + lines.join('\n') + '\n';
}
