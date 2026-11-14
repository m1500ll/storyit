import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export type CardCharacter = { id: string; name: string; role: string; personality?: string; image: string | null; status?: 'generating' | 'ready' | 'failed'; error?: string | null };

/** One character: its sheet (cropped on the front view), name and role. Selectable when `onToggle` is given. */
export function CharacterCard({ c, selected, onToggle, onOpen, disabled }: { c: CardCharacter; selected?: boolean; onToggle?: () => void; onOpen?: () => void; disabled?: boolean }) {
  const ready = (c.status ?? 'ready') === 'ready';
  const inner = (
    <>
      <span className="relative block aspect-[3/4] overflow-hidden rounded-xl bg-line/[0.04]">
        {c.image && ready ? (
          <img src={c.image} alt="" loading="lazy" width={300} height={400} className="absolute inset-0 h-full w-full object-cover object-[12%_0%] [transform:scale(1.9)] [transform-origin:12%_0%]" />
        ) : c.status === 'failed' ? (
          <span className="absolute inset-0 grid place-items-center p-3 text-center text-[11px] text-coral-300"><span><AlertTriangle className="mx-auto mb-1 h-5 w-5" aria-hidden />{c.error ?? 'Échec'}</span></span>
        ) : (
          <span className="absolute inset-0 grid place-items-center text-center text-[11px] text-zinc-400"><span><Loader2 className="mx-auto mb-1 h-5 w-5 animate-spin text-violet-300 motion-reduce:animate-none" aria-hidden />Dessin en cours…<br />1 à 2 min</span></span>
        )}
        {selected && <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-violet-600 text-white"><Check className="h-3.5 w-3.5" aria-hidden /></span>}
      </span>
      <span className="mt-2 block truncate text-sm font-semibold text-zinc-100">{c.name}</span>
      <span className="block truncate text-[11px] text-zinc-400">{c.role}</span>
    </>
  );
  const cls = cn('surface block w-full min-w-0 p-2 text-left transition [touch-action:manipulation] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60',
    selected ? 'border-violet-500 ring-2 ring-violet-500/40' : 'hover:border-violet-400/40', (disabled || !ready) && onToggle && 'opacity-60');
  if (onToggle) return <button type="button" aria-pressed={!!selected} disabled={disabled || !ready} onClick={onToggle} className={cls}>{inner}</button>;
  if (onOpen && ready) return <button type="button" onClick={onOpen} className={cls} aria-label={`Voir la planche de ${c.name}`}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}
