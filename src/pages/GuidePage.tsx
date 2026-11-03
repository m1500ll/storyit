import { Card, PageHeader } from '@/components/ui';

const TIPS = [
  { title: 'Hook in the first 2 seconds', body: 'Open on conflict or a shocking line, not on context. The concept card’s “hook” is designed for this — keep it as scene 1.' },
  { title: 'Make it longer than one minute', body: 'TikTok only rewards videos over 1 minute. Storyit episodes are ~60–75 s; keep at least 15 scenes or add a longer final scene.' },
  { title: 'End every episode on a cliffhanger', body: 'Cliffhangers bring viewers back for part 2 and push them to follow. Title parts “Partie 1, 2, 3…”.' },
  { title: 'Keep the same characters', body: 'Recurring characters build a fan base. Reuse your cast across episodes — their look stays consistent in every prompt.' },
  { title: 'Post daily, at the same time', body: 'Consistency matters more than perfection. Batch 3–5 storyboards on one day, render and schedule them.' },
  { title: 'Label AI content', body: 'Platforms require AI-generated content to be labelled. Turn on the AI label when you post to stay eligible for rewards.' },
  { title: 'Burned-in captions', body: 'Most viewers watch muted. Storyit’s final MP4 includes captions; you can also export the .srt for CapCut.' },
  { title: 'Watch retention, not just views', body: 'In TikTok analytics, look at average watch time and “watched full video”. If people drop early, tighten scene 1–3.' },
];

export default function GuidePage() {
  return (
    <>
      <PageHeader eyebrow="Grow" title="Creator guide" description="What works for story series on short-form platforms. Practical, no fluff." />
      <div className="grid gap-4 md:grid-cols-2">
        {TIPS.map((t, i) => (
          <Card key={t.title} className="relative">
            <span className="absolute right-5 top-4 font-display text-4xl text-line/[0.08]">{i + 1}</span>
            <h3 className="pr-10 text-sm font-semibold text-zinc-100">{t.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{t.body}</p>
          </Card>
        ))}
      </div>
    </>
  );
}
