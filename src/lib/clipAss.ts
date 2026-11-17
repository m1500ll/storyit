import type { Caption, CaptionAnimId, CaptionStyleId } from '@/types/clips';

/** AI clipping: the ASS subtitle file burned into an exported clip (captions only; the title is a PNG, see clipTitle.ts). */

/** Output frame. Matches the export resolution in ffmpeg.ts and the preview (ClipPlayer). */
export const CLIP_FRAME = { w: 720, h: 1280 } as const;
/** Family name inside public/fonts/caption.otf (Inter Display ExtraBold). */
export const CAPTION_FONT = 'Inter Display ExtraBold';
/** caption font size at 100 %, in frame pixels (the customer scales it from 60 to 150 %) */
export const CAPTION_BASE = 56;

/** Look of each caption style. Colours are CSS hex; `hi` is the colour of the word being spoken (karaoke). */
export const CAPTION_LOOK: Record<CaptionStyleId, { color: string; hi: string; outline: number; box: boolean; upper: boolean; scale: number }> = {
  bold: { color: '#FFFFFF', hi: '#FFE14D', outline: 6, box: false, upper: true, scale: 1 },
  pop: { color: '#FFE14D', hi: '#FFFFFF', outline: 6, box: false, upper: true, scale: 1 },
  clean: { color: '#FFFFFF', hi: '#FFE14D', outline: 0, box: true, upper: false, scale: 0.86 },
};

/** #RRGGBB → ASS &HBBGGRR& */
const assColor = (hex: string) => `&H${hex.slice(5, 7)}${hex.slice(3, 5)}${hex.slice(1, 3)}&`.toUpperCase();

const ts = (s: number) => {
  const cs = Math.max(0, Math.round(s * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const sec = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
};

const escapeText = (t: string) => t.replace(/\\/g, '\\\\').replace(/[{}]/g, '').replace(/\s*\n\s*/g, '\\N').trim();

/** Wraps a title onto at most 3 lines of ~`max` characters. */
export function wrapTitle(text: string, max = 22): string {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if (line && (line + ' ' + w).length > max) { lines.push(line); line = w; } else line = (line + ' ' + w).trim();
  }
  if (line) lines.push(line);
  return lines.slice(0, 3).join('\n');
}

/** Captions that fall inside [start, end], shifted to clip time (0 = clip start), word timings included. */
export function captionsForClip(captions: Caption[], start: number, end: number): Caption[] {
  return captions
    .filter((c) => c.end > start && c.start < end && c.text.trim())
    .map((c) => ({
      start: Math.max(0, c.start - start), end: Math.min(end, c.end) - start, text: c.text.trim(),
      ...(c.words?.length ? { words: c.words.map((w) => ({ s: Math.max(0, w.s - start), e: Math.max(0, w.e - start), w: w.w })) } : {}),
    }));
}

export interface CaptionSettings { style: CaptionStyleId; size: number; pos: number; anim: CaptionAnimId }

/** Builds the Advanced SubStation file of the captions (timed chunks, optional pop-in and word highlight). */
export function buildClipAss(o: { captions: Caption[]; start: number; end: number } & CaptionSettings): string {
  const look = CAPTION_LOOK[o.style];
  const size = Math.round(CAPTION_BASE * look.scale * (o.size / 100));
  const outline = Math.max(look.box ? 10 : 2, Math.round((look.box ? 12 : look.outline) * (o.size / 100)));
  const head = `[Script Info]
ScriptType: v4.00+
PlayResX: ${CLIP_FRAME.w}
PlayResY: ${CLIP_FRAME.h}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,${CAPTION_FONT},${size},${assColor(look.color)},&H00FFFFFF,${look.box ? '&H66000000' : '&H00000000'},&H66000000,-1,0,0,0,100,100,0,0,${look.box ? 3 : 1},${outline},0,2,70,70,${Math.round(o.pos)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const up = (t: string) => (look.upper ? t.toLocaleUpperCase() : t);
  const lines: string[] = [];
  for (const c of captionsForClip(o.captions, o.start, o.end)) {
    const pop = o.anim !== 'none' ? '{\\fscx78\\fscy78\\t(0,110,\\fscx100\\fscy100)}' : '';
    let text: string;
    if (o.anim === 'karaoke' && c.words?.length) {
      // each word switches to the highlight colour while it is spoken (times relative to the line start, in ms)
      text = c.words.map((w) => {
        const a = Math.max(0, Math.round((w.s - c.start) * 1000));
        const b = Math.max(a + 1, Math.round((w.e - c.start) * 1000));
        return `{\\1c${assColor(look.color)}\\t(${a},${a},\\1c${assColor(look.hi)})\\t(${b},${b},\\1c${assColor(look.color)})}${escapeText(up(w.w))}`;
      }).join(' ');
    } else text = escapeText(up(c.text));
    lines.push(`Dialogue: 0,${ts(c.start)},${ts(c.end)},Caption,,0,0,0,,${pop}${text}`);
  }
  return head + lines.join('\n') + '\n';
}
