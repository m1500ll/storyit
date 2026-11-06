// usage: node scripts/stills.mjs <spec.json> <words.json> <outPrefix> <frame,frame,...> [scale]
// Renders test stills of a VideoSpec. Linux without GPU: CHROME_BIN=<chrome-headless-shell> REMOTION_GL=swangle.
import fs from "node:fs";
import path from "node:path";
if (process.env.REMOTION_TMP) { fs.mkdirSync(process.env.REMOTION_TMP, { recursive: true }); process.env.TEMP = process.env.TMP = process.env.REMOTION_TMP; }
const { bundle } = await import("@remotion/bundler");
const { renderStill, selectComposition } = await import("@remotion/renderer");
const [specP, wordsP, prefix, frames, scale = "0.5"] = process.argv.slice(2);
const inputProps = { spec: JSON.parse(fs.readFileSync(specP, "utf8")), words: JSON.parse(fs.readFileSync(wordsP, "utf8")) };
const browserExecutable = process.env.CHROME_BIN || null, chromiumOptions = { gl: process.env.REMOTION_GL || "angle" };
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id: "AnimatedShort", inputProps, browserExecutable, chromiumOptions });
console.log("composition", composition.durationInFrames, "frames");
const onBrowserLog = (l) => { if (l.type === "error" && !/colormap|404/.test(l.text)) console.log("[error]", l.text.slice(0, 300)); };
fs.mkdirSync(path.dirname(prefix), { recursive: true });
for (const f of frames.split(",").map(Number)) {
  const t0 = Date.now();
  await renderStill({ composition, serveUrl, frame: f, output: `${prefix}${f}.jpg`, imageFormat: "jpeg", jpegQuality: 88, scale: Number(scale),
    inputProps, browserExecutable, chromiumOptions, timeoutInMilliseconds: 240000, onBrowserLog });
  console.log("still", f, ((Date.now() - t0) / 1000).toFixed(1) + "s");
}
