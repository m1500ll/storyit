# Storyit render engine

Animated 3D story shorts (flat ink-outlined characters in a painted three.js world, inside Remotion), driven by a
**VideoSpec** (`src/spec.ts`) that Claude writes from the client's brief. Built from
[mromidev/claude-animated-shorts](https://github.com/mromidev/claude-animated-shorts) (MIT, see `licenses/`).

- `src/spec.ts`: the VideoSpec contract (decor, groups of characters, shots, cameras, lens, fx, sound, music). Every
  time is a cue on a narration word (`{ line, word, offset }`), so a spec re-times itself to any voice.
- `src/resolve.ts`: cues -> seconds/frames from the voice's word timings.
- `src/engine/`: the template's renderer (world, ink, lens blur, grade, toon characters) made spec-driven
  (`story.ts` runtime, `crowd.ts` group motion, `cast.ts` staging, `world.ts` optional river/bridge/town/props/set pieces).
- `examples/hammersmith.en.json` + `.words.json`: the Hammersmith short rebuilt as data.
- `public/kenney/`: Kenney CC0 models (licence in `licenses/`).

Not part of the Vite app build (the root `tsconfig.json` only includes `src/`).

## Test stills (no GPU)
```bash
cd render-engine && npm install
CHROME_BIN=/path/to/chrome-headless-shell REMOTION_GL=swangle REMOTION_TMP=$PWD/.rtmp \
  node scripts/stills.mjs examples/hammersmith.en.json examples/hammersmith.en.words.json out/t/x_ 30,520,1200 0.5
```
