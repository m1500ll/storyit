import { cn } from '@/lib/cn';
import { CREDIT_COSTS, formatCredits } from '@/services/credits';
import type { StoryConcept } from '@/types/domain';
import { Button } from '../ui';

interface Props {
  concepts: StoryConcept[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  loading: boolean;
}

export function ConceptStep({ concepts, selectedId, onSelect, onBack, onSubmit, loading }: Props) {
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        {concepts.map((c) => (
          <button key={c.id} onClick={() => onSelect(c.id)}
            className={cn('surface p-5 text-left transition hover:border-line/15', selectedId === c.id && 'border-violet-500/60 shadow-glow')}>
            <p className="label">{c.tone}</p>
            <h3 className="mt-2 font-display text-2xl text-zinc-50">{c.title}</h3>
            <p className="mt-2 text-sm text-zinc-400">{c.logline}</p>
            <p className="mt-4 text-xs italic text-coral-300">Hook: {c.hook}</p>
            <div className="mt-4 space-y-1 border-t border-line/5 pt-3">
              {c.characters.map((ch) => (
                <p key={ch.name} className="text-xs text-zinc-500"><span className="text-zinc-300">{ch.name}</span> · {ch.species} — {ch.personality}</p>
              ))}
            </div>
          </button>
        ))}
      </div>
      <div className="mt-8 flex justify-between">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <Button onClick={onSubmit} disabled={!selectedId} loading={loading}>Break into 15 scenes · {formatCredits(CREDIT_COSTS.sceneBreakdown)} credits</Button>
      </div>
    </div>
  );
}
