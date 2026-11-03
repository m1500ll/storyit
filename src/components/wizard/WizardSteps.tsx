import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export function WizardSteps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="mb-10 flex items-center gap-3">
      {steps.map((label, i) => (
        <li key={label} className="flex items-center gap-3">
          <span className={cn(
            'grid h-7 w-7 place-items-center rounded-full border text-xs font-semibold',
            i < current && 'border-violet-500 bg-violet-500 text-white',
            i === current && 'border-violet-400 text-violet-300',
            i > current && 'border-line/10 text-zinc-600',
          )}>{i < current ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
          <span className={cn('hidden text-sm sm:inline', i === current ? 'text-zinc-100' : 'text-zinc-500')}>{label}</span>
          {i < steps.length - 1 && <span className="h-px w-8 bg-line/10" />}
        </li>
      ))}
    </ol>
  );
}
