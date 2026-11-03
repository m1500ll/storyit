import { CheckCircle2, Clapperboard, Lightbulb, ListOrdered } from 'lucide-react';

const steps = [
  { icon: Lightbulb, title: 'Drop one idea', body: '“A jealous strawberry and an arrogant lemon.” That’s the whole brief.' },
  { icon: ListOrdered, title: 'Pick a concept', body: 'Gemini pitches three angles — telenovela, reality TV, thriller. You choose.' },
  { icon: Clapperboard, title: 'Render 15 scenes', body: 'Hook, escalation, twist, cliffhanger. Image and motion prompts per shot.' },
  { icon: CheckCircle2, title: 'Approve & publish', body: 'Review every scene, tweak anything, then sign off. Edits re-open review.' },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 md:px-6">
      <p className="label text-center">How it works</p>
      <h2 className="mt-3 text-center font-display text-4xl text-zinc-50">From shower thought to series in four steps</h2>
      <ol className="mt-12 grid gap-4 md:grid-cols-4">
        {steps.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="surface relative p-6">
            <span className="absolute right-5 top-4 font-display text-4xl text-white/[0.06]">{i + 1}</span>
            <Icon className="h-5 w-5 text-coral-400" />
            <h3 className="mt-4 text-sm font-semibold text-zinc-100">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">{body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
