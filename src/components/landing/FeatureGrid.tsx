import { Clapperboard, Layers, Lock, ShieldCheck, Sparkles, Zap } from 'lucide-react';

const features = [
  { icon: Sparkles, title: 'Idea → concepts', body: 'Gemini drafts three distinct series concepts from a single sentence. Pick the one that hooks.' },
  { icon: Layers, title: '15-scene breakdown', body: 'Every episode is split into tight, TikTok-paced beats with image and motion prompts.' },
  { icon: Lock, title: 'Character lock', body: 'Characters are defined once and re-used across scenes and episodes for visual consistency.' },
  { icon: Clapperboard, title: 'Production queue', body: 'Scenes render in parallel; failed shots retry for free without blocking the episode.' },
  { icon: ShieldCheck, title: 'Human approval gate', body: 'Nothing publishes without your sign-off. Any edit after approval invalidates it automatically.' },
  { icon: Zap, title: 'Transparent credits', body: 'One Story Credit model for everything. You see the cost before you press render.' },
];

export function FeatureGrid() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-20 md:px-6">
      <p className="label text-center">Built for series, not one-offs</p>
      <h2 className="mt-3 text-center font-display text-4xl text-zinc-50">A full production studio, in a tab</h2>
      <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line/[0.06] bg-line/[0.06] sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, body }) => (
          <div key={title} className="bg-ink-900 p-6">
            <Icon className="h-5 w-5 text-violet-400" />
            <h3 className="mt-4 text-sm font-semibold text-zinc-100">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
