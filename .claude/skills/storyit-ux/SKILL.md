---
name: storyit-ux
description: UX/UI quality bar for Storyit.io. Use before building or reviewing any page, component, form, modal, loading/empty state or landing-page copy in this repo.
---

# Storyit UX/UI rules

Sources: Vercel Web Interface Guidelines (github.com/vercel-labs/web-interface-guidelines),
r/SaaS landing-page threads (secondhand summaries), first-run/empty-state guidance for AI tools.
Run the checklist at the end before calling UI work done.
Full rule set: `references/web-interface-guidelines.md` (Vercel, MUST/SHOULD/NEVER). For visual direction on new pages, also follow the `frontend-design` skill.

## Brand & visual system
- Dark studio: `bg-ink-950` page, `surface` cards, borders `white/[0.06]`. Accents: violet (primary action), coral (secondary highlight). Never add new colours ad hoc — extend `tailwind.config.js`.
- Display font (`font-display`, Bricolage Grotesque, bold) for headings and big numbers only; Inter for everything else.
- One primary (violet) button per view. Secondary = `variant="secondary"`.
- Headings: `text-balance`. Numbers: `tabular-nums`.

## Landing page (conversion)
- Hero: concrete outcome, not vague claims ("one sentence → 15-scene vertical episode"). One primary CTA; secondary is "see it" (demo).
- Proof sits near the top. Only REAL proof: product demo, real numbers, real testimonials. Never invent reviews, user counts or logos (misleading + illegal in the EU). Placeholders render in dev only.
- Every section answers one objection: what is it → how it works → why trust it → what it costs → FAQ → CTA.
- Pricing shows the unit cost (credits per action) so there are no surprises.

## AI product states (most important for Storyit)
- **First run** is onboarding: empty dashboard teaches the core loop and offers one-click example ideas. Never a blank screen.
- **Waiting on AI**: show what is happening ("Writing 3 concepts…"), a skeleton shaped like the result, rotating progress copy, and that it may take ~10–30s. Never a lone spinner.
- **Errors** say what happened + what to do + whether credits were spent.
- **Cost before action**: every paid button shows its credit cost; insufficient credits open the paywall, never a dead error.
- Human approval: edits after approval must visibly revoke it.

## Interaction
- Visible `focus-visible` ring on everything interactive; never remove outlines without replacement.
- Icon-only buttons need `aria-label`. Use `<button>` for actions, `<Link>`/`<a>` for navigation.
- Destructive actions: confirm or undo. Warn before leaving a flow with unsaved progress.
- Modals: Escape closes, `overscroll-behavior: contain`, click-outside closes.
- `touch-action: manipulation` on controls; safe-area insets on fixed bars.
- Hover/active/focus visibly stronger than rest state.

## Forms
- Real `<label>` or `aria-label`; correct `type`, `autocomplete`, `name`; `spellCheck={false}` on emails.
- Placeholders end with `…` and show an example. Never block paste.
- Submit stays enabled until the request starts, then shows a spinner. Errors inline, announced via `aria-live="polite"`.

## Content & typography
- Specific button labels ("Generate concepts", not "Continue"). Second person, active voice.
- Use `…` not `...`, curly quotes, numerals for counts. Loading copy ends with `…`.
- Handle short, average and very long user text: `truncate` / `line-clamp` / `break-words`; flex/grid children get `min-w-0`.

## Motion & performance
- Animate only `transform`/`opacity`; never `transition: all`. Respect `prefers-reduced-motion`. Autoplay > 5s needs pause.
- Images: explicit size, `loading="lazy"` below the fold. Preconnect font/CDN hosts.
- Lazy-load routes (already done in `App.tsx`).

## Pre-delivery checklist
- [ ] Works at 375px wide: no horizontal scroll, nothing clipped, bottom nav doesn't cover content.
- [ ] Keyboard only: can reach and trigger every action; focus is visible; Escape closes overlays.
- [ ] Empty, loading, error and success states all designed.
- [ ] Every paid action shows its cost; out-of-credits path leads to the paywall.
- [ ] No fake social proof.
- [ ] Inputs are ≥16px on mobile (no iOS zoom); hit targets ≥24px (≥44px on touch).
- [ ] Features that are not live (beta, not configured) say so explicitly.
- [ ] `npm run build` passes; screenshot desktop + iPhone in Playwright.
