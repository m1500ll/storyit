import { Check, Download, FileVideo, Languages, Loader2, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { usePaywall } from '@/components/billing/Paywall';
import { VoicePicker } from '@/components/studio/VoicePicker';
import { Button, Card, LoadState, PageHeader, useToast } from '@/components/ui';
import { useLiveQuery } from '@/hooks/useStore';
import { cn } from '@/lib/cn';
import { dubCost, DUB_CREDITS_PER_MIN } from '@/services/credits';
import { dubbing, type DubJob, type DubLanguage } from '@/services/dubbing';
import { InsufficientCreditsError } from '@/services/errors';
import { store } from '@/services/store';
import { voicesFor } from '@/services/voices';

const LANGS: { code: DubLanguage; label: string }[] = [
  { code: 'fr', label: 'Français' }, { code: 'en', label: 'Anglais' }, { code: 'es', label: 'Espagnol' },
];
const MAX_SECONDS = 180;
const MAX_BYTES = 250 * 1024 * 1024;
const STEPS: Record<string, string> = {
  start: 'Démarrage', download: 'Préparation de la vidéo', separate: 'Séparation de la voix et de la musique', transcribe: 'Transcription',
  translate: 'Traduction', voice: 'Enregistrement de la nouvelle voix', mix: 'Mixage', captions: 'Sous-titres traduits', encode: 'Assemblage', library: 'Ajout à la bibliothèque',
};

/** reads duration and size of a local video file */
const readVideo = (file: File) => new Promise<{ seconds: number; width: number; height: number }>((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const v = document.createElement('video');
  v.preload = 'metadata';
  v.onloadedmetadata = () => { resolve({ seconds: v.duration, width: v.videoWidth, height: v.videoHeight }); URL.revokeObjectURL(url); };
  v.onerror = () => { reject(new Error('Ce fichier ne peut pas être lu comme une vidéo.')); URL.revokeObjectURL(url); };
  v.src = url;
});

export default function TranslatePage() {
  const toast = useToast();
  const openPaywall = usePaywall();
  const { data: jobs, loading, error } = useLiveQuery(() => dubbing.list(), 'dubs');
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<{ seconds: number; width: number; height: number } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [lang, setLang] = useState<DubLanguage>('en');
  const [voice, setVoice] = useState<string | null>(null);
  const [captions, setCaptions] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => dubbing.watch(() => store.notify()), []);
  const voices = voicesFor(lang);
  const chosenVoice = voices.some((v) => v.id === voice) ? voice! : voices[0]?.id;

  const pick = async (f: File | undefined) => {
    setFileError(null); setFile(null); setMeta(null);
    if (!f) return;
    if (!f.type.startsWith('video/')) return setFileError('Choisissez un fichier vidéo (MP4, MOV ou WebM).');
    if (f.size > MAX_BYTES) return setFileError('La vidéo est trop lourde (250 Mo maximum).');
    try {
      const m = await readVideo(f);
      if (m.seconds > MAX_SECONDS) return setFileError('La vidéo dépasse 3 minutes.');
      setFile(f); setMeta(m); setTitle(f.name.replace(/\.[^.]+$/, '').slice(0, 120));
    } catch (e) { setFileError(e instanceof Error ? e.message : 'Fichier illisible.'); }
  };

  const start = async () => {
    if (!file || !meta) return;
    try {
      setBusy('Envoi de la vidéo…');
      const path = await dubbing.upload(file, () => undefined);
      setBusy('Lancement…');
      const r = await dubbing.create({ sourcePath: path, language: lang, voiceId: chosenVoice, replaceCaptions: captions, seconds: meta.seconds, title });
      toast(`Traduction lancée (${r.credits} crédits). Vous pouvez quitter la page.`);
      setFile(null); setMeta(null); setTitle(''); if (input.current) input.current.value = '';
    } catch (e) {
      if (e instanceof InsufficientCreditsError) openPaywall();
      else toast(e instanceof Error ? e.message : 'La traduction n’a pas pu être lancée.');
    } finally { setBusy(null); }
  };

  const cost = meta ? dubCost(meta.seconds) : DUB_CREDITS_PER_MIN;
  const horizontal = meta && meta.width > meta.height;

  return (
    <>
      <PageHeader eyebrow="Nouveau" title="Traduire une vidéo"
        description="Envoyez une vidéo verticale : Storyit la traduit avec une nouvelle voix, garde la musique et les effets d’origine, et remplace les sous-titres incrustés par des sous-titres traduits." />
      {!dubbing.available && <div className="mb-4"><LoadState loading={false} error="La traduction a besoin du serveur Storyit (mode démo)." /></div>}

      <Card>
        <h2 className="text-sm font-semibold text-zinc-100">1. Votre vidéo</h2>
        <label htmlFor="dub-file" className={cn('mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-8 text-center transition-colors',
          file ? 'border-violet-500/50 bg-violet-500/10' : 'border-line/15 hover:border-violet-500/40')}>
          {file ? <FileVideo className="h-6 w-6 text-violet-300" aria-hidden /> : <Upload className="h-6 w-6 text-violet-300" aria-hidden />}
          <span className="text-sm font-medium text-zinc-100">{file ? file.name : 'Choisir une vidéo'}</span>
          <span className="text-xs text-zinc-400">{meta ? `${Math.round(meta.seconds)} s · ${meta.width}×${meta.height}` : 'MP4, MOV ou WebM · 3 minutes et 250 Mo maximum'}</span>
          <input ref={input} id="dub-file" type="file" accept="video/mp4,video/quicktime,video/webm" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
        </label>
        {fileError && <p role="alert" className="mt-2 text-xs text-coral-300">{fileError}</p>}
        {horizontal && <p className="mt-2 text-xs text-amber-300">Vidéo horizontale : elle sera recadrée au format vertical (9:16).</p>}
        {file && (
          <div className="mt-3">
            <label htmlFor="dub-title" className="text-xs text-zinc-400">Titre (pour votre bibliothèque)</label>
            <input id="dub-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120}
              className="mt-1 h-11 w-full rounded-xl border border-line/10 bg-transparent px-3 text-base text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 sm:text-sm" />
          </div>
        )}

        <h2 className="mb-2 mt-6 text-sm font-semibold text-zinc-100">2. Langue de la traduction</h2>
        <div role="radiogroup" aria-label="Langue de la traduction" className="grid grid-cols-3 gap-2">
          {LANGS.map((l) => (
            <button key={l.code} type="button" role="radio" aria-checked={lang === l.code} onClick={() => setLang(l.code)}
              className={cn('surface flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl px-3 text-sm font-medium text-zinc-100 [touch-action:manipulation] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
                lang === l.code && 'border-violet-500/60 bg-violet-500/10')}>
              {lang === l.code && <Check className="h-4 w-4 text-violet-300" aria-hidden />}{l.label}
            </button>
          ))}
        </div>

        <h2 className="mb-2 mt-6 text-sm font-semibold text-zinc-100">3. La nouvelle voix</h2>
        <VoicePicker voices={voices} value={chosenVoice ?? ''} onChange={setVoice} />

        <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-line/10 p-3">
          <input type="checkbox" checked={captions} onChange={(e) => setCaptions(e.target.checked)} className="mt-0.5 h-5 w-5 accent-violet-500" />
          <span>
            <span className="block text-sm font-medium text-zinc-100">Remplacer les sous-titres incrustés</span>
            <span className="block text-xs text-zinc-400">Efface les sous-titres de la vidéo (lettres blanches au contour noir) et ajoute des sous-titres traduits, mot par mot. Décochez pour garder l’image intacte.</span>
          </span>
        </label>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button disabled={!file || !!busy || !dubbing.available} loading={!!busy} onClick={() => void start()}>
            <Languages className="h-4 w-4" /> {busy ?? `Traduire · ${cost} crédits`}
          </Button>
          <span className="text-xs text-zinc-500">{DUB_CREDITS_PER_MIN} crédits par minute de vidéo, remboursés si la traduction échoue. Environ 5 à 10 minutes.</span>
        </div>
      </Card>

      <h2 className="mb-3 mt-8 text-sm font-semibold text-zinc-100">Vos traductions</h2>
      {loading && !jobs ? <LoadState loading error={null} /> : error ? <LoadState loading={false} error={error} /> : !jobs?.length ? (
        <p className="surface rounded-2xl px-4 py-4 text-sm text-zinc-400">Aucune traduction pour l’instant. Les vidéos traduites sont aussi ajoutées à votre bibliothèque.</p>
      ) : (
        <ul className="space-y-2">{jobs.map((j) => <JobRow key={j.id} job={j} />)}</ul>
      )}
    </>
  );
}

function JobRow({ job }: { job: DubJob }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const name = `${(job.title ?? 'storyit').replace(/[^\p{L}\p{N} -]/gu, '').trim() || 'storyit'}-${job.target_language}.mp4`;
  const download = async () => {
    setBusy(true);
    try { const url = await dubbing.url(job.id, name); if (url) window.location.assign(url); }
    catch (e) { toast(e instanceof Error ? e.message : 'Téléchargement impossible.'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    try { await dubbing.remove(job.id); } catch (e) { toast(e instanceof Error ? e.message : 'Suppression impossible.'); }
  };
  const running = job.status === 'queued' || job.status === 'working';
  return (
    <li className="surface flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-zinc-100">{job.title ?? 'Vidéo'} · {job.target_language.toUpperCase()}</span>
        <span className="block text-xs text-zinc-400">
          {job.status === 'done' ? 'Prête · aussi dans votre bibliothèque' : job.status === 'failed' ? (job.error ?? 'Échec · crédits remboursés') :
            job.status === 'queued' ? 'En attente…' : `${STEPS[job.step ?? 'start'] ?? 'En cours'} · ${job.progress} %`}
        </span>
        {running && <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-line/10"><span className="block h-full rounded-full bg-violet-500 transition-all" style={{ width: `${Math.max(4, job.progress)}%` }} /></span>}
      </span>
      {running && <Loader2 className="h-4 w-4 animate-spin text-violet-300 motion-reduce:animate-none" aria-hidden />}
      {job.status === 'done' && <Button size="sm" loading={busy} onClick={() => void download()}><Download className="h-4 w-4" /> Télécharger</Button>}
      {!running && (
        <button type="button" onClick={() => void remove()} aria-label="Supprimer cette traduction"
          className="touch-hit grid h-9 w-9 place-items-center rounded-lg text-zinc-400 hover:bg-line/[0.06] hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}
