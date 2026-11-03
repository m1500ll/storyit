import { Clapperboard, Clock, Plus, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FirstRun } from '@/components/dashboard/FirstRun';
import { ProjectCard } from '@/components/dashboard/ProjectCard';
import { Button, Card, CardHeader, CreditCard, LoadState, PageHeader } from '@/components/ui';
import { useCredits, useProfile, useStories } from '@/hooks/useStore';

export default function DashboardPage() {
  const { data: stories = [], loading, error } = useStories();
  const { data: profile } = useProfile();
  const { balance } = useCredits();
  const navigate = useNavigate();
  const inProgress = stories.filter((s) => s.status === 'generating').length;
  const toReview = stories.filter((s) => s.status === 'in_review').length;
  const stats = [
    { label: 'Episodes', value: stories.length, icon: Clapperboard },
    { label: 'Rendering', value: inProgress, icon: Clock },
    { label: 'Awaiting review', value: toReview, icon: Sparkles },
  ];

  return (
    <>
      <PageHeader eyebrow="Overview" title={profile?.display_name ? `Good to see you, ${profile.display_name.split(' ')[0]}` : 'Your studio'}
        description="Your series at a glance. Episodes awaiting review need your sign-off before publication."
        actions={<Button onClick={() => navigate('/app/new')}><Plus className="h-4 w-4" /> Create episode</Button>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <div className="grid grid-cols-3 gap-3">
            {stats.map(({ label, value, icon: Icon }) => (
              <Card key={label} className="p-3 sm:p-4">
                <Icon className="h-4 w-4 text-zinc-500" />
                <p className="mt-3 font-display text-3xl text-zinc-50 tabular-nums">{value}</p>
                <p className="truncate text-xs text-zinc-500">{label}</p>
              </Card>
            ))}
          </div>
          <section>
            <CardHeader title="Projects" subtitle="Most recent first" />
            <LoadState loading={loading} error={error} />
            {!loading && stories.length === 0 && <FirstRun balance={balance} />}
            <div className="space-y-3">{stories.map((s) => <ProjectCard key={s.id} story={s} />)}</div>
          </section>
        </div>
        <CreditCard />
      </div>
    </>
  );
}
