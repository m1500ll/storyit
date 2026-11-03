# Storyit.io — MVP

AI studio that turns one idea into a 15-scene vertical (9:16) short-form episode. First vertical: **Fruit Drama**.

## Run

```bash
npm install
npm run dev
```

Without `.env`, everything runs on in-memory demo data. To use Supabase:

1. In the Supabase **SQL Editor**, run `supabase/migrations/0001_init.sql`, then `0002_auth_profiles_realtime.sql`.
2. `cp .env.example .env`, then restart `npm run dev`.
3. Sign up at `/login`; each new account gets 30 free Story Credits.

AI: deploy `supabase/functions/gemini` and set the `GEMINI_API_KEY` secret (Edge Functions → Secrets). Set `VITE_AI_MODE=demo` to skip Gemini.

## Structure

```
src/
  components/
    ui/          Button, Card, Modal, StatusBadge, ProgressBar, CreditBalance, CreditCard, Logo, PageHeader
    layout/      AppShell, Sidebar, Topbar, MarketingNavbar
    landing/     Hero, DemoVideo, FeatureGrid, Pricing
    dashboard/   ProjectCard
    wizard/      WizardSteps, IdeaStep, ConceptStep, StoryboardStep
    scenes/      SceneCard (edit/retry), ApprovalPanel (human gate)
  pages/         Landing, Dashboard, CreateStoryWizard, SceneEditor, ReviewQueue, Settings
  services/      repository/ (Repository port: mock + Supabase), gemini (StoryAI adapter), credits, production, store
  lib/           supabase client, approval hash, cn
  types/         database.ts (Supabase schema types), domain.ts
supabase/migrations/0001_init.sql   schema + RLS + consume_credits() + approval-revocation trigger
```

## Key rules
- **Gemini key is server-only**: `services/gemini.ts` calls a `gemini` Supabase Edge Function (to be written).
- **Credits** are debited only via the `consume_credits` SECURITY DEFINER function; clients cannot update balances.
- **Approval** stores a fingerprint of scene content; any edit revokes it (client-side in mocks, DB trigger in Supabase).

## Payments (Stripe) — setup checklist
1. Run `supabase/migrations/0003_billing.sql` in the SQL Editor.
2. In Stripe (test mode first), create 4 prices: Creator $29/mo, Studio $99/mo (recurring), Pack 100 $12, Pack 500 $49 (one-time).
3. Supabase → Edge Functions → Secrets: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_CREATOR`, `STRIPE_PRICE_STUDIO`, `STRIPE_PRICE_PACK_100`, `STRIPE_PRICE_PACK_500`, `APP_URL`.
4. Deploy `supabase/functions/billing` (Verify JWT on) and `supabase/functions/stripe-webhook` (Verify JWT **off**).
5. Stripe → Developers → Webhooks: endpoint `https://<project>.supabase.co/functions/v1/stripe-webhook`, events `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`; put its signing secret in `STRIPE_WEBHOOK_SECRET`.

## Testimonials
`src/data/testimonials.ts` holds placeholder quotes that only render in dev. Replace them with real, consented quotes before launch.

## Video render pipeline
- `supabase/migrations/0004_render_pipeline.sql`: scene render stages + private `renders` storage bucket.
- `supabase/functions/render`: per scene, keyframe image (Gemini image) → 9:16 clip (Veo, long-running) → voice-over (Gemini TTS). The browser calls `tick` in a loop (`useRenderLoop`); each call works ~95s, so the Edge Function limit is never hit. Scene 1's image is the visual reference for all others (character consistency).
- Final MP4 is assembled **in the browser** with self-hosted ffmpeg.wasm (`src/lib/assemble.ts`): clips looped/trimmed to fit the voice-over, captions burned in (Inter Display, OFL), 720×1280 H.264/AAC.
- Model names are env-overridable (Google renames often): `GEMINI_IMAGE_MODEL` (gemini-3.1-flash-image), `VIDEO_MODEL` (gemini-omni-1.1-flash, Interactions API — Veo was retired), `GEMINI_TTS_MODEL` (gemini-3.8-flash-tts), `TTS_VOICE`, `RENDER_CREDITS_PER_SCENE`, `RENDER_CONCURRENCY` (default 2; clips arrive inline, more scenes at once runs out of memory).
- Voices: by default (`VOICE_MODE=native`) the characters speak inside the Gemini Omni clip with lip-sync, like Google Flow (which runs the same "1.1 Flash" model). No narrator, no TTS step, no looping. `VOICE_MODE=tts` restores the old narrator voice-over.
- Credit pricing (20/scene), from a real run (Nov 2026):
  - video ≈ $0.10/s (5,792 tokens/s at 720p) → $0.40–0.60 for a 4–6 s clip; keyframe image ≈ $0.067
  - ≈ $0.57/scene, plus ~20% for free retries ≈ $0.68 → a 15-scene, ~75 s episode costs us ≈ $8–10
  - cheapest credit sold = Studio, $99 / 1200 = $0.0825 → 20 credits ≈ $1.65 → ~55–60% gross margin after Stripe fees
  - TikTok pays only for 60 s+ videos, so ≈ $6 of video per episode is the floor at API prices. Recheck https://ai.google.dev/gemini-api/docs/pricing when Google changes prices.

## Production workflow (Phases 1–5)
Every episode page shows the 5 phases with their real status (`src/lib/publishPack.ts → productionPhases`).
1. **Concept**: `gemini` function, `task: concepts` (3 concepts, characters with a fixed `voice_style`).
2. **Script & characters**: `task: scenes` (one spoken line per scene, no narrator, 6–8 locations). Characters are stored in `characters` and reused by every image/video prompt.
3. **Images**: `render` function, keyframe per scene (scene 1 image = visual reference for the others). Per-scene retry is free.
4. **Video & audio**: Gemini Omni clip from the keyframe, characters speaking in-clip (native audio), then browser assembly (ffmpeg.wasm) with animated word-by-word captions (`src/lib/captions.ts`).
5. **Thumbnail & SEO pack**: `/app/stories/:id/publish`.
   - `gemini` `task: publish_pack` (1 credit): 5 titles (emotion/conflict/sacrifice/suspense/curiosity), caption, per-platform metadata (TikTok, Reels, Shorts) clamped to platform limits, structured thumbnail prompt. Saved in `publish_packs`.
   - `render` `action: thumbnail` (2 credits, refunded on failure): image variant (9:16 or 16:9) saved in `thumbnails` + `renders` bucket.
   - Users may only change their choices (title, caption, selected thumbnail): enforced by the `publish_packs_guard` trigger.
   - Publishing: no social account is connected yet. The review tab only exports a ready-to-paste kit, and only after the episode is approved. Nothing is ever posted automatically.

Migration: `supabase/migrations/0005_publish_pack.sql`.

## Tests
`npm test` (Vitest): captions timing/ASS, platform copy & limits, phase status, mock-repository workflow (concept → characters → scenes, credit debits, approval revocation, publish pack, no fake thumbnails in demo).
