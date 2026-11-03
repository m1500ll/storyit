# Storyit.io

React + Vite + TS + Tailwind front end, Supabase backend (`supabase/migrations`, `supabase/functions`).
- Before any UI work, follow the `storyit-ux` skill (`.claude/skills/storyit-ux/SKILL.md`).
- Data access only through `src/services/repository` (mock + Supabase implementations). Never call `supabase.from` from components (exception: trivial profile edit in Settings).
- Secrets (Gemini, Stripe, service role) live only in Edge Function secrets — never in `VITE_` vars.
- The owner is a beginner and speaks French: explain steps simply, one action per step.
- Verify with `npx tsc -b && npm run build` and a Playwright run before pushing.
