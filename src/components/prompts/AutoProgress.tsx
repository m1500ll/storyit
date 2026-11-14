import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/cn';
import { store } from '@/services/store';
import { AutoVideo } from './AutoVideo';

const STEPS: { key: string; label: string }[] = [
  { key: 'script', label: 'Histoire et dialogues' },
  { key: 'review', label: 'Relecture du script' },
  { key: 'images', label: 'Personnages et scènes' },
  { key: 'videos', label: 'Mise en scène et voix' },
  { key: 'pack', label: 'Couverture et légende' },
  { key: 'order', label: 'Lancement de la vidéo' },
];

/** The wizard's automatic pipeline: where the project is, then the video's own progress (dessin, animation, montage). */
export function AutoProgress({ projectId, data }: { projectId: string; data: any }) {
  const auto = data.auto as { status: string; step: string; error?: string };
  // the server moves on by itself: refresh the project every few seconds until the video is ordered
  useEffect(() => {
    if (auto.status !== 'running') return;
    const t = setInterval(() => store.notify(), 6000);
    return () => clearInterval(t);
  }, [auto.status]);
  const at = STEPS.findIndex((s) => s.key === auto.step);

  if (auto.status === 'video') return (
    <div>
      <p className="mb-3 flex items-center gap-2 text-sm text-emerald-300"><Check className="h-4 w-4" aria-hidden /> Histoire et scènes prêtes : la vidéo est en fabrication. Elle arrivera dans votre bibliothèque, vous pouvez quitter la page.</p>
      <AutoVideo projectId={projectId} data={data} />
    </div>
  );
  return (
    <Card role="status" aria-live="polite">
      {auto.status === 'failed' ? (
        <p className="flex items-start gap-2 text-sm text-coral-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{auto.error ?? 'La création automatique s’est arrêtée.'}</p>
      ) : (
        <>
          <p className="text-sm font-semibold text-zinc-100">Votre vidéo se crée toute seule</p>
          <p className="mt-1 text-xs text-zinc-500">Environ 5 à 10 minutes en tout. Vous pouvez quitter la page : tout continue sur nos serveurs.</p>
        </>
      )}
      <ol className="mt-4 space-y-2">
        {STEPS.filter((s) => s.key !== 'review' || auto.step === 'review' || data.script_reviewed === false).map((s) => {
          const i = STEPS.indexOf(s);
          const done = i < at || (auto.status !== 'running' && auto.status !== 'failed');
          const now = i === at && auto.status === 'running';
          return (
            <li key={s.key} className={cn('flex items-center gap-2 text-sm', done ? 'text-zinc-300' : now ? 'text-zinc-100' : 'text-zinc-600')}>
              <span className={cn('grid h-6 w-6 place-items-center rounded-full', done ? 'bg-emerald-500/15 text-emerald-300' : now ? 'bg-violet-500/15 text-violet-300' : 'bg-line/5')}>
                {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : now ? <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden /> : <span className="text-[11px] tabular-nums">{i + 1}</span>}
              </span>
              {s.label}{now ? '…' : ''}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
