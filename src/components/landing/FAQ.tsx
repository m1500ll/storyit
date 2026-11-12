import { ChevronDown } from 'lucide-react';
import { PROMPT_PROJECT_COST, formatCredits } from '@/services/credits';

export const faqs = [
  { q: 'What is Storyit?', a: 'Storyit is an AI video generator for TikTok, Instagram Reels and YouTube Shorts. It turns a story idea into a finished vertical video: 3D animated true stories, Fruit Drama mini-series, and translations of your existing videos into other languages.' },
  { q: 'How do I make an AI fruit video (Fruit Drama)?', a: `Open the Prompt Studio, pick a character style (fruits, nails, everyday objects or gemstones) and write your story in a few lines, or let the studio propose 3 stories. It writes the hook, a timed script of more than one minute, every image prompt and every animation prompt. Then click "Generate the video": the images are drawn, each clip is animated and the final video is edited for you. A full project costs ${formatCredits(PROMPT_PROJECT_COST)} credits; the finished video is priced by quality and length.` },
  { q: 'How do I make a 3D animated video with AI?', a: 'In the Animated Studio, choose a theme, then click the studio’s proposals: a true story, a decor and a voice. Storyit writes the script, animates the 3D world and the characters, records the narrator and adds the hook title, captions and music. A 30-second video costs 3,500 credits, 1 minute 6,000 credits, 2 minutes 12,000 credits, refunded if the render fails.' },
  { q: 'Can AI videos be monetized on TikTok?', a: 'TikTok’s Creator Rewards Program pays for original videos longer than one minute from eligible accounts, and AI-generated content must be labeled as such when you post. Storyit makes videos of more than one minute built for retention, but earnings depend on your account, your audience and TikTok’s rules: nobody can guarantee them.' },
  { q: 'Which AI models does Storyit use?', a: 'The studios use leading models for each step: ChatGPT for the character and scene images, Grok Imagine for the animation, Claude for the scripts and ElevenLabs for the voices. You don’t need any account or API key with them: everything is included in your credits.' },
  { q: 'Can Storyit translate my videos?', a: 'Yes. Upload a vertical video: Storyit separates the voice from the music, translates every sentence so it fits the same timing, records a new voice in French, English or Spanish and replaces the burned-in captions. It costs 3,500 credits per minute, refunded if the translation fails.' },
  { q: 'Is there a free plan?', a: 'Yes. You get 3,000 free credits when you sign up, no card required: enough for two full Prompt Studio projects. Paid plans start at $29/month with 43,000 credits every month.' },
  { q: 'Do I own the videos I create?', a: 'Yes. You keep all rights to your stories and videos, and you can download them and post them wherever you want.' },
  { q: 'Does Storyit post to TikTok and Instagram for me?', a: 'Direct posting to TikTok and Instagram is temporarily paused while the platforms review it. You download your finished videos and post them yourself in a few seconds.' },
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
