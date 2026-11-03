import { ChevronDown } from 'lucide-react';
import { CREDIT_COSTS } from '@/services/credits';

const faqs = [
  { q: 'What is a Story Credit?', a: `One currency for everything: ${CREDIT_COSTS.conceptGeneration} credit to generate concepts, ${CREDIT_COSTS.sceneBreakdown} for a 15-scene breakdown, ${CREDIT_COSTS.sceneRender} per rendered scene. Retrying a failed scene is free.` },
  { q: 'Do unused credits roll over?', a: 'Monthly plan credits reset each billing cycle. Top-up packs never expire.' },
  { q: 'Who owns the videos?', a: 'You do. You can use everything you generate commercially, including on monetised TikTok, Reels and Shorts accounts.' },
  { q: 'Why do I have to approve each episode?', a: 'AI makes mistakes. The approval gate guarantees a human reviewed every scene. If anything changes after approval, it is automatically revoked.' },
  { q: 'Is it only for fruit?', a: 'Fruit Drama is our first format because it performs extremely well. More formats (pets, objects, mini-sitcoms) are on the roadmap.' },
  { q: 'Can I cancel anytime?', a: 'Yes, from Settings → Billing. You keep access until the end of the paid period.' },
];

export function FAQ() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-20 md:px-6">
      <p className="label text-center">FAQ</p>
      <h2 className="mt-3 text-center font-display text-4xl text-zinc-50">Questions, answered</h2>
      <div className="mt-10 divide-y divide-white/[0.06] rounded-2xl border border-white/[0.06] bg-ink-900">
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
