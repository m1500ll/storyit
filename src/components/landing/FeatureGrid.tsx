import { Captions, Clapperboard, Languages, Sparkles, TrendingUp, Wand2 } from 'lucide-react';

const features = [
  { icon: Clapperboard, title: 'AI 3D animated videos', body: 'True stories told by a narrator in a 3D world with cartoon characters, music and sound effects. 30 seconds, 1 minute or 2 minutes.' },
  { icon: Sparkles, title: 'Fruit Drama generator', body: 'Mini-dramas with fruit, nail, object or gemstone characters: the format that explodes on TikTok, written for retention and comments.' },
  { icon: Wand2, title: 'Fully automatic videos', body: 'ChatGPT draws the characters and scenes, Grok animates every clip, and the video is edited for you. Pick the quality and see the price first.' },
  { icon: TrendingUp, title: 'Trending ideas every day', body: 'Fresh concepts from what works right now on TikTok, with the hook, the outline and the ending, ready to turn into your video.' },
  { icon: Languages, title: 'AI video translation', body: 'The same video in French, English or Spanish: new voice, original music kept, captions replaced. Reach new countries with one click.' },
  { icon: Captions, title: 'Hook title & captions', body: 'A bold hook title for the first seconds and word-by-word captions, the two things that keep viewers watching.' },
];

export function FeatureGrid() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-20 md:px-6">
      <p className="label text-center">Everything you need to go viral</p>
      <h2 className="mt-3 text-center font-display text-4xl text-zinc-50">An AI video studio in your browser</h2>
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
