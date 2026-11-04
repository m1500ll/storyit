import { Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProjectCard } from '@/components/dashboard/ProjectCard';
import { Button, Card, LoadState, PageHeader } from '@/components/ui';
import { useStories } from '@/hooks/useStore';
import { cn } from '@/lib/cn';
import type { StoryStatus } from '@/types/database';
import { useDebounced } from '@/hooks/useDebounced';

const FILTERS: { id: 'all' | StoryStatus; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'generating', label: 'Rendering' },
  { id: 'in_review', label: 'In review' },
  { id: 'approved', label: 'Approved' },
  { id: 'published', label: 'Published' },
];

export default function EpisodesPage() {
  const { data: stories = [], loading, error } = useStories();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const [query, setQuery] = useState('');
  const q = useDebounced(query);

  const shown = useMemo(() => stories.filter((s) =>
    (filter === 'all' || s.status === filter)
    && (!q || `${s.title} ${s.logline ?? ''} ${s.idea}`.toLowerCase().includes(q.toLowerCase()))), [stories, filter, q]);

  return (
    <>
      <PageHeader eyebrow="Library" title="Episodes" description="Every episode you’ve created, from first draft to published."
        actions={<Link to="/app/new"><Button><Plus className="h-4 w-4" /> New episode</Button></Link>} />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by status">
          {FILTERS.map((f) => {
            const n = f.id === 'all' ? stories.length : stories.filter((s) => s.status === f.id).length;
            return (
              <button key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}
                className={cn('rounded-full border px-3 py-1 text-xs transition', filter === f.id ? 'border-violet-500/40 bg-violet-500/10 text-violet-300' : 'border-line/10 text-zinc-400 hover:text-zinc-200')}>
                {f.label} <span className="tabular-nums opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
        <label className="relative sm:w-64">
          <span className="sr-only">Search episodes</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input className="input py-2 pl-9" placeholder="Search episodes…" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
        </label>
      </div>
      <LoadState loading={loading} error={error} />
      {!loading && shown.length === 0 && (
        <Card className="text-center text-sm text-zinc-500">
          {stories.length === 0 ? <>No episodes yet. <Link to="/app/new" className="text-violet-300">Create your first one →</Link></> : 'No episode matches this filter.'}
        </Card>
      )}
      <div className="space-y-3">{shown.map((s) => <ProjectCard key={s.id} story={s} />)}</div>
    </>
  );
}
