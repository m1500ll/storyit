# Storyit.io

React + Vite + TS + Tailwind front end, Supabase backend (`supabase/migrations`, `supabase/functions`).
- Before any UI work, follow the `storyit-ux` skill (`.claude/skills/storyit-ux/SKILL.md`).
- Also apply the `ui-ux-pro-max` skill (`.claude/skills/ui-ux-pro-max/`) for UX quality rules (accessibility, 44 px touch targets via `.touch-hit`, contrast, SVG icons instead of emoji). Its palettes and styles are suggestions only: on brand (colours, fonts, dark studio look) `storyit-ux` wins.
- Data access only through `src/services/repository` (mock + Supabase implementations). Never call `supabase.from` from components (exception: trivial profile edit in Settings).
- Secrets (Gemini, Stripe, service role) live only in Edge Function secrets — never in `VITE_` vars.
- The owner is a beginner and speaks French: explain steps simply, one action per step.
- Verify with `npx tsc -b && npm run build` and a Playwright run before pushing.
