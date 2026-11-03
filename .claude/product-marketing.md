# Storyit.io — product marketing context

Read by the cro / signup / onboarding / paywalls / pricing / copywriting skills. Keep it TRUE: update when the product changes.

## Product
AI studio for vertical short-form story series (TikTok, YouTube Shorts, Instagram Reels). First format: "Fruit Drama" (anthropomorphic fruit soap operas); also general AI stories.
Flow: one-sentence idea → 3 AI concepts (Gemini) → 15-scene storyboard with dialogue, image & motion prompts → render (keyframe image → Veo clip → voice-over per scene) → human approval → final 9:16 MP4 with captions, assembled in the browser.

## Status (be honest in copy)
- Live & tested: ideas → concepts → storyboard (Gemini), credits, approval gate, exports (.srt/.md/.json), in-browser MP4 assembly.
- Built, NOT yet verified with real Google APIs: image/Veo/voice rendering. Do not claim "final video in one click" on public pages until a real episode has rendered end-to-end.
- Payments: Stripe code ready, not yet configured.

## Audience
Faceless creators and small studios who want to post story videos daily and reach platform monetisation (TikTok Creator Rewards needs videos > 1 min). Mostly French-speaking at launch; site copy is English.

## Core value
- Time: removes the evenings spent writing, storyboarding and prompting each episode.
- Money: the 60–100 s story format fits creator monetisation programs. Never promise earnings; simulator + disclaimer only.
- Control: mandatory human approval; edits revoke approval.

## Pricing (src/services/credits.ts)
Story Credits: 1 concepts, 2 storyboard, 3 per rendered scene (≈45 per 15-scene episode — placeholder, to be recomputed from real render costs). Free 30 credits (no card). Creator $29/mo 300 cr, Studio $99/mo 1200 cr, packs 100 cr $12 / 500 cr $49.

## Aha moment
Seeing your own idea turned into 3 concepts and a 15-scene storyboard (≈1 min after signup). Activation = first episode rendered/approved.

## Proof we may use
Owner-made example episodes in /public/showcase ("produced by the Storyit team"). Owner's own monetisation screenshots (data/results.ts) with "personal, not typical" disclaimer.
## Proof we must NOT invent
User counts, logos, testimonials, "most popular" badges, ratings, earnings claims.
