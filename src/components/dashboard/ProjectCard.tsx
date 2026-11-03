import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { StoryWithScenes } from '@/types/domain';
import { ProgressBar, StatusBadge } from '../ui';

export function ProjectCard({ story }: { story: StoryWithScenes }) {
  const done = story.scenes.filter((s) => s.status === 'generated').length;
  return (
    <Link to={`/app/stories/${story.id}`} className="surface group flex items-center gap-4 p-4 transition hover:border-white/15">
      <div className="grid aspect-[9/16] w-12 shrink-0 place-items-center rounded-lg bg-gradient-to-b from-coral-500/30 to-violet-600/30 text-xl">🍓</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-medium text-zinc-100">{story.title}</h3>
          <StatusBadge status={story.status} />
        </div>
        <p className="mt-0.5 truncate text-xs text-zinc-500">{story.logline}</p>
        <div className="mt-3 flex items-center gap-3">
          <ProgressBar value={done} max={story.scenes.length} />
          <span className="shrink-0 text-[11px] tabular-nums text-zinc-500">{done}/{story.scenes.length}</span>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-zinc-300" />
    </Link>
  );
}
