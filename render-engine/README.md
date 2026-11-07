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

## Production (Animated Studio)
- `worker/pipeline.ts` claims queued `animated_projects` rows and produces each short: VideoSpec by Claude
  (`specWriter.ts`), ElevenLabs narration (`voice.ts`), soundtrack (`audio/spec_audio.py`), render (`render.ts`),
  upload to `renders/<user_id>/animated/<project_id>.mp4`, refund on failure.
- `deploy/modal_app.py` runs it on Modal. GitHub Actions (`.github/workflows/deploy-render-worker.yml`) deploys it on
  every push that changes `render-engine/` on `feat/animated-studio` (repository variable `RENDER_WORKER_AUTODEPLOY=true`,
  secrets `MODAL_TOKEN_ID` / `MODAL_TOKEN_SECRET`). The worker's keys are in the Modal secret `storyit-render`.
- Supabase Edge Function secrets: `ANTHROPIC_API_KEY`, `RENDER_WORKER_URL` (`https://<workspace>--storyit-render-api.modal.run/wake`),
  `RENDER_WORKER_TOKEN` (same value as in the Modal secret).
