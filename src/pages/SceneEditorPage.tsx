import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApprovalPanel } from '@/components/scenes/ApprovalPanel';
import { ExportPanel } from '@/components/scenes/ExportPanel';
import { SceneCard } from '@/components/scenes/SceneCard';
import { LoadState, PageHeader, StatusBadge } from '@/components/ui';
import { useStory } from '@/hooks/useStore';
import { approvalService, productionService } from '@/services/production';
import { repository } from '@/services/repository';

export default function SceneEditorPage() {
  const { storyId } = useParams();
  const { data: story, loading, error } = useStory(storyId);
  const [actionError, setActionError] = useState<string | null>(null);

  const act = (fn: () => Promise<unknown>) => {
    setActionError(null);
    fn().catch((e: unknown) => setActionError(e instanceof Error ? e.message : String(e)));
  };

  if (!story) {
    return loading || error
      ? <LoadState loading={loading} error={error} />
      : <p className="text-sm text-zinc-500">Story not found. <Link to="/app" className="text-violet-300">Back to dashboard</Link></p>;
  }

  return (
    <>
      <Link to="/app/review" className="mb-4 inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300"><ArrowLeft className="h-3 w-3" /> Review queue</Link>
      <PageHeader eyebrow={`${story.genre} · ${story.aspect_ratio} · Episode ${story.episode_number}`} title={story.title} description={story.logline ?? undefined}
        actions={<StatusBadge status={story.status} className="text-xs" />} />
      {actionError && <div className="mb-4"><LoadState loading={false} error={actionError} /></div>}
      <div className="mb-6 flex flex-wrap gap-2">
        {story.characters.map((c) => (
          <span key={c.id} className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400"><span className="text-zinc-200">{c.name}</span> · {c.species}</span>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-3">
          {story.scenes.map((scene) => (
            <SceneCard key={scene.id} scene={scene} species={story.characters[(scene.position - 1) % Math.max(story.characters.length, 1)]?.species}
              onSave={(patch) => act(() => repository.updateScene(story.id, scene.id, patch))}
              onRetry={() => act(() => productionService.retryScene(story.id, scene))} />
          ))}
        </div>
        <div className="lg:sticky lg:top-24 lg:self-start"><ApprovalPanel story={story} onApprove={() => act(() => approvalService.approve(story.id))} /><ExportPanel story={story} /></div>
      </div>
    </>
  );
}
