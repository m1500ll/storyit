import { ArrowRight, Sparkles, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from '@/hooks/useStore';
import { PROMPT_PROJECT_COST } from '@/services/credits';
import { promptStudio } from '@/services/promptStudio';

const IDEAS = [
  'A strawberry betrayed by her watermelon sister on her wedding day',
  'A banana dad hides a secret from his kids',
  'Two rival apples inherit the same orchard',
];

/** First thing on the dashboard: start a Prompt Studio project from an idea, or reopen a recent one. */
export function PromptStudioHero() {
  const navigate = useNavigate();
  const [idea, setIdea] = useState('');
  const { data: projects = [] } = useLiveQuery(() => promptStudio.list(), 'prompt-projects');
  const go = () => navigate(`/app/prompts${idea.trim() ? `?idea=${encodeURIComponent(idea.trim())}` : ''}`);

  return (
    <section aria-labelledby="ps-hero" className="relative mb-8 overflow-hidden rounded-3xl border border-violet-500/25 bg-gradient-to-br from-violet-600/20 via-ink-950 to-coral-500/10 p-5 sm:p-7">
      <div className="flex items-center gap-2 text-xs font-medium text-violet-300"><Wand2 className="h-4 w-4" aria-hidden /> Prompt Studio</div>
      <h2 id="ps-hero" className="mt-2 font-display text-3xl leading-tight text-zinc-50 sm:text-4xl">Your next viral Fruit Drama, written for you</h2>
      <p className="mt-2 max-w-2xl text-sm text-zinc-300">3 story options, a 60-second script with dialogue, then every image and video prompt ready to paste. {PROMPT_PROJECT_COST} credits for the whole project. Subscribers can also generate every scene image in one click.</p>

      <form className="mt-5 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); go(); }}>
        <label htmlFor="hero-idea" className="sr-only">Your story idea (optional)</label>
        <input id="hero-idea" value={idea} onChange={(e) => setIdea(e.target.value)} maxLength={600} autoComplete="off"
          placeholder="Your idea (optional): a pear who lies to her mother…"
          className="h-12 min-w-0 flex-1 rounded-xl border border-line/15 bg-ink-950/70 px-4 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60" />
        <button type="submit" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
          <Sparkles className="h-4 w-4" aria-hidden /> Write my story
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {IDEAS.map((i) => (
          <button key={i} type="button" onClick={() => setIdea(i)} className="rounded-full border border-line/10 bg-line/[0.04] px-3 py-1 text-xs text-zinc-300 hover:border-violet-400/40 hover:text-zinc-100">{i}</button>
        ))}
      </div>

      {projects.length > 0 && (
        <div className="mt-6 border-t border-line/10 pt-4">
          <p className="mb-2 text-xs text-zinc-400">Continue a project</p>
          <ul className="grid gap-2 sm:grid-cols-3">
            {projects.slice(0, 3).map((p) => (
              <li key={p.id}>
                <Link to={`/app/prompts/${p.id}`} className="flex items-center gap-2 rounded-xl bg-line/[0.05] px-3 py-2.5 text-sm text-zinc-200 hover:bg-line/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
                  <span className="min-w-0 flex-1"><span className="block truncate">{p.title}</span><span className="block text-[11px] text-zinc-500">Step {p.phase}/5</span></span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
