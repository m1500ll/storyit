import { CalendarDays, Copy, History, Layers, MessageSquareText, Sparkles } from 'lucide-react';

const features = [
  { icon: Layers, title: 'Every account in one place', body: 'Connect several TikTok and Instagram accounts and group them, for example “Fruit Drama FR” or “International”.' },
  { icon: CalendarDays, title: 'Simultaneous or rotation', body: 'Post a video everywhere at once, or plan a daily rotation. You see the exact number of posts before you activate it.' },
  { icon: MessageSquareText, title: 'A caption per account', body: 'Each post gets its own caption and hashtags, written by AI or by you. Your edits are never overwritten.' },
  { icon: Copy, title: 'No accidental duplicates', body: 'A video is never sent twice to the same account. If a result is uncertain, Storyit asks you instead of reposting.' },
  { icon: History, title: 'Real status, full history', body: 'A post shows “Published” only when the platform confirms it. Every attempt and error is logged.' },
  { icon: Sparkles, title: 'Prompt Studio', body: 'Get a full 60-second Fruit Drama: 3 story options, a 15-20 scene script, and ready-to-paste image and video prompts. Images can be generated for you.' },
];

export function FeatureGrid() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-20 md:px-6">
      <p className="label text-center">Built for creators with several accounts</p>
      <h2 className="mt-3 text-center font-display text-4xl text-zinc-50">Your posting team, running on a server</h2>
      <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line/[0.06] bg-line/[0.06] sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, body }) => (
          <div key={title} className="bg-ink-900 p-6">
            <Icon className="h-5 w-5 text-violet-400" aria-hidden="true" />
            <h3 className="mt-4 text-sm font-semibold text-zinc-100">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
