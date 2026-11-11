import { ChevronDown } from 'lucide-react';
import { PROMPT_PROJECT_COST, formatCredits } from '@/services/credits';

export const faqs = [
  { q: 'Which platforms does Storyit publish to?', a: 'TikTok and Instagram Reels, through their official APIs. You can connect several accounts on each.' },
  { q: 'Do you need my passwords?', a: 'No. You log in on TikTok’s and Instagram’s own pages and approve Storyit. You can disconnect an account at any time.' },
  { q: 'Which Instagram accounts work?', a: 'Professional accounts (Business or Creator). Switching a personal account to professional is free in the Instagram app.' },
  { q: 'Will my TikTok posts be public?', a: 'You choose the visibility for each post. While TikTok is still reviewing an app, TikTok itself keeps posts private; Storyit shows this on the account before you post.' },
  { q: 'Can the same video be posted twice by mistake?', a: 'No. A video can go to many accounts, but only once per account. If a publication result is uncertain, Storyit asks you to check instead of reposting.' },
  { q: 'Who writes the captions?', a: 'You, or the AI, account by account. Each account can have its own tone, language and hashtags. Nothing is posted before you approve it.' },
  { q: 'What is the Prompt Studio?', a: `A guided writer for 60-second Fruit Drama videos: 3 story options, a 15-20 scene script with dialogue, then one image prompt and one video prompt per scene, a thumbnail and hashtags. A full project costs ${formatCredits(PROMPT_PROJECT_COST)} credits.` },
  { q: 'What is the Animated Studio?', a: `Describe your idea, choose a story and a decor with the studio, and Storyit produces a finished vertical animated short of 30 seconds, 1 minute or 2 minutes: 3D world, cartoon characters, narration, music and sound. One short costs 3,500 credits (30 s), 6,000 credits (1 min) or 12,000 credits (2 min), refunded if the render fails.` },
  { q: 'Can I cancel anytime?', a: 'Yes, from Plan & credits. You keep access until the end of the paid period.' },
];

export function FAQ() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-20 md:px-6">
      <p className="label text-center">FAQ</p>
      <h2 className="mt-3 text-center font-display text-4xl text-zinc-50">Questions, answered</h2>
      <div className="mt-10 divide-y divide-line/[0.06] rounded-2xl border border-line/[0.06] bg-ink-900">
        {faqs.map(({ q, a }) => (
          <details key={q} className="group px-6 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-zinc-100">
              {q}<ChevronDown className="h-4 w-4 shrink-0 text-zinc-500 transition group-open:rotate-180" />
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
