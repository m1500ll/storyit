import { Flame, Repeat2, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { useLiveQuery } from '@/hooks/useStore';
import { cn } from '@/lib/cn';
import { trends, type TrendConcept } from '@/services/trends';

const STATUS: Record<string, { label: string; cls: string }> = {
  green: { label: '🟢 Aucune version FR', cls: 'bg-emerald-500/15 text-emerald-300' },
  orange: { label: '🟠 1 version FR', cls: 'bg-amber-500/15 text-amber-300' },
  red: { label: '🔴 Déjà copié en FR', cls: 'bg-coral-500/15 text-coral-300' },
};
const FILTERS = [
  { key: 'best', label: 'Les meilleures à tourner' },
  { key: 'hit', label: 'Vrais hits' },
  { key: 'variant', label: 'Variantes' },
] as const;

/** "Idées du moment": the concepts of the latest trend report; a click prefills the story. */
export function TrendIdeas({ onUse }: { onUse: (c: TrendConcept) => void }) {
  const { data } = useLiveQuery(() => trends.latest(), 'trends:latest');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('best');
  const [more, setMore] = useState(false);
  if (!data?.concepts.length) return null;
  // the best to shoot: no French version yet first, then variants (fresh), then hits already copied
  const rank = (c: TrendConcept) => (c.fr_status === 'green' ? 0 : c.kind === 'variant' ? 1 : c.fr_status === 'orange' ? 2 : 3);
  const list = (filter === 'best' ? [...data.concepts].sort((a, b) => rank(a) - rank(b) || a.number - b.number) : data.concepts.filter((c) => c.kind === filter));
  const shown = more ? list : list.slice(0, 9);
  return (
    <section aria-labelledby="ideas" className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="ideas" className="flex items-center gap-2 text-sm font-semibold text-zinc-100"><Flame className="h-4 w-4 text-coral-300" aria-hidden /> Idées du moment</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Veille du {new Date(data.day).toLocaleDateString('fr-FR')} : ce qui cartonne en ce moment. Choisissez une idée, elle remplit votre histoire.</p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrer les idées">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
              className={cn('rounded-full border px-3 py-1.5 text-xs', filter === f.key ? 'border-violet-600 bg-violet-600 text-white' : 'border-line/10 text-zinc-300 hover:bg-line/[0.05]')}>{f.label}</button>
          ))}
        </div>
      </div>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((c) => (
          <li key={c.id} className="surface flex flex-col rounded-2xl p-4">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="font-semibold text-zinc-500">#{c.number}</span>
              <span className={cn('rounded-full px-2 py-0.5', c.kind === 'hit' ? 'bg-violet-500/15 text-violet-200' : 'bg-line/[0.08] text-zinc-400')}>{c.kind === 'hit' ? 'Vrai hit' : 'Variante non testée'}</span>
              {c.fr_status && <span className={cn('rounded-full px-2 py-0.5', STATUS[c.fr_status]!.cls)}>{STATUS[c.fr_status]!.label}</span>}
            </div>
            <p className="mt-2 text-sm font-semibold text-zinc-100">{c.title}</p>
            {c.stats && <p className="mt-0.5 line-clamp-1 text-[11px] text-zinc-500">{c.stats}</p>}
            {c.hook && <p className="mt-2 line-clamp-3 text-xs text-zinc-300">{c.hook.split('\n')[0]}</p>}
            {c.repeat_line && <p className="mt-2 flex gap-1.5 text-[11px] text-zinc-400"><Repeat2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-300" aria-hidden />{c.repeat_line}</p>}
            {c.screen_line && <p className="mt-1 flex gap-1.5 text-[11px] text-zinc-400"><MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-300" aria-hidden />{c.screen_line}</p>}
            <button type="button" onClick={() => onUse(c)}
              className="mt-auto pt-3 text-left text-xs font-medium text-violet-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">Utiliser cette idée →</button>
          </li>
        ))}
      </ul>
      {list.length > 9 && (
        <button type="button" onClick={() => setMore(!more)} className="mt-3 text-xs text-violet-300 hover:underline">{more ? 'Voir moins' : `Voir les ${list.length} idées`}</button>
      )}
    </section>
  );
}
