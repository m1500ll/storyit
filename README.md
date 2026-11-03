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
- Model names are env-overridable (Google renames often): `GEMINI_IMAGE_MODEL`, `VEO_MODEL`, `GEMINI_TTS_MODEL`, `TTS_VOICE`, `RENDER_CREDITS_PER_SCENE`.
- ⚠️ Credit pricing (3/scene) is a placeholder: recompute from current Veo/image/TTS prices before charging customers.
