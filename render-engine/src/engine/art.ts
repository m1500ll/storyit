// Story-specific drawings (spec.art): the characters, animals and objects a story needs that the engine has no model
// for (a rooster, a judge's bench, a statue...). Claude draws each one as a small SVG in the house style; the engine
// rasterises it once (before the first frame) and stands it in the world as an unlit cut-out card facing the camera,
// like the other flat characters. Groups use them with outfit { name: "art", art: id }: they stand, walk (a little
// bob), cheer (hop) and face their walking direction (drawings face right; the card is mirrored when going -x).
import type { VideoSpec } from "../spec";

export type ArtImg = { img: HTMLImageElement; aspect: number; height: number; alt?: HTMLImageElement };
export const ART = new Map<string, ArtImg>();

/** strips what an <img> could not use anyway (scripts, foreignObject, external links) */
export const cleanSvg = (svg: string) => svg
  .replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
  .replace(/(href|xlink:href)\s*=\s*"(?!#)[^"]*"/gi, "")
  .replace(/^[\s\S]*?(<svg[\s>])/i, "$1");

const aspectOf = (svg: string) => {
  const vb = svg.match(/viewBox\s*=\s*"\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (vb) return Number(vb[1]) / Number(vb[2]) || 1;
  const w = svg.match(/\swidth\s*=\s*"([\d.]+)/i), h = svg.match(/\sheight\s*=\s*"([\d.]+)/i);
  return w && h ? Number(w[1]) / Number(h[1]) || 1 : 1;
};

const load = (svg: string) => new Promise<HTMLImageElement>((resolve) => {
  const img = new Image();
  let s = cleanSvg(svg);
  if (!/\swidth\s*=/.test(s.slice(0, 300))) { // intrinsic size so Chrome rasterises it sharply
    const a = aspectOf(s);
    s = s.replace(/<svg/i, `<svg width="${Math.round(1024 * Math.min(1, a))}" height="${Math.round(1024 * Math.min(1, 1 / a))}"`);
  }
  img.onload = () => resolve(img);
  img.onerror = () => resolve(img); // a broken drawing renders as nothing rather than stalling the render
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
});

export const loadArt = async (spec: VideoSpec | undefined) => {
  for (const a of spec?.art ?? []) {
    if (ART.has(a.id)) continue;
    const [img, alt] = await Promise.all([load(a.svg), a.alt ? load(a.alt) : Promise.resolve(undefined)]);
    ART.set(a.id, { img, alt, aspect: aspectOf(cleanSvg(a.svg)), height: a.height });
  }
};
