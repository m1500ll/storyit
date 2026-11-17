import { cn } from '@/lib/cn';
import type { ClipProjectStatus } from '@/types/database';

const styles: Record<ClipProjectStatus, { label: string; cls: string }> = {
  uploading: { label: 'Préparation', cls: 'text-zinc-300 bg-line/5' },
  analyzing: { label: 'IA au travail', cls: 'text-violet-300 bg-violet-500/10 animate-pulse motion-reduce:animate-none' },
  ready: { label: 'Prêt', cls: 'text-emerald-300 bg-emerald-500/10' },
  failed: { label: 'Échec', cls: 'text-coral-300 bg-coral-500/10' },
};

/** AI clipping: status of a clip project. */
export function ClipStatusBadge({ status, className }: { status: ClipProjectStatus; className?: string }) {
  const s = styles[status];
  return <span className={cn('inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium', s.cls, className)}>{s.label}</span>;
}

/** AI virality score (0-100) of a clip. */
export function ScoreBadge({ score, className }: { score: number; className?: string }) {
  const tone = score >= 80 ? 'text-emerald-200 bg-emerald-500/20' : score >= 60 ? 'text-amber-200 bg-amber-500/20' : 'text-zinc-300 bg-line/10';
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums', tone, className)} title="Potentiel viral estimé par l’IA (0 à 100)">
      {score}<span className="font-normal opacity-70">/100</span>
    </span>
  );
}
