import { ArrowRight, Sparkles, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from '@/hooks/useStore';
import { PROMPT_PROJECT_COST, formatCredits } from '@/services/credits';
import { promptStudio } from '@/services/promptStudio';
import { STYLES } from '@shared/promptStudio.ts';

const IDEAS = [
  'Une fraise trahie par sa sœur pastèque le jour de son mariage',
  'Un papa banane cache un secret à ses enfants',
  'Deux pommes rivales héritent du même verger',
];

/** First thing on the dashboard: start a Creative Studio project from an idea, or reopen a recent one. */
export function PromptStudioHero() {
  const navigate = useNavigate();
  const [idea, setIdea] = useState('');
  const { data: projects = [] } = useLiveQuery(() => promptStudio.list(), 'prompt-projects');
  const go = () => navigate(`/app/prompts${idea.trim() ? `?idea=${encodeURIComponent(idea.trim())}` : ''}`);

  return (
    <section aria-labelledby="ps-hero" className="relative mb-8 overflow-hidden rounded-3xl border border-violet-500/25 bg-gradient-to-br from-violet-600/20 via-ink-950 to-coral-500/10 p-5 sm:p-7">
      <div className="flex items-center gap-2 text-xs font-medium text-violet-300"><Wand2 className="h-4 w-4" aria-hidden /> Creative Studio</div>
      <h2 id="ps-hero" className="mt-2 font-display text-3xl leading-tight text-zinc-50 sm:text-4xl">Votre prochain Fruit Drama viral, écrit et créé pour vous</h2>
      <p className="mt-2 max-w-2xl text-sm text-zinc-300">3 histoires au choix, un script de plus d’une minute avec dialogues, tous les prompts, puis la vidéo finale en un clic. {formatCredits(PROMPT_PROJECT_COST)} crédits pour le projet complet.</p>

      <form className="mt-5 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); go(); }}>
        <label htmlFor="hero-idea" className="sr-only">Votre idée d’histoire (facultatif)</label>
        <input id="hero-idea" value={idea} onChange={(e) => setIdea(e.target.value)} maxLength={600} autoComplete="off"
          placeholder="Votre idée (facultatif) : une poire qui ment à sa mère…"
          className="h-12 min-w-0 flex-1 rounded-xl border border-line/15 bg-ink-950/70 px-4 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60" />
        <button type="submit" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
          <Sparkles className="h-4 w-4" aria-hidden /> Écrire mon histoire
        </button>
      </form>
      <p className="mt-5 text-xs text-zinc-400">Ou partez d’un style de personnages</p>
      <ul className="mt-2 grid grid-cols-4 gap-2 sm:gap-3">
        {(Object.keys(STYLES) as (keyof typeof STYLES)[]).map((k) => (
          <li key={k}>
            <Link to={`/app/prompts?style=${k}`} className="group relative block overflow-hidden rounded-2xl border border-line/10 transition hover:border-violet-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60">
              <img src={promptStudio.styleImage(k)} alt="" width={640} height={854} loading="lazy" className="aspect-[4/5] w-full object-cover transition duration-500 group-hover:scale-[1.05]" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <span className="absolute inset-x-0 bottom-0 truncate p-2 text-[11px] font-semibold text-white sm:p-3 sm:text-sm">{STYLES[k].label}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        {IDEAS.map((i) => (
          <button key={i} type="button" onClick={() => setIdea(i)} className="touch-hit rounded-full border border-line/10 bg-line/[0.04] px-3 py-1 text-xs text-zinc-300 hover:border-violet-400/40 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">{i}</button>
        ))}
      </div>

      {projects.length > 0 && (
        <div className="mt-6 border-t border-line/10 pt-4">
          <p className="mb-2 text-xs text-zinc-400">Reprendre un projet</p>
          <ul className="grid gap-2 sm:grid-cols-3">
            {projects.slice(0, 3).map((p) => (
              <li key={p.id}>
                <Link to={`/app/prompts/${p.id}`} className="flex items-center gap-3 rounded-xl bg-line/[0.05] py-2 pl-2 pr-3 text-sm text-zinc-200 hover:bg-line/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
                  <img src={promptStudio.styleImage(p.style)} alt="" width={36} height={48} loading="lazy" className="h-12 w-9 shrink-0 rounded-lg object-cover" />
                  <span className="min-w-0 flex-1"><span className="block truncate">{p.title}</span><span className="block text-[11px] text-zinc-500">Étape {p.phase}/5</span></span>
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
