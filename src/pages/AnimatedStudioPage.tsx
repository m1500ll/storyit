import { ChevronLeft, Clapperboard, Download, Loader2, Send, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, LoadState, PageHeader, ProgressBar, useToast } from '@/components/ui';
import { usePaywall } from '@/components/billing/Paywall';
import { useLiveQuery } from '@/hooks/useStore';
import { cn } from '@/lib/cn';
import { InsufficientCreditsError } from '@/services/errors';
import { ANIMATED_SHORT_COST } from '@/services/credits';
import { animatedStudio, type AnimatedProject, type AnimatedStatus, type ChatLine } from '@/services/animatedStudio';

const EXAMPLES = [
  'Une histoire vraie et drôle sur un pont, pour enfants de 10 ans',
  "L'invention par accident la plus improbable de l'histoire",
  'Un fait historique absurde qui a changé une loi',
];
const LANGS: { code: string; label: string }[] = [{ code: 'fr', label: 'Français' }, { code: 'en', label: 'English' }, { code: 'es', label: 'Español' }];

const STAGES: { key: AnimatedStatus; label: string; doing: string }[] = [
  { key: 'queued', label: 'En file', doing: 'Votre vidéo attend un serveur de rendu…' },
  { key: 'writing', label: 'Script et plans', doing: 'Le studio écrit le script, les plans et les mouvements de caméra…' },
  { key: 'voicing', label: 'Voix', doing: 'Enregistrement de la narration…' },
  { key: 'rendering', label: 'Rendu 3D', doing: 'Rendu du décor, des personnages et du son, image par image…' },
];
const STATUS_LABEL: Record<AnimatedStatus, string> = {
  brief: 'Discussion', queued: 'En file', writing: 'Écriture', voicing: 'Voix', rendering: 'Rendu', done: 'Prête', failed: 'Échec',
};

export default function AnimatedStudioPage() {
  const { projectId } = useParams();
  return projectId ? <Project id={projectId} /> : <Start />;
}

function StatusPill({ p }: { p: Pick<AnimatedProject, 'status' | 'progress'> }) {
  const tone = p.status === 'done' ? 'bg-emerald-500/15 text-emerald-300' : p.status === 'failed' ? 'bg-coral-500/15 text-coral-300'
    : p.status === 'brief' ? 'bg-line/[0.08] text-zinc-400' : 'bg-violet-500/15 text-violet-200';
  return (
    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums', tone)}>
      {STATUS_LABEL[p.status]}{['queued', 'writing', 'voicing', 'rendering'].includes(p.status) ? ` · ${p.progress} %` : ''}
    </span>
  );
}

function Start() {
  const navigate = useNavigate();
  const [idea, setIdea] = useState('');
  const [lang, setLang] = useState('fr');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: projects = [], loading, error: listError } = useLiveQuery(() => animatedStudio.list(), 'animated-projects');
  const start = async (text: string) => {
    if (!text.trim()) return;
    setBusy(true); setError(null);
    try { const r = await animatedStudio.chat(text.trim(), undefined, lang); navigate(`/app/studio/${r.project_id}`); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader eyebrow="Studio IA · Bêta" title="Animated Studio"
        description="Racontez votre idée : le studio vous propose une histoire vraie et un décor, puis Storyit produit une vidéo animée verticale de 60 secondes, avec décor 3D, personnages, narration, musique et bruitages." />
      {!animatedStudio.available && <div className="mb-4"><LoadState loading={false} error={"L'Animated Studio a besoin du serveur Storyit (mode démo)."} /></div>}
      <Card>
        <label htmlFor="idea" className="text-sm font-medium text-zinc-100">Votre idée de vidéo</label>
        <textarea id="idea" name="idea" rows={3} maxLength={1000} value={idea} onChange={(e) => setIdea(e.target.value)}
          placeholder="Une histoire vraie et drôle sur un pont qui s'est mis à danser…"
          className="mt-2 w-full break-words rounded-xl border border-line/10 bg-transparent p-3 text-base text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 sm:text-sm" />
        <div className="mt-2 flex flex-wrap gap-2" aria-label="Exemples d'idées">
          {EXAMPLES.map((x) => (
            <button key={x} type="button" onClick={() => setIdea(x)}
              className="rounded-full border border-line/10 px-3 py-1.5 text-xs text-zinc-300 [touch-action:manipulation] hover:border-violet-500/40 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
              {x}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-xs text-zinc-400" htmlFor="lang">Langue de la narration</label>
          <select id="lang" value={lang} onChange={(e) => setLang(e.target.value)}
            className="h-10 rounded-xl border border-line/10 bg-ink-950 px-3 text-base text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 sm:text-sm">
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <Button loading={busy} disabled={!animatedStudio.available || !idea.trim()} onClick={() => start(idea)}>
            <Sparkles className="h-4 w-4" /> Discuter avec le studio
          </Button>
          <span className="text-xs text-zinc-500">La discussion est gratuite. La vidéo coûte {ANIMATED_SHORT_COST} crédits, remboursés si le rendu échoue.</span>
        </div>
        <div aria-live="polite">{busy && <p className="mt-3 text-xs text-zinc-400">Le studio lit votre idée et prépare des propositions… (10 à 40 secondes)</p>}
          {error && <p role="alert" className="mt-3 text-xs text-coral-300">{error}</p>}</div>
      </Card>

      <h2 className="mb-3 mt-8 text-sm font-semibold text-zinc-100">Vos vidéos animées</h2>
      {loading || listError ? <LoadState loading={loading} error={listError} /> : projects.length === 0 ? (
        <div className="surface flex items-start gap-3 px-4 py-4">
          <Clapperboard className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" />
          <p className="text-sm text-zinc-400">Aucune vidéo pour l'instant. Écrivez une idée ci-dessus, ou choisissez un exemple : le studio vous guide jusqu'à la vidéo finie.</p>
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {projects.map((p) => (
            <li key={p.id} className="surface flex items-center gap-3 px-4 py-3">
              <Link to={`/app/studio/${p.id}`} className="min-w-0 flex-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
                <span className="block truncate text-sm text-zinc-100">{p.title ?? 'Nouvelle vidéo'}</span>
                <span className="block text-[11px] text-zinc-500">{new Date(p.created_at).toLocaleDateString()}</span>
              </Link>
              <StatusPill p={p} />
              {(p.status === 'brief' || p.status === 'done' || p.status === 'failed') && (
                <button aria-label={`Supprimer ${p.title ?? 'cette vidéo'}`} onClick={() => window.confirm('Supprimer cette vidéo ? Cette action est définitive.') && animatedStudio.remove(p.id)}
                  className="rounded-lg p-2 text-zinc-500 hover:bg-line/5 hover:text-coral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"><Trash2 className="h-4 w-4" /></button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Bubble({ line }: { line: ChatLine }) {
  const me = line.role === 'user';
  return (
    <div className={cn('flex', me ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
        me ? 'bg-violet-600/90 text-white' : 'surface text-zinc-200')}>
        {line.text}
      </div>
    </div>
  );
}

function Project({ id }: { id: string }) {
  const toast = useToast();
  const openPaywall = usePaywall();
  const { data: project, loading, error: loadError } = useLiveQuery(() => animatedStudio.get(id), `animated-project:${id}`);
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => animatedStudio.watch(id, () => undefined), [id]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [project?.transcript?.length, pending]);
  useEffect(() => {
    if (project?.status === 'done' && project.video_path) void animatedStudio.videoUrl(project.video_path).then(setUrl);
  }, [project?.status, project?.video_path]);
  // leaving mid-reply loses nothing (the reply is saved server-side), but warn while a message is being sent
  useEffect(() => {
    if (!sending) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [sending]);

  if (loading && !project) return <LoadState loading error={null} />;
  if (loadError || !project) return <LoadState loading={false} error={loadError ?? 'Vidéo introuvable.'} />;

  const send = async () => {
    const text = msg.trim();
    if (!text) return;
    setSending(true); setError(null); setPending(text); setMsg('');
    try { await animatedStudio.chat(text, id, project.language); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); setMsg(text); }
    finally { setSending(false); setPending(null); }
  };
  const generate = async () => {
    setLaunching(true); setError(null);
    try { await animatedStudio.generate(id, project.language); toast('Vidéo lancée. Vous pouvez quitter la page.'); }
    catch (e) {
      if (e instanceof InsufficientCreditsError) openPaywall();
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLaunching(false); }
  };
  const transcript = project.transcript ?? [];
  const working = ['queued', 'writing', 'voicing', 'rendering'].includes(project.status);
  const stageIdx = STAGES.findIndex((s) => s.key === project.status);

  return (
    <>
      <Link to="/app/studio" className="mb-4 inline-flex items-center gap-1 rounded text-xs text-zinc-400 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
        <ChevronLeft className="h-3.5 w-3.5" /> Toutes les vidéos
      </Link>
      <PageHeader eyebrow="Animated Studio · Bêta" title={project.title ?? 'Nouvelle vidéo'} actions={<StatusPill p={project} />} />

      {project.status === 'done' && (
        <Card className="mb-6">
          {url ? (
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <video src={url} controls playsInline preload="metadata" className="aspect-[9/16] w-full max-w-[320px] rounded-xl bg-black" />
              <div className="min-w-0 space-y-3">
                <p className="text-sm text-zinc-200">Votre vidéo animée est prête : 60 secondes, format vertical 9:16, avec narration, musique et bruitages.</p>
                <a href={url} download={`${(project.title ?? 'storyit').replace(/[^\p{L}\p{N} -]/gu, '')}.mp4`}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-line/10 bg-line/[0.03] px-4 text-sm text-zinc-100 hover:bg-line/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
                  <Download className="h-4 w-4" /> Télécharger le MP4
                </a>
                <p className="text-xs text-zinc-500">Le lien de téléchargement est valable une heure ; rechargez la page pour en obtenir un nouveau.</p>
              </div>
            </div>
          ) : <LoadState loading error={null} rows={2} />}
        </Card>
      )}

      {working && (
        <Card className="mb-6" role="status" aria-live="polite">
          <p className="flex items-center gap-2 text-sm text-zinc-100"><Loader2 className="h-4 w-4 animate-spin text-violet-300 motion-reduce:animate-none" />{STAGES[stageIdx]?.doing}</p>
          <div className="mt-3"><ProgressBar value={project.progress} max={100} label="Avancement de la vidéo" /></div>
          <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {STAGES.map((s, i) => (
              <li key={s.key} className={cn('rounded-lg px-2 py-1.5 text-center text-[11px]', i < stageIdx ? 'bg-emerald-500/10 text-emerald-300' : i === stageIdx ? 'bg-violet-500/15 text-violet-200' : 'bg-line/[0.04] text-zinc-500')}>
                {s.label}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-zinc-500">Une vidéo prend en général 20 à 40 minutes. Vous pouvez fermer cette page : elle sera dans « Vos vidéos animées ».</p>
        </Card>
      )}

      {project.status === 'failed' && (
        <Card className="mb-6 border-coral-500/30">
          <p role="alert" className="text-sm text-coral-300">{project.error ?? "La vidéo n'a pas pu être produite."}</p>
          <p className="mt-1 text-xs text-zinc-400">{(project.credits_charged ?? 0) > 0 ? 'Le remboursement de vos crédits est en cours.' : 'Vos crédits ont été remboursés.'} Vous pouvez créer une nouvelle vidéo depuis la liste.</p>
        </Card>
      )}

      <section aria-label="Discussion avec le studio" className="space-y-3">
        {transcript.map((l, i) => <Bubble key={i} line={l} />)}
        {pending && <Bubble line={{ role: 'user', text: pending }} />}
        {sending && (
          <div className="flex justify-start" role="status" aria-live="polite">
            <div className="surface flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin text-violet-300 motion-reduce:animate-none" /> Le studio réfléchit et vérifie les faits… (10 à 40 secondes)
            </div>
          </div>
        )}
        <div ref={endRef} />
      </section>

      {project.status === 'brief' && (
        <Card className="mt-6">
          <label htmlFor="msg" className="sr-only">Votre message au studio</label>
          <textarea id="msg" name="msg" rows={2} maxLength={4000} value={msg} onChange={(e) => setMsg(e.target.value)} disabled={sending}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder="Je préfère la deuxième idée, avec le pont au coucher du soleil…"
            className="w-full break-words rounded-xl border border-line/10 bg-transparent p-3 text-base text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 sm:text-sm" />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button variant="secondary" loading={sending} disabled={!msg.trim()} onClick={() => void send()}><Send className="h-4 w-4" /> Envoyer</Button>
            <Button loading={launching} disabled={sending || transcript.length < 2} onClick={() => void generate()}>
              <Clapperboard className="h-4 w-4" /> Générer la vidéo · {ANIMATED_SHORT_COST} crédits
            </Button>
          </div>
          <p className="mt-2 text-xs text-zinc-500">Quand l'histoire et le décor vous plaisent, lancez la vidéo. Les crédits sont débités une seule fois, et remboursés si le rendu échoue.</p>
          <div aria-live="polite">{error && <p role="alert" className="mt-3 text-xs text-coral-300">{error}</p>}</div>
        </Card>
      )}
      {project.status !== 'brief' && error && <p role="alert" className="mt-3 text-xs text-coral-300">{error}</p>}
    </>
  );
}
