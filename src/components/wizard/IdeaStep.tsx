import { Sparkles } from 'lucide-react';
import { CREDIT_COSTS } from '@/services/credits';
import { Button, Card } from '../ui';

const examples = [
  'A lovers\' quarrel between a jealous strawberry and an arrogant lemon',
  'A banana CEO discovers the avocado intern is plotting a takeover',
  'Two rival grapes compete on a fruit bowl dating show',
];

interface Props { idea: string; onChange: (v: string) => void; onSubmit: () => void; loading: boolean }

export function IdeaStep({ idea, onChange, onSubmit, loading }: Props) {
  return (
    <Card className="p-6 md:p-8">
      <label htmlFor="idea" className="label">Your idea</label>
      <textarea id="idea" rows={4} className="input mt-3 resize-none text-base" value={idea} onChange={(e) => onChange(e.target.value)} autoComplete="off" name="idea"
        placeholder="e.g. A shy watermelon falls for a pineapple TV star…" maxLength={400} />
      <div className="mt-3 flex flex-wrap gap-2">
        {examples.map((ex) => (
          <button key={ex} onClick={() => onChange(ex)} className="rounded-full border border-line/10 px-3 py-1 text-xs text-zinc-400 hover:border-violet-500/40 hover:text-zinc-200">{ex}</button>
        ))}
      </div>
      <div className="mt-8 flex items-center justify-between">
        <span className="text-xs text-zinc-500">{idea.trim().length < 10 ? 'Write at least a short sentence' : `Costs ${CREDIT_COSTS.conceptGeneration} credit`}</span>
        <Button onClick={onSubmit} loading={loading} disabled={idea.trim().length < 10}><Sparkles className="h-4 w-4" /> Generate concepts</Button>
      </div>
    </Card>
  );
}
