import { AlertTriangle, Check, Clapperboard, Download, Loader2, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePaywall } from '@/components/billing/Paywall';
import { Button, Card } from '@/components/ui';
import { cn } from '@/lib/cn';
import { InsufficientCreditsError } from '@/services/errors';
import { promptVideos, type PromptVideo, type VideoQuality } from '@/services/promptVideos';
import { lengthLabel, lengthOf, projectSeconds, VIDEO_PRICES, videoBlocker, videoCost, type VideoLength } from '@shared/promptVideo.ts';
import { promptStudio } from '@/services/promptStudio';
import { LengthPicker } from './LengthPicker';
import { formatCredits } from '@/services/credits';

const QUALITIES: { key: VideoQuality; label: string; detail: string }[] = [
  { key: 'eco', label: 'Éco', detail: '480p · idéal pour tester une histoire' },
  { key: 'standard', label: 'Standard', detail: '720p · le bon choix pour publier' },
  { key: 'premium', label: 'Premium', detail: '720p · animation et images plus fines' },
];
const STEPS: Record<string, string> = {
  start: 'Démarrage…', sheet: 'Dessin de la planche des personnages…', images: 'Dessin des images de chaque clip…',
  animation: 'Animation des clips avec Grok…', montage: 'Montage de la vidéo…', library: 'Ajout à votre bibliothèque…',
};
const active = (v: PromptVideo) => v.status === 'queued' || v.status === 'working';

/** "Générer la vidéo": the whole project becomes a finished video (images, animation, montage), added to the library */
export function AutoVideo({ projectId, data }: { projectId: string; data: unknown }) {
  const openPaywall = usePaywall();
  const [quality, setQuality] = useState<VideoQuality>('standard');
  const [videos, setVideos] = useState<PromptVideo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const seconds = projectSeconds(data);
  const current: VideoLength = lengthOf(seconds || 45);
  const [target, setTarget] = useState<VideoLength>(current);
  const [rewriting, setRewriting] = useState<string | null>(null);
  useEffect(() => { setTarget(current); }, [current]);
  /** another length: the script, the image prompts and the Grok prompts are written again for it (no credits) */
  const rewrite = async () => {
    setError(null);
    try {
      setRewriting('Réécriture de l’histoire pour ' + lengthLabel(target) + '…');
      await promptStudio.generate({ phase: 'script', project_id: projectId, length: target });
      setRewriting('Prompts des images…');
      await promptStudio.generate({ phase: 'images', project_id: projectId });
      setRewriting('Prompts d’animation…');
      await promptStudio.generate({ phase: 'videos', project_id: projectId });
    } catch (e) { setError(e instanceof Error ? e.message : 'La réécriture a échoué. Réessayez.'); }
    finally { setRewriting(null); }
  };
  const blocker = videoBlocker(data);
  const last = videos[0];
  const running = videos.some(active);

  const load = useCallback(() => { promptVideos.list(projectId).then(setVideos).catch(() => undefined); }, [projectId]);
  useEffect(() => { load(); return promptVideos.watch(load); }, [load]);
  useEffect(() => { // fallback when the live connection drops
    if (!running) return;
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [running, load]);
  useEffect(() => {
    setUrl(null);
    if (last?.status === 'done') promptVideos.url(last.id).then(setUrl).catch(() => undefined);
  }, [last?.id, last?.status]);

  const start = async () => {
    setBusy(true); setError(null);
    try { const v = await promptVideos.create(projectId, quality); setVideos((vs) => [v, ...vs]); }
    catch (e) {
      if (e instanceof InsufficientCreditsError) openPaywall();
      setError(e instanceof Error ? e.message : 'Impossible de lancer la vidéo.');
    } finally { setBusy(false); }
  };
  const download = async () => {
    if (!last) return;
    const link = await promptVideos.url(last.id, `${(last.title ?? 'video').replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 60) || 'video'}.mp4`).catch(() => null);
    if (link) window.location.href = link;
  };

  return (
    <Card className="mb-6 border-violet-500/30">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-300"><Clapperboard className="h-5 w-5" aria-hidden /></span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-zinc-100">Générer la vidéo automatiquement</h2>
          <p className="mt-0.5 text-sm text-zinc-400">On dessine les images, on anime chaque clip et on monte la vidéo finale. Elle arrive dans votre bibliothèque, prête à publier.</p>
        </div>
      </div>

      {last && active(last) ? (
        <div className="mt-4" aria-live="polite">
          <div className="flex items-center justify-between text-sm text-zinc-200">
            <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-violet-300" aria-hidden />{last.status === 'queued' ? 'En file d’attente…' : STEPS[last.step ?? 'start'] ?? 'En cours…'}</span>
            <span className="tabular-nums text-zinc-400">{last.progress} %</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line/10" role="progressbar" aria-valuenow={last.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Avancement de la vidéo">
            <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${Math.max(3, last.progress)}%` }} />
          </div>
          <p className="mt-2 text-xs text-zinc-500">Comptez 10 à 20 minutes. Vous pouvez fermer cette page : la vidéo continue et arrivera dans votre bibliothèque.</p>
        </div>
      ) : (
        <>
          {last?.status === 'done' && (
            <div className="mt-4 grid gap-4 sm:grid-cols-[180px_1fr] sm:items-start">
              {url ? <video src={url} controls playsInline className="aspect-[9/16] w-full max-w-[220px] rounded-xl bg-black" /> : <div className="aspect-[9/16] w-full max-w-[220px] animate-pulse rounded-xl bg-line/10" />}
              <div>
                <p className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-300"><Check className="h-4 w-4" aria-hidden /> Votre vidéo est prête</p>
                <p className="mt-1 text-sm text-zinc-400">Elle est aussi dans votre bibliothèque. Regardez-la avant de la publier.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button onClick={() => void download()}><Download className="h-4 w-4" /> Télécharger</Button>
                  <Link to="/app/library" className="touch-hit inline-flex h-10 items-center rounded-xl px-3 text-sm text-violet-300 hover:bg-line/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">Ouvrir la bibliothèque</Link>
                </div>
              </div>
            </div>
          )}
          {last?.status === 'failed' && (
            <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-coral-500/30 bg-coral-500/10 px-3 py-2.5 text-sm text-coral-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{last.error ?? 'La vidéo n’a pas pu être créée. Vos crédits ont été rendus.'}
            </p>
          )}

          {!blocker && (
            <div className="mt-4">
              <p className="text-xs text-zinc-400">Durée de la vidéo · votre histoire fait {Math.round(seconds)} s</p>
              <div className="mt-2 max-w-md"><LengthPicker value={target} onChange={setTarget} disabled={!!rewriting || running} name="pv-length" /></div>
              {target !== current && (
                <div className="mt-3 rounded-xl border border-violet-500/30 bg-violet-500/[0.06] p-3">
                  <p className="text-sm text-zinc-200">Pour une vidéo de <strong>{lengthLabel(target)}</strong>, l’histoire est réécrite à cette durée (script, prompts d’images et d’animation). C’est gratuit et prend environ 3 minutes.</p>
                  <p className="mt-1 text-xs text-zinc-400">Prix de la vidéo de {lengthLabel(target)} : Éco {formatCredits(VIDEO_PRICES.eco[target])} · Standard {formatCredits(VIDEO_PRICES.standard[target])} · Premium {formatCredits(VIDEO_PRICES.premium[target])} crédits</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <Button size="sm" onClick={() => void rewrite()} disabled={!!rewriting} loading={!!rewriting}>Réécrire pour {lengthLabel(target)}</Button>
                    <button type="button" onClick={() => setTarget(current)} disabled={!!rewriting} className="touch-hit text-xs text-zinc-400 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">Garder {lengthLabel(current)}</button>
                  </div>
                  {rewriting && <p role="status" aria-live="polite" className="mt-2 inline-flex items-center gap-2 text-xs text-violet-200"><Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden />{rewriting}</p>}
                </div>
              )}
            </div>
          )}
          {blocker ? (
            <p className="mt-4 text-sm text-zinc-400">{blocker}</p>
          ) : target !== current ? null : (
            <fieldset className="mt-4">
              <legend className="text-xs text-zinc-400">{last?.status === 'done' ? 'Refaire la vidéo ? Choisissez la qualité' : 'Choisissez la qualité'} · vidéo de {lengthLabel(current)}</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {QUALITIES.map((q) => (
                  <label key={q.key} className={cn('flex cursor-pointer flex-col rounded-xl border px-3 py-2.5 transition-colors focus-within:ring-2 focus-within:ring-violet-500/50',
                    quality === q.key ? 'border-violet-500/60 bg-violet-500/10' : 'border-line/10 hover:bg-line/[0.04]')}>
                    <input type="radio" name="pv-quality" value={q.key} checked={quality === q.key} onChange={() => setQuality(q.key)} className="sr-only" />
                    <span className="flex items-center justify-between gap-2 text-sm font-medium text-zinc-100">{q.label}<span className="tabular-nums text-violet-300">{formatCredits(videoCost(q.key, seconds))} crédits</span></span>
                    <span className="mt-0.5 text-xs text-zinc-400">{q.detail}</span>
                  </label>
                ))}
              </div>
              {error && <p role="alert" className="mt-3 text-sm text-coral-300">{error}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button onClick={() => void start()} disabled={busy || running}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Générer la vidéo · {formatCredits(videoCost(quality, seconds))} crédits
                </Button>
                <span className="text-xs text-zinc-500">Si la génération échoue, vos crédits sont rendus automatiquement.</span>
              </div>
            </fieldset>
          )}
        </>
      )}
    </Card>
  );
}
