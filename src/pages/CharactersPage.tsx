import { Link } from 'react-router-dom';
import { Card, FruitArt, fruitFromSpecies, LoadState, PageHeader } from '@/components/ui';
import { useStories } from '@/hooks/useStore';

/** Character library: every cast member across episodes, merged by name + species. */
export default function CharactersPage() {
  const { data: stories = [], loading, error } = useStories();
  const cast = new Map<string, { name: string; species: string; personality: string; visual: string; episodes: { id: string; title: string }[] }>();
  for (const s of stories) {
    for (const c of s.characters) {
      const key = `${c.name.toLowerCase()}|${c.species.toLowerCase()}`;
      const entry = cast.get(key) ?? { name: c.name, species: c.species, personality: c.personality, visual: c.visual_description, episodes: [] };
      entry.episodes.push({ id: s.id, title: s.title });
      cast.set(key, entry);
    }
  }
  const list = [...cast.values()].sort((a, b) => b.episodes.length - a.episodes.length);

  return (
    <>
      <PageHeader eyebrow="Library" title="Characters"
        description="Recurring characters are what turn single videos into a series viewers follow. Their visual description is reused in every prompt for consistency." />
      <LoadState loading={loading} error={error} />
      {!loading && list.length === 0 && <Card className="text-center text-sm text-zinc-500">Characters appear here once you create an episode. <Link to="/app/new" className="text-violet-300">Create one →</Link></Card>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((c) => (
          <Card key={`${c.name}-${c.species}`} className="flex flex-col">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 shrink-0 rounded-2xl bg-ink-850 p-1"><FruitArt fruit={fruitFromSpecies(c.species)} /></div>
              <div className="min-w-0">
                <p className="truncate font-display text-2xl text-zinc-50">{c.name}</p>
                <p className="text-xs text-violet-300">{c.species}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-zinc-400">{c.personality}</p>
            <p className="mt-2 rounded-lg bg-ink-850 p-2.5 font-mono text-[11px] leading-relaxed text-zinc-500">{c.visual}</p>
            <p className="label mb-1.5 mt-4 text-[11px]">Appears in {c.episodes.length} episode{c.episodes.length > 1 ? 's' : ''}</p>
            <ul className="space-y-1">
              {c.episodes.slice(0, 4).map((e) => <li key={e.id}><Link to={`/app/stories/${e.id}`} className="text-xs text-zinc-300 hover:text-violet-300">{e.title}</Link></li>)}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
