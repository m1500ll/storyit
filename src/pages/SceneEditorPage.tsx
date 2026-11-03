import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ApprovalPanel } from '@/components/scenes/ApprovalPanel';
import { SceneCard } from '@/components/scenes/SceneCard';
import { PageHeader, StatusBadge } from '@/components/ui';
import { useStory } from '@/hooks/useStore';
import { productionService } from '@/services/production';
import { storyService } from '@/services/stories';

export default function SceneEditorPage() {
  const { storyId } = useParams();
  const story = useStory(storyId);

  if (!story) return <p className="text-sm text-zinc-500">Story not found. <Link to="/app" className="text-violet-300">Back to dashboard</Link></p>;

  return (
    <>
      <Link to="/app/review" className="mb-4 inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300"><ArrowLeft className="h-3 w-3" /> Review queue</Link>
      <PageHeader eyebrow={`${story.genre} · ${story.aspect_ratio} · Episode ${story.episode_number}`} title={story.title} description={story.logline ?? undefined}
        actions={<StatusBadge status={story.status} className="text-xs" />} />
      <div className="mb-6 flex flex-wrap gap-2">
        {story.characters.map((c) => (
          <span key={c.id} className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400"><span className="text-zinc-200">{c.name}</span> · {c.species}</span>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-3">
          {story.scenes.map((scene) => (
            <SceneCard key={scene.id} scene={scene}
              onSave={(patch) => storyService.updateScene(story.id, scene.id, patch)}
              onRetry={() => productionService.retryScene(story.id, scene)} />
          ))}
        </div>
        <div><ApprovalPanel story={story} onApprove={() => storyService.approve(story.id)} /></div>
      </div>
    </>
  );
}
