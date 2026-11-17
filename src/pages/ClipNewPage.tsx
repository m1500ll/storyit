import { FileVideo, Lock, Sparkles, UploadCloud, X } from 'lucide-react';
import { useEffect, useId, useState, type DragEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePaywall } from '@/components/billing/Paywall';
import { Button, Card, PageHeader } from '@/components/ui';
import { useCredits } from '@/hooks/useStore';
import { cn } from '@/lib/cn';
import { preloadFFmpeg } from '@/lib/ffmpeg';
import { formatDuration, formatSize } from '@/lib/clipFormat';
import { clipCostFor, CREDIT_COSTS, formatCredits } from '@/services/credits';
import { startAnalysis } from '@/services/clipJobs';
import { repository } from '@/services/repository';
import { sourceStore } from '@/services/sourceStore';
import { CLIP_LENGTHS, MAX_SOURCE_SECONDS, type ClipLengthId } from '@/types/clips';

interface Picked { file: File; url: string; duration: number }

/** Reads duration in the browser; also tells us whether the browser can decode the file at all. */
function readDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => (Number.isFinite(v.duration) && v.duration > 0 ? resolve(v.duration) : reject(new Error('unknown duration')));
    v.onerror = () => reject(new Error('unreadable'));
    v.src = url;
  });
}

/** AI clipping: pick a long video, choose the clip length, see the cost, start the analysis. */
export default function ClipNewPage() {
  const navigate = useNavigate();
  const openPaywall = usePaywall();
  const { balance, known } = useCredits();
  const inputId = useId();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [title, setTitle] = useState('');
  const [length, setLength] = useState<ClipLengthId>('medium');
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => () => { if (picked) URL.revokeObjectURL(picked.url); }, [picked]);

  const pick = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith('video/') && !/\.(mp4|mov|m4v|webm|mkv)$/i.test(file.name)) {
      setError('Ce n’est pas un fichier vidéo. Choisissez un MP4, un MOV ou un WebM.');
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const duration = await readDuration(url);
      if (duration > MAX_SOURCE_SECONDS + 30) {
        URL.revokeObjectURL(url);
        setError(`Cette vidéo dure ${formatDuration(duration)}. La limite est de ${MAX_SOURCE_SECONDS / 60} minutes pour l’instant : raccourcissez-la ou coupez-la en plusieurs parties.`);
        return;
      }
      setPicked({ file, url, duration });
      setTitle(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 120));
      preloadFFmpeg();
    } catch {
      URL.revokeObjectURL(url);
      setError('Votre navigateur ne sait pas lire ce fichier. Convertissez-le en MP4 (H.264) et réessayez.');
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void pick(e.dataTransfer.files[0]);
  };

  const cost = picked ? clipCostFor(picked.duration) : 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!picked) return;
    if (known && balance < cost) { openPaywall({ required: cost }); return; }
    setSubmitting(true);
    setError(null);
    try {
      const project = await repository.createClipProject({
        title: title.trim() || picked.file.name, sourceName: picked.file.name, sourceSize: picked.file.size,
        duration: picked.duration, clipLength: length,
      });
      await sourceStore.put(project.id, picked.file);
      startAnalysis(project.id, picked.file, picked.duration);
      navigate(`/app/clips/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de créer le projet.');
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Clips IA" title="Transforme une vidéo en clips"
        description="Ajoute une longue vidéo : l’IA trouve les meilleurs moments et en fait des clips verticaux avec un titre et des sous-titres." />

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          {!picked ? (
            <label htmlFor={inputId}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}
              className={cn('flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-16 text-center transition-colors focus-within:ring-2 focus-within:ring-violet-500/50',
                dragging ? 'border-violet-400 bg-violet-500/10' : 'border-line/15 bg-ink-900 hover:border-violet-500/40 hover:bg-line/[0.02]')}>
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-violet-500/15 text-violet-300"><UploadCloud className="h-6 w-6" /></span>
              <span className="text-base font-medium text-zinc-100">Dépose ta vidéo ici, ou clique pour la choisir</span>
              <span className="text-xs text-zinc-500">MP4, MOV ou WebM · jusqu’à {MAX_SOURCE_SECONDS / 60} minutes · podcasts, interviews, vlogs, lives, conférences</span>
              <input id={inputId} type="file" accept="video/*,.mkv" className="sr-only" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          ) : (
            <Card className="flex flex-col gap-4 sm:flex-row">
              <video src={picked.url} muted playsInline preload="metadata" className="aspect-video w-full rounded-xl bg-black object-contain sm:w-56" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-zinc-100"><FileVideo className="h-4 w-4 shrink-0 text-violet-300" /><span className="truncate">{picked.file.name}</span></p>
                  <button type="button" onClick={() => setPicked(null)} aria-label="Choisir une autre vidéo"
                    className="touch-hit rounded-lg p-1 text-zinc-500 transition-colors hover:bg-line/5 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"><X className="h-4 w-4" /></button>
                </div>
                <p className="mt-1 text-xs tabular-nums text-zinc-500">{formatDuration(picked.duration)} · {formatSize(picked.file.size)}</p>
                <label htmlFor="title" className="label mt-4 block">Nom du projet</label>
                <input id="title" name="title" className="input mt-2" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Mon podcast, épisode 12…" autoComplete="off" />
              </div>
            </Card>
          )}

          <fieldset>
            <legend className="label mb-3">Durée des clips</legend>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(CLIP_LENGTHS) as ClipLengthId[]).map((k) => (
                <label key={k} className={cn('cursor-pointer rounded-xl border px-3 py-3 text-center text-sm transition-colors focus-within:ring-2 focus-within:ring-violet-500/50',
                  length === k ? 'border-violet-500/50 bg-violet-500/10 text-zinc-100' : 'border-line/10 text-zinc-400 hover:text-zinc-200')}>
                  <input type="radio" name="length" value={k} checked={length === k} onChange={() => setLength(k)} className="sr-only" />
                  <span className="block font-medium tabular-nums">{CLIP_LENGTHS[k].label}</span>
                  <span className="text-[11px] text-zinc-500">{k === 'short' ? 'Percutant' : k === 'medium' ? 'Recommandé' : 'Pour raconter'}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <p className="flex items-start gap-2 text-xs text-zinc-500"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Ta vidéo reste sur ton appareil : le découpage et les sous-titres se font dans ton navigateur. Seul le son est envoyé à l’IA, puis supprimé.</p>
        </div>

        <aside>
          <Card className="lg:sticky lg:top-24">
            <p className="label">Ce que tu obtiens</p>
            <ul className="mt-3 space-y-2 text-sm text-zinc-400">
              {['Jusqu’à 8 meilleurs moments, classés par potentiel viral', 'Un titre accrocheur pour chaque clip', 'Des sous-titres mot à mot, en 3 styles', 'Des MP4 verticaux 9:16 : retouches et exports gratuits'].map((t) => (
                <li key={t} className="flex gap-2"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-300" />{t}</li>
              ))}
            </ul>
            <div className="mt-5 border-t border-line/5 pt-4 text-sm">
              <div className="flex justify-between gap-3 text-zinc-400"><span>Prix</span><span className="text-right tabular-nums text-zinc-100">{picked ? `${formatCredits(cost)} crédits` : `${CREDIT_COSTS.clipMinute} crédits par minute de vidéo`}</span></div>
              <div className="mt-1 flex justify-between text-zinc-500"><span>Ton solde</span><span className="tabular-nums">{known ? `${formatCredits(balance)} crédits` : '…'}</span></div>
            </div>
            <Button type="submit" size="lg" className="mt-5 w-full" disabled={!picked} loading={submitting}>
              {picked ? `Trouver les meilleurs moments · ${formatCredits(cost)} crédits` : 'Choisis d’abord une vidéo'}
            </Button>
            <p className="mt-2 text-center text-[11px] text-zinc-500">Débité seulement si des clips sont trouvés.</p>
            {error && <p className="mt-3 rounded-lg bg-coral-500/10 px-3 py-2 text-xs text-coral-300" aria-live="polite">{error}</p>}
          </Card>
        </aside>
      </form>
    </>
  );
}
