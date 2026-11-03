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

AI output stays in demo mode until the `gemini` Edge Function exists (`VITE_USE_GEMINI_EDGE=true`).

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
