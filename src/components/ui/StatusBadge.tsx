import type { SceneStatus, StoryStatus } from '@/types/database';
import { cn } from '@/lib/cn';

const styles: Record<SceneStatus | StoryStatus, { label: string; cls: string }> = {
  pending: { label: 'En attente', cls: 'text-zinc-400 bg-line/5' },
  queued: { label: 'En file', cls: 'text-zinc-300 bg-line/5' },
  generating: { label: 'Génération', cls: 'text-violet-300 bg-violet-500/10 animate-pulse' },
  generated: { label: 'Prêt', cls: 'text-emerald-300 bg-emerald-500/10' },
  failed: { label: 'Échec', cls: 'text-coral-300 bg-coral-500/10' },
  draft: { label: 'Brouillon', cls: 'text-zinc-400 bg-line/5' },
  concept_selected: { label: 'Concept', cls: 'text-zinc-300 bg-line/5' },
  scenes_ready: { label: 'Storyboard', cls: 'text-sky-300 bg-sky-500/10' },
  in_review: { label: 'À relire', cls: 'text-amber-300 bg-amber-500/10' },
  approved: { label: 'Validé', cls: 'text-emerald-300 bg-emerald-500/10' },
  published: { label: 'Publié', cls: 'text-violet-300 bg-violet-500/10' },
};

export function StatusBadge({ status, className }: { status: SceneStatus | StoryStatus; className?: string }) {
  const s = styles[status];
  return <span className={cn('inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium', s.cls, className)}>{s.label}</span>;
}
