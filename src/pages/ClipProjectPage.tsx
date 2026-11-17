import { ArrowLeft, ArrowRight, AudioLines, Check, Loader2, RotateCcw, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePaywall } from '@/components/billing/Paywall';
import { ClipPlayer } from '@/components/clips/ClipPlayer';
import { ClipStatusBadge, ScoreBadge } from '@/components/clips/ClipBadges';
import { SourceMissing } from '@/components/clips/SourceMissing';
import { useSource } from '@/components/clips/useSource';
import { Button, Card, LoadState, Modal, ProgressBar, useToast } from '@/components/ui';
import { useClipProject } from '@/hooks/useStore';
import { cn } from '@/lib/cn';
import { formatDuration } from '@/lib/clipFormat';
import { isBusy, startAnalysis, useJob, type Job } from '@/services/clipJobs';
import { clipCostFor } from '@/services/credits';
import { repository } from '@/services/repository';
import { sourceStore } from '@/services/sourceStore';
import type { ClipProjectWithClips } from '@/types/database';

const AI_COPY = [
  'J’écoute toute la vidéo…',
  'Je repère les accroches, les punchlines et les avis tranchés…',
  'Je vérifie que chaque moment se comprend tout seul…',
  'J’écris des titres qui arrêtent le scroll…',
  'Je cale les sous-titres mot à mot…',
];

function Step({ state, icon: Icon, title, detail }: { state: 'todo' | 'active' | 'done'; icon: typeof Wand2; title: string; detail: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full',
        state === 'done' ? 'bg-emerald-500/15 text-emerald-300' : state === 'active' ? 'bg-violet-500/15 text-violet-300' : 'bg-line/5 text-zinc-600')}>
        {state === 'done' ? <Check className="h-4 w-4" /> : state === 'active' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <p className={cn('text-sm', state === 'todo' ? 'text-zinc-500' : 'text-zinc-100')}>{title}</p>
        <div className="mt-1 text-xs text-zinc-500">{detail}</div>
      </div>
    </li>
  );
}

/** Waiting on the browser (audio) then on the AI: say what's happening, show the shape of the result. */
function Working({ job, project }: { job: Job | undefined; project: ClipProjectWithClips }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 3500); return () => clearInterval(t); }, []);
  const audioDone = !job || job.stage !== 'audio';
  const estimate = Math.round(Math.min(120, 20 + project.duration_seconds / 30));
  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card>
        <p className="label">En cours</p>
        <ol className="mt-4 space-y-5">
          <Step state={audioDone ? 'done' : 'active'} icon={AudioLines} title="Lecture du son dans ton navigateur"
            detail={audioDone ? 'Terminé' : <><ProgressBar value={Math.round((job?.progress ?? 0) * 100)} max={100} label="Lecture du son" /><span className="mt-1 block">Garde cet onglet ouvert · {Math.round((job?.progress ?? 0) * 100)} %</span></>} />
          <Step state={audioDone ? 'active' : 'todo'} icon={Wand2} title="Recherche des meilleurs moments"
            detail={audioDone ? <span aria-live="polite">{AI_COPY[tick % AI_COPY.length]} En général {estimate < 60 ? `${estimate} s` : '1 à 2 min'}.</span> : `Environ ${estimate < 60 ? `${estimate} s` : '1 à 2 min'}`} />
          <Step state="todo" icon={Sparkles} title="Clips prêts à retoucher et exporter" detail="Titres, sous-titres et cadrage vertical inclus" />
        </ol>
        <p className="mt-6 text-[11px] text-zinc-500">Tu n’es débité que si des clips sont trouvés.</p>
      </Card>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className={cn('space-y-3', i === 2 && 'hidden sm:block')}>
            <div className="aspect-[9/16] animate-pulse rounded-2xl bg-line/[0.05]" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-line/[0.06]" />
            <div className="h-3 w-2/5 animate-pulse rounded bg-line/[0.04]" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** AI clipping: the analysis in progress, then the clips found, best first. */
export default function ClipProjectPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const openPaywall = usePaywall();
  const { data: project, loading, error } = useClipProject(projectId);
  const job = useJob(projectId);
  const source = useSource(projectId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // the audio is read in this tab: warn before closing it mid-way
  const readingAudio = job?.stage === 'audio';
  useEffect(() => {
    if (!readingAudio) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [readingAudio]);

  if (!project) {
    if (!loading && !error) {
      return <Card className="text-center"><p className="text-sm text-zinc-400">Ce projet n’existe pas ou a été supprimé.</p><Link to="/app/clips" className="touch-hit mt-3 inline-block text-sm text-violet-300 hover:underline">Retour aux clips</Link></Card>;
    }
    return <LoadState loading={loading} error={error} />;
  }

  const working = isBusy(job) || project.status === 'analyzing';
  const failed = !working && (job?.stage === 'error' || project.status === 'failed' || project.status === 'uploading');
  const failMessage = job?.stage === 'error' ? job.error : project.error_message ?? 'Le traitement s’est arrêté avant l’étape IA (l’onglet a été fermé ou rechargé).';
  const needsCredits = job?.stage === 'error' ? job.needsCredits : /insuffisants/i.test(project.error_message ?? '') ? clipCostFor(project.duration_seconds) : undefined;

  const retry = () => {
    if (!source.file) return;
    startAnalysis(project.id, source.file, project.duration_seconds);
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await repository.deleteClipProject(project.id);
      await sourceStore.remove(project.id);
      toast('Projet supprimé');
      navigate('/app/clips');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Suppression impossible', 'error');
      setDeleting(false);
    }
  };

  return (
    <>
      <Link to="/app/clips" className="touch-hit mb-4 inline-flex items-center gap-1.5 rounded text-xs text-zinc-500 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"><ArrowLeft className="h-3.5 w-3.5" /> Tous les projets</Link>
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3"><ClipStatusBadge status={working ? 'analyzing' : failed ? 'failed' : project.status} /><span className="text-xs tabular-nums text-zinc-500">{formatDuration(project.duration_seconds)} de vidéo</span></div>
          <h1 className="mt-2 break-words font-display text-4xl text-zinc-50 text-balance">{project.title}</h1>
          <p className="mt-1 truncate text-xs text-zinc-500">{project.source_name}</p>
        </div>
        <Button variant="ghost" size="sm" className="self-start md:self-auto" onClick={() => setConfirmDelete(true)} disabled={working}><Trash2 className="h-3.5 w-3.5" /> Supprimer le projet</Button>
      </div>

      {!source.loading && !source.file && (project.status === 'ready' || failed) && (
        <div className="mb-6"><SourceMissing sourceName={project.source_name} sourceSize={project.source_size} onPick={(f) => void source.relink(f)} /></div>
      )}

      {working && <Working job={job} project={project} />}

      {failed && (
        <Card className="border-coral-500/20">
          <p className="text-sm font-medium text-zinc-100">Impossible de terminer cette vidéo</p>
          <p className="mt-1 text-sm text-zinc-400">{failMessage}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {needsCredits
              ? <Button onClick={() => openPaywall({ required: needsCredits })}>Recharger mes crédits</Button>
              : <Button onClick={retry} disabled={!source.file}><RotateCcw className="h-4 w-4" /> Réessayer gratuitement</Button>}
            {needsCredits && <Button variant="secondary" onClick={retry} disabled={!source.file}>J’ai rechargé, réessayer</Button>}
          </div>
          {!source.file && <p className="mt-2 text-xs text-zinc-500">Choisis la vidéo ci-dessus pour réessayer.</p>}
        </Card>
      )}

      {!working && project.status === 'ready' && (
        project.clips.length === 0
          ? <Card className="text-center text-sm text-zinc-400">Tous les clips de ce projet ont été supprimés.</Card>
          : (
            <>
              <p className="mb-4 text-sm text-zinc-400"><strong className="text-zinc-100">{project.clips.length} clip{project.clips.length > 1 ? 's' : ''} trouvé{project.clips.length > 1 ? 's' : ''}</strong>, du meilleur au moins bon. Ouvre-en un pour le retoucher et l’exporter.</p>
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {[...project.clips].sort((a, b) => b.score - a.score).map((c) => (
                  <li key={c.id} className="min-w-0">
                    {source.url
                      ? <ClipPlayer src={source.url} clip={c} compact />
                      : <div className="grid aspect-[9/16] place-items-center rounded-2xl bg-line/[0.04] px-4 text-center text-xs text-zinc-500">Choisis la vidéo pour voir l’aperçu</div>}
                    <div className="mt-3 flex items-center gap-2"><ScoreBadge score={c.score} /><span className="text-[11px] tabular-nums text-zinc-500">{formatDuration(c.end_s - c.start_s)} · à {formatDuration(c.start_s)}</span></div>
                    <p className="mt-1.5 line-clamp-2 text-sm font-medium text-zinc-100">{c.title}</p>
                    {c.reason && <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{c.reason}</p>}
                    <Link to={`/app/clips/${project.id}/${c.id}`}
                      className="touch-hit mt-2 inline-flex items-center gap-1 rounded text-xs font-medium text-violet-300 hover:text-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
                      Retoucher et exporter <ArrowRight className="h-3 w-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )
      )}

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Supprimer ce projet ?"
        footer={<><Button variant="secondary" onClick={() => setConfirmDelete(false)}>Annuler</Button><Button variant="danger" onClick={remove} loading={deleting}>Supprimer le projet</Button></>}>
        Ses {project.clips.length} clip{project.clips.length === 1 ? '' : 's'} seront supprimés. Les clips déjà téléchargés restent sur ton appareil. Les crédits utilisés ne sont pas rendus.
      </Modal>
    </>
  );
}
