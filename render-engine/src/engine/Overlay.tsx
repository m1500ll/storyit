// Text layer on top of the 3D picture: the big hook title at the start, then one-word captions on the narration.
// Pure function of the frame (Remotion): no state, timings come from the voice's word alignment.
import React from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { VideoSpec, Word } from "../spec";

const FONT = "StoryitCaption";
let fontHandle: number | null = null;
const loadFont = () => {
  if (fontHandle !== null || typeof document === "undefined") return;
  fontHandle = delayRender("caption font");
  const face = new FontFace(FONT, `url(${staticFile("fonts/caption.otf")})`);
  face.load().then((f) => { (document.fonts as unknown as { add: (x: FontFace) => void }).add(f); continueRender(fontHandle!); }).catch((e) => cancelRender(e));
};

const INK = "#120a14", YELLOW = "#ffd400";
const textStyle = (size: number): React.CSSProperties => ({
  fontFamily: `${FONT}, Impact, sans-serif`, fontSize: size, lineHeight: 1.02, color: "#fff", textTransform: "uppercase",
  WebkitTextStroke: `${Math.round(size * 0.15)}px ${INK}`, paintOrder: "stroke fill", textShadow: `0 ${Math.round(size * 0.12)}px 0 ${INK}`,
});

/** when the title leaves the screen (s): after the hook line is spoken, kept between 2.2 and 4 s */
export const titleEnd = (words: Word[]) => {
  const hook = words.filter((w) => w.line === 0);
  const end = hook.length ? hook[hook.length - 1]!.end + 0.35 : 2.5;
  return Math.min(4, Math.max(2.2, end));
};

const Title: React.FC<{ title: NonNullable<VideoSpec["hook_title"]>; end: number; lang: string }> = ({ title, end, lang: spec_lang }) => {
  const f = useCurrentFrame(), { fps } = useVideoConfig();
  const out = Math.round(end * fps);
  if (f >= out + 6) return null;
  const pop = spring({ frame: f, fps, config: { damping: 11, stiffness: 180, mass: 0.6 } }); // overshoot, then settles
  const leave = interpolate(f, [out, out + 6], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const text = title.text.trim();
  const hl = title.highlight?.trim();
  const i = hl ? text.toLowerCase().indexOf(hl.toLowerCase()) : -1;
  const parts = i >= 0 ? [text.slice(0, i), text.slice(i, i + hl!.length), text.slice(i + hl!.length)] : [text, "", ""];
  const size = text.length > 48 ? 92 : text.length > 32 ? 104 : 118;
  const style = title.style ?? "choc";
  const scale = 0.6 + 0.4 * pop;
  if (style === "bandeau") return ( // red "breaking news" band with a TRUE STORY tag
    <AbsoluteFill style={{ opacity: leave }}>
      <div style={{ position: "absolute", top: 250, left: 0, right: 0, transform: `translateX(${(1 - pop) * -1080}px)` }}>
        <div style={{ display: "inline-block", marginLeft: 60, marginBottom: 18, background: "#fff", color: "#c8102e", fontFamily: `${FONT}, sans-serif`,
          fontSize: 40, letterSpacing: 6, padding: "10px 24px", borderRadius: 10, textTransform: "uppercase" }}>{title.kicker || (spec_lang === "en" ? "True story" : "Histoire vraie")}</div>
        <div style={{ background: "#c8102e", color: "#fff", fontFamily: `${FONT}, sans-serif`, fontSize: size * 0.92, lineHeight: 1.05, textTransform: "uppercase",
          padding: "40px 60px 44px", boxShadow: "0 18px 0 #7a0a1c" }}>{parts[0]}<span style={{ color: YELLOW }}>{parts[1]}</span>{parts[2]}</div>
      </div>
    </AbsoluteFill>
  );
  if (style === "cinema") return ( // dark top gradient, date and place in yellow, the key words on a yellow marker
    <AbsoluteFill style={{ opacity: leave }}>
      <div style={{ position: "absolute", inset: "0 0 auto 0", height: 1000, background: "linear-gradient(rgba(0,0,0,.8), rgba(0,0,0,0))" }} />
      <div style={{ position: "absolute", top: 260, left: 70, right: 70, textAlign: "center", transform: `scale(${scale})` }}>
        {title.kicker && <div style={{ fontFamily: `${FONT}, sans-serif`, fontSize: 44, letterSpacing: 10, color: YELLOW, textTransform: "uppercase", marginBottom: 26 }}>{title.kicker}</div>}
        <div style={{ fontFamily: `${FONT}, sans-serif`, fontSize: size, lineHeight: 1.1, color: "#fff", textTransform: "uppercase", textShadow: "0 6px 30px #000" }}>
          {parts[0]}<span style={{ background: YELLOW, color: INK, padding: "0 16px", borderRadius: 10, WebkitBoxDecorationBreak: "clone", boxDecorationBreak: "clone", textShadow: "none" }}>{parts[1]}</span>{parts[2]}
        </div>
      </div>
    </AbsoluteFill>
  );
  return ( // choc: huge outlined letters, the key words in yellow, slightly tilted
    <AbsoluteFill style={{ alignItems: "center", opacity: leave }}>
      <div style={{ position: "absolute", top: 300, left: 60, right: 60, textAlign: "center", transform: `scale(${scale}) rotate(-2deg)` }}>
        {title.kicker && (
          <div style={{ fontFamily: `${FONT}, sans-serif`, fontSize: 44, letterSpacing: 8, color: YELLOW, textTransform: "uppercase", marginBottom: 22,
            WebkitTextStroke: `8px ${INK}`, paintOrder: "stroke fill" }}>{title.kicker}</div>
        )}
        <div style={textStyle(size)}>{parts[0]}<span style={{ color: YELLOW }}>{parts[1]}</span>{parts[2]}</div>
      </div>
    </AbsoluteFill>
  );
};

/** one word at a time, centred in the lower middle of the frame, with a small pop on each new word */
const Captions: React.FC<{ words: Word[]; from: number }> = ({ words, from }) => {
  const f = useCurrentFrame(), { fps } = useVideoConfig();
  const t = f / fps;
  if (t < from) return null;
  let k = -1;
  for (let j = 0; j < words.length; j++) { if (words[j]!.start <= t + 0.02) k = j; else break; }
  if (k < 0) return null;
  const w = words[k]!;
  const next = words[k + 1];
  if (t > w.end + 0.6 && (!next || next.start > t)) return null; // long pause: no stale word on screen
  const age = f - Math.round(w.start * fps);
  const s = interpolate(age, [0, 2, 5], [0.82, 1.08, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const len = w.word.length;
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <div style={{ position: "absolute", top: 1180, left: 40, right: 40, textAlign: "center", transform: `scale(${s})` }}>
        <span style={textStyle(len > 12 ? 82 : len > 8 ? 96 : 110)}>{w.word}</span>
      </div>
    </AbsoluteFill>
  );
};

export const Overlay: React.FC<{ spec: VideoSpec; words: Word[] }> = ({ spec, words }) => {
  loadFont();
  const title = spec.hook_title?.text ? spec.hook_title : null;
  const end = title ? titleEnd(words) : 0;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {title && <Title title={title} end={end} lang={spec.language} />}
      {spec.captions !== false && <Captions words={words} from={end} />}
    </AbsoluteFill>
  );
};
