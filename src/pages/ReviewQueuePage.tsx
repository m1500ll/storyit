import { ProjectCard } from '@/components/dashboard/ProjectCard';
import { Card, PageHeader } from '@/components/ui';
import { useStories } from '@/hooks/useStore';

export default function ReviewQueuePage() {
  const stories = useStories();
  const queue = stories.filter((s) => ['in_review', 'generating'].includes(s.status));
  const approved = stories.filter((s) => s.status === 'approved');

  return (
    <>
      <PageHeader eyebrow="Approval" title="Review queue" description="Every episode requires explicit human approval before it can be published." />
      <section className="space-y-3">
        <p className="label">Awaiting approval · {queue.length}</p>
        {queue.length === 0 ? <Card className="text-sm text-zinc-500">Nothing to review. Nice.</Card> : queue.map((s) => <ProjectCard key={s.id} story={s} />)}
      </section>
      {approved.length > 0 && (
        <section className="mt-10 space-y-3">
          <p className="label">Approved · ready to publish</p>
          {approved.map((s) => <ProjectCard key={s.id} story={s} />)}
        </section>
      )}
    </>
  );
}
