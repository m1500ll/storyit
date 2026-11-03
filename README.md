# Storyit.io — MVP

AI studio that turns one idea into a 15-scene vertical (9:16) short-form episode. First vertical: **Fruit Drama**.

## Run

```bash
npm install
npm run dev
```

Without `.env`, every service runs on in-memory mocks (`src/data`). Copy `.env.example` → `.env` to use Supabase.

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
  services/      gemini (StoryAI adapter), credits, stories, production (render queue), store
  lib/           supabase client, approval hash, cn
  types/         database.ts (Supabase schema types), domain.ts
supabase/migrations/0001_init.sql   schema + RLS + consume_credits() + approval-revocation trigger
```

## Key rules
- **Gemini key is server-only**: `services/gemini.ts` calls a `gemini` Supabase Edge Function (to be written).
- **Credits** are debited only via the `consume_credits` SECURITY DEFINER function; clients cannot update balances.
- **Approval** stores a fingerprint of scene content; any edit revokes it (client-side in mocks, DB trigger in Supabase).
