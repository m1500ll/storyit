import type { Caption, CaptionAnimId, CaptionStyleId } from '@/types/clips';

/** AI clipping: the ASS subtitle file burned into an exported clip (captions only; the title is a PNG, see clipTitle.ts). */

/** Output frame. Matches the export resolution in ffmpeg.ts and the preview (ClipPlayer). */
export const CLIP_FRAME = { w: 720, h: 1280 } as const;
/** Family name inside public/fonts/caption.otf (Inter Display ExtraBold). */
export const CAPTION_FONT = 'Inter Display ExtraBold';
/** Family name inside public/fonts/caption-word.ttf (Anton): the condensed face of the "Clipper" style. */
export const CAPTION_WORD_FONT = 'Anton';
/** caption font size at 100 %, in frame pixels (the customer scales it from 60 to 150 %) */
export const CAPTION_BASE = 56;

/** Look of each caption style. Colours are CSS hex; `hi` is the colour of the word being spoken (karaoke). */
export const CAPTION_LOOK: Record<CaptionStyleId, { color: string; hi: string; outline: number; box: boolean; upper: boolean; scale: number; font?: 'word' }> = {
  clipper: { color: '#FFFFFF', hi: '#FFE14D', outline: 5, box: false, upper: true, scale: 1.05, font: 'word' },
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

/** a word shown on its own: no trailing comma, full stop or colon (question and exclamation marks stay) */
export const wordText = (w: string) => w.replace(/[,.;:…]+$/u, '');

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
      ...(c.words?.length ? { words: c.words.map((w) => ({ s: Math.max(0, w.s - start), e: Math.max(0, w.e - start), w: w.w, ...(w.hi ? { hi: true } : {}) })) } : {}),
      ...(c.action ? { action: true } : {}),
    }));
}

/** "1 word" captions: one entry per spoken word (key words flagged), shown until the next word starts when the pause
 *  is short, so the screen never flickers mid-sentence. Reaction tags (*RIRE*) stay whole. Works on any timeline. */
export function wordTimeline(captions: Caption[]) {
  const items = captions.flatMap((c) => (c.words?.length && !c.action
    ? c.words.map((w) => ({ s: w.s, e: w.e, text: wordText(w.w), hi: !!w.hi }))
    : [{ s: c.start, e: c.end, text: c.text, hi: false }])).filter((w) => w.text);
  return items.map((w, i) => {
    const next = items[i + 1];
    const end = next ? (next.s - w.e < 0.6 ? next.s : w.e + 0.3) : w.e + 0.3;
    return { ...w, e: Math.max(end, w.s + 0.08) };
  });
}

export interface CaptionSettings { style: CaptionStyleId; size: number; pos: number; anim: CaptionAnimId }

/** Builds the Advanced SubStation file of the captions (timed chunks, optional pop-in and word highlight). */
export function buildClipAss(o: { captions: Caption[]; start: number; end: number } & CaptionSettings): string {
  const look = CAPTION_LOOK[o.style];
  // libass sizes a font by its full height (OS/2 win ascent + descent), CSS by its em: convert so the export matches
  // the preview (Anton: 1.733 em, Inter Display: 1.21 em)
  const size = Math.round(CAPTION_BASE * look.scale * (o.size / 100) * (look.font === 'word' ? 1.733 : 1.21));
  const outline = Math.max(look.box ? 10 : 2, Math.round((look.box ? 12 : look.outline) * (o.size / 100)));
  const head = `[Script Info]
ScriptType: v4.00+
PlayResX: ${CLIP_FRAME.w}
PlayResY: ${CLIP_FRAME.h}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,${look.font === 'word' ? CAPTION_WORD_FONT : CAPTION_FONT},${size},${assColor(look.color)},&H00FFFFFF,${look.box ? '&H66000000' : '&H00000000'},&H66000000,-1,0,0,0,100,100,0,0,${look.box ? 3 : 1},${outline},0,2,70,70,${Math.round(o.pos)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const up = (t: string) => (look.upper ? t.toLocaleUpperCase() : t);
  const lines: string[] = [];
  const pop = o.anim !== 'none' ? '{\\fscx78\\fscy78\\t(0,110,\\fscx100\\fscy100)}' : '';
  const colorOf = (hi?: boolean) => `{\\1c${assColor(hi ? look.hi : look.color)}}`;
  const clip = captionsForClip(o.captions, o.start, o.end);
  if (o.anim === 'word') {
    for (const w of wordTimeline(clip)) lines.push(`Dialogue: 0,${ts(w.s)},${ts(w.e)},Caption,,0,0,0,,${pop}${colorOf(w.hi)}${escapeText(up(w.text))}`);
    return head + lines.join('\n') + '\n';
  }
  for (const c of clip) {
    let text: string;
    if (o.anim === 'karaoke' && c.words?.length) {
      // each word switches to the highlight colour while it is spoken (times relative to the line start, in ms)
      text = c.words.map((w) => {
        const a = Math.max(0, Math.round((w.s - c.start) * 1000));
        const b = Math.max(a + 1, Math.round((w.e - c.start) * 1000));
        return `{\\1c${assColor(look.color)}\\t(${a},${a},\\1c${assColor(look.hi)})\\t(${b},${b},\\1c${assColor(look.color)})}${escapeText(up(w.w))}`;
      }).join(' ');
    } else if (c.words?.some((w) => w.hi)) text = c.words.map((w) => `${colorOf(w.hi)}${escapeText(up(w.w))}`).join(' ');
    else text = escapeText(up(c.text));
    lines.push(`Dialogue: 0,${ts(c.start)},${ts(c.end)},Caption,,0,0,0,,${pop}${text}`);
  }
  return head + lines.join('\n') + '\n';
}
