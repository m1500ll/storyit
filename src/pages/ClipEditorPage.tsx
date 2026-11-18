import { ArrowLeft, Check, Copy, Download, Loader2, Minus, Plus, RotateCcw, ScanFace, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ClipPlayer } from '@/components/clips/ClipPlayer';
import { ScoreBadge } from '@/components/clips/ClipBadges';
import { SourceMissing } from '@/components/clips/SourceMissing';
import { useSource } from '@/components/clips/useSource';
import { Button, Card, CardHeader, LoadState, Modal, ProgressBar, useToast } from '@/components/ui';
import { useClipProject } from '@/hooks/useStore';
import { cn } from '@/lib/cn';
import { renderClip } from '@/lib/ffmpeg';
import { detectFraming, framingFits } from '@/lib/clipFraming';
import { resolveLayout } from '@/lib/clipLayout';
import { fileNameFor, formatDuration } from '@/lib/clipFormat';
import { repository } from '@/services/repository';
import type { Clip, ClipEditableFields } from '@/types/database';
import { CAPTION_ANIMS, CAPTION_STYLES, LAYOUTS, TITLE_STYLES, type CaptionAnimId, type CaptionStyleId, type LayoutId, type TitleStyleId } from '@/types/clips';

const MIN_LENGTH = 3;
const pick = (c: Clip): ClipEditableFields => ({
  start_s: c.start_s, end_s: c.end_s, title: c.title, captions: c.captions, caption_style: c.caption_style, layout: c.layout, show_title: c.show_title,
  caption_size: c.caption_size, caption_pos: c.caption_pos, caption_anim: c.caption_anim, title_style: c.title_style,
  framing: c.framing ?? null, divider: c.divider ?? true,
});
/** layouts that need the face analysis */
const NEEDS_FRAMING = new Set(['auto', 'split', 'stack', 'track']);
type Scan = { state: 'idle' } | { state: 'running'; progress: number } | { state: 'error'; message: string };
const KIND_LABEL = { facecam: 'L’IA a trouvé une facecam', two_cams: 'L’IA a trouvé deux facecams', people: 'L’IA a trouvé des personnes à l’écran', none: 'L’IA n’a trouvé aucun visage' } as const;

type Save = 'idle' | 'saving' | 'saved' | 'error';
type Export = { state: 'idle' } | { state: 'running'; progress: number } | { state: 'done'; url: string; name: string; stale: boolean } | { state: 'error'; message: string };

function Choice<T extends string>({ name, value, options, onChange }: { name: string; value: T; options: Record<T, { label: string; description: string }>; onChange: (v: T) => void }) {
  return (
    <div className={cn('grid gap-2', Object.keys(options).length === 4 ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-3')} role="radiogroup" aria-label={name}>
      {(Object.keys(options) as T[]).map((k) => (
        <label key={k} className={cn('cursor-pointer rounded-xl border px-3 py-2.5 transition-colors focus-within:ring-2 focus-within:ring-violet-500/50',
          value === k ? 'border-violet-500/50 bg-violet-500/10' : 'border-line/10 hover:border-line/20')}>
          <input type="radio" name={name} value={k} checked={value === k} onChange={() => onChange(k)} className="sr-only" />
          <span className={cn('block text-sm font-medium', value === k ? 'text-zinc-50' : 'text-zinc-300')}>{options[k].label}</span>
          <span className="block text-[11px] text-zinc-500">{options[k].description}</span>
        </label>
      ))}
    </div>
  );
}

function Nudge({ label, value, onChange, onSetNow }: { label: string; value: number; onChange: (v: number) => void; onSetNow: () => void }) {
  const btn = 'touch-hit grid h-9 w-9 place-items-center rounded-lg border border-line/10 text-zinc-300 transition-colors hover:bg-line/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50';
  return (
    <div>
      <p className="label mb-2">{label}</p>
      <div className="flex items-center gap-1.5">
        <button type="button" className={btn} onClick={() => onChange(value - 0.5)} aria-label={`${label} : 0,5 seconde plus tôt`}><Minus className="h-3.5 w-3.5" /></button>
        <span className="w-16 text-center text-sm tabular-nums text-zinc-100">{formatDuration(value)}<span className="text-zinc-500">.{Math.round((value % 1) * 10)}</span></span>
        <button type="button" className={btn} onClick={() => onChange(value + 0.5)} aria-label={`${label} : 0,5 seconde plus tard`}><Plus className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={onSetNow} className="touch-hit ml-1 rounded-lg px-2 py-1.5 text-[11px] text-violet-300 transition-colors hover:bg-violet-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">Caler sur la lecture</button>
      </div>
    </div>
  );
}

/** AI clipping: edit and export one clip. Remount per clip so the local draft never leaks between clips. */
export default function ClipEditorPage() {
  const { clipId } = useParams();
  return <ClipEditor key={clipId} />;
}

function ClipEditor() {
  const { projectId, clipId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: project, loading, error } = useClipProject(projectId);
  const source = useSource(projectId);
  const clip = project?.clips.find((c) => c.id === clipId);

  const [draft, setDraft] = useState<ClipEditableFields | null>(null);
  const [save, setSave] = useState<Save>('idle');
  const [exp, setExp] = useState<Export>({ state: 'idle' });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [scan, setScan] = useState<Scan>({ state: 'idle' });
  const [videoSize, setVideoSize] = useState<{ w: number; h: number } | null>(null);
  const playhead = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const pending = useRef<Partial<ClipEditableFields>>({});

  useEffect(() => { if (clip && !draft) setDraft(pick(clip)); }, [clip, draft]);
  const exportUrl = useRef<string | null>(null);
  useEffect(() => () => { if (exportUrl.current) URL.revokeObjectURL(exportUrl.current); }, []);

  // Warn before leaving mid-render or with unsaved edits.
  useEffect(() => {
    if (exp.state !== 'running' && save !== 'saving') return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [exp.state, save]);

  const flush = useCallback(async () => {
    if (!clipId || Object.keys(pending.current).length === 0) return;
    const patch = pending.current;
    pending.current = {};
    setSave('saving');
    try { await repository.updateClip(clipId, patch); setSave('saved'); } catch { setSave('error'); }
  }, [clipId]);

  useEffect(() => () => { clearTimeout(timer.current); void flush(); }, [flush]);

  const update = (patch: Partial<ClipEditableFields>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    pending.current = { ...pending.current, ...patch };
    setSave('saving');
    setExp((e) => (e.state === 'done' ? { ...e, stale: true } : e));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 700);
  };

  // video size (the layout plan and the export need it)
  useEffect(() => {
    if (!source.url) return;
    const v = document.createElement('video');
    v.preload = 'metadata'; v.muted = true; v.src = source.url;
    v.onloadedmetadata = () => setVideoSize({ w: v.videoWidth, h: v.videoHeight });
    return () => { v.removeAttribute('src'); };
  }, [source.url]);

  // face analysis (facecams, who speaks): once per clip, in the browser, saved on the clip
  const scanFor = useRef<string | null>(null);
  const runScan = useCallback(async (force = false) => {
    if (!source.url || !draft) return;
    const key = `${draft.start_s}-${draft.end_s}`;
    if (!force && scanFor.current === key) return;
    scanFor.current = key;
    setScan({ state: 'running', progress: 0 });
    try {
      const framing = await detectFraming(source.url, draft.start_s, draft.end_s, draft.captions, (p) => setScan({ state: 'running', progress: p }));
      setScan({ state: 'idle' });
      update({ framing });
    } catch (e) {
      console.error('framing', e);
      setScan({ state: 'error', message: e instanceof Error && e.message === 'unreadable'
        ? 'Ton navigateur n’arrive pas à lire les images de cette vidéo pour l’analyse. Essaie avec Chrome, ou convertis-la en MP4 (H.264). En attendant, choisis un cadrage à la main.'
        : 'L’analyse du cadrage n’a pas marché sur ce navigateur. Choisis un cadrage à la main.' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.url, draft?.start_s, draft?.end_s]);
  useEffect(() => {
    if (!draft || !source.url || !NEEDS_FRAMING.has(draft.layout) || framingFits(draft.framing, draft.start_s, draft.end_s)) return;
    const t = setTimeout(() => void runScan(), 800);
    return () => clearTimeout(t);
  }, [draft, source.url, runScan]);

  if (!project || !clip || !draft) {
    if (!loading && !error && (!project || !clip)) {
      return <Card className="text-center"><p className="text-sm text-zinc-400">Ce clip n’existe pas ou a été supprimé.</p><Link to={projectId ? `/app/clips/${projectId}` : '/app/clips'} className="touch-hit mt-3 inline-block text-sm text-violet-300 hover:underline">Retour au projet</Link></Card>;
    }
    return <LoadState loading={loading} error={error} />;
  }

  const duration = project.duration_seconds;
  const setStart = (v: number) => update({ start_s: +Math.min(Math.max(0, v), draft.end_s - MIN_LENGTH).toFixed(2) });
  const setEnd = (v: number) => update({ end_s: +Math.max(Math.min(duration, v), draft.start_s + MIN_LENGTH).toFixed(2) });
  const inRange = draft.captions.map((c, i) => ({ c, i })).filter(({ c }) => c.end > draft.start_s && c.start < draft.end_s);

  const runExport = async () => {
    if (!source.file) return;
    setExp({ state: 'running', progress: 0 });
    try {
      const blob = await renderClip({
        source: source.file, start: draft.start_s, end: draft.end_s, captions: draft.captions,
        title: draft.show_title ? draft.title : null, style: draft.caption_style, layout: draft.layout,
        captionSize: draft.caption_size, captionPos: draft.caption_pos, captionAnim: draft.caption_anim, titleStyle: draft.title_style,
        framing: framingFits(draft.framing, draft.start_s, draft.end_s) ? draft.framing : null, divider: draft.divider,
        width: videoSize?.w ?? 1920, height: videoSize?.h ?? 1080,
        onProgress: (p) => setExp({ state: 'running', progress: p }),
      });
      if (exportUrl.current) URL.revokeObjectURL(exportUrl.current);
      exportUrl.current = URL.createObjectURL(blob);
      setExp({ state: 'done', url: exportUrl.current, name: fileNameFor(draft.title), stale: false });
      toast('Ton clip est prêt à télécharger');
    } catch (e) {
      setExp({ state: 'error', message: e instanceof Error ? e.message : 'L’export a échoué.' });
    }
  };

  const copyTitle = async () => {
    try { await navigator.clipboard.writeText(draft.title); toast('Titre copié'); } catch { toast('Copie impossible : sélectionne le titre et copie-le à la main.', 'error'); }
  };

  const remove = async () => {
    await repository.deleteClip(clip.id);
    toast('Clip supprimé');
    navigate(`/app/clips/${project.id}`);
  };

  return (
    <>
      <Link to={`/app/clips/${project.id}`} className="touch-hit mb-4 inline-flex max-w-full items-center gap-1.5 rounded text-xs text-zinc-500 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
        <ArrowLeft className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{project.title}</span>
      </Link>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3"><ScoreBadge score={clip.score} /><span className="text-xs tabular-nums text-zinc-500">{formatDuration(draft.end_s - draft.start_s)} de durée</span></div>
        <span className="text-xs text-zinc-500" aria-live="polite">
          {save === 'saving' ? <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" />Enregistrement…</span>
            : save === 'saved' ? <span className="inline-flex items-center gap-1 text-emerald-300"><Check className="h-3 w-3" />Enregistré</span>
              : save === 'error' ? <span className="text-coral-300">Non enregistré : vérifie ta connexion.</span> : null}
        </span>
      </div>

      {!source.loading && !source.file && <div className="mb-6"><SourceMissing sourceName={project.source_name} sourceSize={project.source_size} onPick={(f) => void source.relink(f)} /></div>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
        <div className="mx-auto w-full max-w-[340px] lg:sticky lg:top-24 lg:self-start">
          {source.url
            ? <ClipPlayer src={source.url} clip={draft} onTime={(t) => { playhead.current = t; }} />
            : <div className="grid aspect-[9/16] place-items-center rounded-2xl bg-line/[0.04] px-6 text-center text-sm text-zinc-500">Choisis la vidéo pour voir l’aperçu</div>}
          {clip.reason && <p className="mt-3 text-xs text-zinc-500"><span className="text-zinc-400">Pourquoi ce moment :</span> {clip.reason}</p>}
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Exporter" subtitle="MP4 vertical 720×1280 avec les sous-titres incrustés. Gratuit et illimité." />
            {exp.state === 'running' ? (
              <div aria-live="polite">
                <ProgressBar value={Math.round(exp.progress * 100)} max={100} label="Export" />
                <p className="mt-2 text-xs text-zinc-400">Création dans ton navigateur… {Math.round(exp.progress * 100)} %. Ça prend 1 à 2 fois la durée du clip. Garde cet onglet ouvert.</p>
              </div>
            ) : exp.state === 'done' ? (
              <div className="flex flex-wrap items-center gap-2">
                <a href={exp.url} download={exp.name}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-500 px-4 text-sm font-medium text-white shadow-glow transition-colors hover:bg-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
                  <Download className="h-4 w-4" /> Télécharger le MP4
                </a>
                <Button variant="secondary" onClick={runExport} disabled={!source.file}><RotateCcw className="h-4 w-4" /> {exp.stale ? 'Exporter avec mes changements' : 'Exporter à nouveau'}</Button>
                {exp.stale && <p className="w-full text-xs text-amber-300">Tu as modifié le clip depuis cet export.</p>}
              </div>
            ) : (
              <>
                <Button onClick={runExport} disabled={!source.file}><Download className="h-4 w-4" /> Exporter en MP4</Button>
                {exp.state === 'error' && <p className="mt-2 text-xs text-coral-300" aria-live="polite">{exp.message} Réessaie, ou raccourcis le clip.</p>}
              </>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="clip-title" className="text-sm font-semibold text-zinc-100">Titre</label>
              <button type="button" onClick={copyTitle} className="touch-hit inline-flex items-center gap-1 rounded text-xs text-violet-300 hover:text-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"><Copy className="h-3 w-3" /> Copier pour ta publication</button>
            </div>
            <textarea id="clip-title" rows={2} className="input mt-3 resize-none" value={draft.title} maxLength={100}
              onChange={(e) => update({ title: e.target.value })} placeholder="Le moment où tout a basculé…" />
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={draft.show_title} onChange={(e) => update({ show_title: e.target.checked })} className="h-4 w-4 accent-violet-500" />
              Afficher le titre sur la vidéo
            </label>
            {draft.show_title && <div className="mt-4"><Choice name="Style du titre" value={draft.title_style} options={TITLE_STYLES} onChange={(v: TitleStyleId) => update({ title_style: v })} /></div>}
          </Card>

          <Card>
            <CardHeader title="Découpe" subtitle={`L’IA a choisi ${formatDuration(clip.start_s)} → ${formatDuration(clip.end_s)}. Les sous-titres ne couvrent que ce que l’IA a transcrit.`} />
            <div className="flex flex-wrap gap-6">
              <Nudge label="Début" value={draft.start_s} onChange={setStart} onSetNow={() => setStart(playhead.current)} />
              <Nudge label="Fin" value={draft.end_s} onChange={setEnd} onSetNow={() => setEnd(playhead.current)} />
            </div>
            {(draft.start_s !== clip.start_s || draft.end_s !== clip.end_s) && (
              <button type="button" onClick={() => update({ start_s: clip.start_s, end_s: clip.end_s })} className="touch-hit mt-3 rounded text-xs text-zinc-400 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">Revenir au choix de l’IA</button>
            )}
          </Card>

          <Card>
            <CardHeader title="Style des sous-titres" />
            <Choice name="Style des sous-titres" value={draft.caption_style} options={CAPTION_STYLES} onChange={(v: CaptionStyleId) => update({ caption_style: v })} />
            <p className="label mb-3 mt-6">Animation</p>
            <Choice name="Animation des sous-titres" value={draft.caption_anim} options={CAPTION_ANIMS} onChange={(v: CaptionAnimId) => update({ caption_anim: v })} />
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="label flex justify-between"><span>Taille</span><span className="tabular-nums normal-case tracking-normal text-zinc-400">{draft.caption_size} %</span></span>
                <input type="range" min={60} max={150} step={5} value={draft.caption_size} onChange={(e) => update({ caption_size: Number(e.target.value) })} className="mt-2 w-full accent-violet-500" aria-label="Taille des sous-titres" />
              </label>
              <label className="block">
                <span className="label flex justify-between"><span>Hauteur</span><span className="normal-case tracking-normal text-zinc-400">{draft.caption_pos < 260 ? 'En bas' : draft.caption_pos < 520 ? 'Milieu bas' : 'Au centre'}</span></span>
                <input type="range" min={120} max={760} step={10} value={draft.caption_pos} onChange={(e) => update({ caption_pos: Number(e.target.value) })} className="mt-2 w-full accent-violet-500" aria-label="Hauteur des sous-titres" />
              </label>
            </div>
          </Card>

          <Card>
            <CardHeader title="Cadrage" subtitle="Auto : l’IA repère la facecam ou la personne qui parle et cadre le clip pour toi." />
            <Choice name="Cadrage" value={draft.layout} options={LAYOUTS} onChange={(v: LayoutId) => update({ layout: v })} />
            <div className="mt-4 text-xs" aria-live="polite">
              {scan.state === 'running' ? (
                <p className="flex items-center gap-2 text-zinc-300"><Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />L’IA regarde la vidéo pour trouver les visages… {Math.round(scan.progress * 100)} %</p>
              ) : scan.state === 'error' ? (
                <p className="text-coral-300">{scan.message}</p>
              ) : framingFits(draft.framing, draft.start_s, draft.end_s) && NEEDS_FRAMING.has(draft.layout) ? (
                <p className="flex flex-wrap items-center gap-2 text-zinc-400">
                  <ScanFace className="h-3.5 w-3.5 text-violet-300" />{KIND_LABEL[draft.framing!.kind]}
                  {videoSize && draft.layout === 'auto' && <> : cadrage <strong className="font-medium text-zinc-200">{LAYOUTS[resolveLayout('auto', draft.framing, videoSize.w, videoSize.h)].label}</strong></>}.
                  <button type="button" onClick={() => void runScan(true)} className="touch-hit rounded text-violet-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">Relancer l’analyse</button>
                </p>
              ) : null}
            </div>
            {(['split', 'stack', 'auto'] as LayoutId[]).includes(draft.layout) && (
              <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                <input type="checkbox" checked={draft.divider} onChange={(e) => update({ divider: e.target.checked })} className="h-4 w-4 accent-violet-500" />
                Ligne néon entre les cadres
              </label>
            )}
          </Card>

          <Card>
            <details>
              <summary className="cursor-pointer rounded text-sm font-semibold text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
                Modifier le texte des sous-titres <span className="font-normal text-zinc-500">({inRange.length} lignes)</span>
              </summary>
              <ol className="mt-4 max-h-[420px] space-y-2 overflow-y-auto overscroll-contain pr-1">
                {inRange.map(({ c, i }) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className="w-10 shrink-0 text-[11px] tabular-nums text-zinc-500">{formatDuration(c.start - draft.start_s)}</span>
                    <input aria-label={`Sous-titre à ${formatDuration(c.start - draft.start_s)}`} className="input h-9 py-1 text-sm" value={c.text} maxLength={80}
                      onChange={(e) => update({ captions: draft.captions.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)) })} />
                  </li>
                ))}
                {inRange.length === 0 && <li className="text-xs text-zinc-500">Aucun sous-titre dans cette partie.</li>}
              </ol>
            </details>
          </Card>

          <button type="button" onClick={() => setConfirmDelete(true)} className="touch-hit inline-flex items-center gap-1.5 rounded text-xs text-zinc-500 hover:text-coral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"><Trash2 className="h-3.5 w-3.5" /> Supprimer ce clip</button>
        </div>
      </div>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Supprimer ce clip ?"
        footer={<><Button variant="secondary" onClick={() => setConfirmDelete(false)}>Annuler</Button><Button variant="danger" onClick={remove}>Supprimer le clip</Button></>}>
        « {draft.title} » sera retiré du projet. Les fichiers déjà téléchargés restent sur ton appareil.
      </Modal>
    </>
  );
}
