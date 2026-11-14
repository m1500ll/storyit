import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CharacterCard } from '@/components/characters/CharacterCard';
import { LoadState } from '@/components/ui';
import { useLiveQuery } from '@/hooks/useStore';
import { characters } from '@/services/characters';
import { LIBRARY, librarySheet, MAX_CAST } from '@shared/characters.ts';

/** Creative Studio step: pick 1 to MAX_CAST characters (the customer's own, then the library). Ids: uuid or 'lib:<slug>'. */
export function CastPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { data: mine = [], loading } = useLiveQuery(() => characters.list(), 'user-characters');
  const ready = mine.filter((c) => c.status === 'ready');
  const library = LIBRARY.filter((c) => c.ready);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : value.length >= MAX_CAST ? value : [...value, id]);
  const full = value.length >= MAX_CAST;
  const items = [
    ...ready.map((c) => ({ id: c.id, name: c.name, role: c.role, image: c.sheet_url })),
    ...library.map((c) => ({ id: `lib:${c.slug}`, name: c.name, role: c.role, image: librarySheet(c.slug) })),
  ];
  if (loading) return <LoadState loading error={null} />;
  return (
    <div>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {items.map((c) => (
          <li key={c.id} className="min-w-0"><CharacterCard c={c} selected={value.includes(c.id)} disabled={full && !value.includes(c.id)} onToggle={() => toggle(c.id)} /></li>
        ))}
        <li className="min-w-0">
          <Link to="/app/characters" className="surface flex aspect-[3/4] h-full min-h-[160px] w-full flex-col items-center justify-center gap-2 p-3 text-center text-xs text-zinc-300 hover:border-violet-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60">
            <Plus className="h-5 w-5 text-violet-300" aria-hidden /> Créer un personnage
          </Link>
        </li>
      </ul>
      <p className="mt-2 text-xs text-zinc-500" aria-live="polite">
        {value.length ? `${value.length} personnage${value.length > 1 ? 's' : ''} choisi${value.length > 1 ? 's' : ''} sur ${MAX_CAST} maximum : l’histoire est écrite pour eux et ils gardent leur apparence exacte.` : items.length ? `Choisissez 1 à ${MAX_CAST} personnages, ou laissez vide pour que le studio les invente pour vous.` : 'Créez vos personnages une fois et réutilisez-les à chaque vidéo. Sinon, le studio les invente pour vous.'}
      </p>
    </div>
  );
}
