import { BookOpen, Building2, Check, ChevronLeft, Clapperboard, Crown, Dices, Download, FlaskConical, Landmark, Loader2, MapPin, Pause, PawPrint, Play, Scale, Send, Sparkles, Trash2, Trophy, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, LoadState, PageHeader, ProgressBar, useToast } from '@/components/ui';
import { usePaywall } from '@/components/billing/Paywall';
import { useLiveQuery } from '@/hooks/useStore';
import { cn } from '@/lib/cn';
import { InsufficientCreditsError } from '@/services/errors';
import { ANIMATED_SHORT_COST } from '@/services/credits';
import { animatedStudio, type AnimatedProject, type AnimatedStatus, type Brief, type ChatLine, type Choices } from '@/services/animatedStudio';
import { voicesFor, type Voice } from '@/services/voices';

const THEMES: { icon: LucideIcon; label: string; hint: string }[] = [
  { icon: Landmark, label: 'Histoire vraie absurde', hint: 'Des faits réels qui semblent inventés' },
  { icon: FlaskConical, label: 'Inventions et sciences ratées', hint: 'Les accidents qui ont tout changé' },
  { icon: Trophy, label: 'Sport insolite', hint: 'Matchs, courses et records improbables' },
  { icon: PawPrint, label: 'Animaux plus malins que nous', hint: 'Quand une bête gagne contre une ville' },
  { icon: Scale, label: 'Lois et règles absurdes', hint: 'Des règles vraies, et pourquoi' },
  { icon: Crown, label: 'Caprices de rois et de maires', hint: 'Les ordres les plus fous' },
  { icon: Building2, label: 'Ponts, bâtiments et chantiers fous', hint: 'Ce qui n’aurait jamais dû tenir' },
  { icon: Dices, label: 'Surprends-moi', hint: 'Le studio choisit un thème pour vous' },
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
  const [busyTheme, setBusyTheme] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data: projects = [], loading, error: listError } = useLiveQuery(() => animatedStudio.list(), 'animated-projects');
  const start = async (text: string, theme?: string) => {
    if (!text.trim()) return;
    setBusy(true); setBusyTheme(theme ?? null); setError(null);
    try { const r = await animatedStudio.chat(text.trim(), undefined, lang); navigate(`/app/studio/${r.project_id}`); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); setBusyTheme(null); }
  };
  return (
    <>
      <PageHeader eyebrow="Studio IA · Bêta" title="Animated Studio"
        description="Choisissez un thème, puis cliquez sur les propositions du studio : un format, une histoire vraie, un décor et une voix. Storyit produit ensuite une vidéo animée verticale de 60 secondes, avec décor 3D, personnages, narration, musique et bruitages." />
      {!animatedStudio.available && <div className="mb-4"><LoadState loading={false} error={"L'Animated Studio a besoin du serveur Storyit (mode démo)."} /></div>}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-xs text-zinc-400" htmlFor="lang">Langue de la narration</label>
        <select id="lang" value={lang} onChange={(e) => setLang(e.target.value)}
          className="h-11 rounded-xl border border-line/10 bg-ink-950 px-3 text-base sm:h-10 text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 sm:text-sm">
          {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        <span className="text-xs text-zinc-500">La discussion est gratuite. La vidéo coûte {ANIMATED_SHORT_COST} crédits, remboursés si le rendu échoue.</span>
      </div>
      <h2 className="mb-3 text-sm font-semibold text-zinc-100">1. Choisissez un thème</h2>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Thèmes">
        {THEMES.map((t) => (
          <li key={t.label} className="min-w-0">
            <button type="button" disabled={!animatedStudio.available || busy} onClick={() => void start(`Thème choisi : ${t.label}`, t.label)}
              className={cn('surface flex h-full w-full flex-col items-start gap-1 rounded-2xl p-3 text-left [touch-action:manipulation] transition-colors hover:border-violet-500/40 hover:bg-violet-500/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 disabled:opacity-50',
                busyTheme === t.label && 'border-violet-500/60 bg-violet-500/10')}>
              <span aria-hidden className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/10 text-violet-300"><t.icon className="h-5 w-5" /></span>
              <span className="text-sm font-medium text-zinc-100">{t.label}</span>
              <span className="text-xs text-zinc-400">{t.hint}</span>
              {busyTheme === t.label && <span className="mt-1 flex items-center gap-1 text-[11px] text-violet-200"><Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" /> Le studio prépare vos options…</span>}
            </button>
          </li>
        ))}
      </ul>
      <Card className="mt-4">
        <label htmlFor="idea" className="text-sm font-medium text-zinc-100">… ou décrivez votre propre idée</label>
        <textarea id="idea" name="idea" rows={2} maxLength={1000} value={idea} onChange={(e) => setIdea(e.target.value)}
          placeholder="Une histoire vraie et drôle sur un pont qui s’est mis à danser…"
          className="mt-2 w-full break-words rounded-xl border border-line/10 bg-transparent p-3 text-base text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 sm:text-sm" />
        <div className="mt-3">
          <Button loading={busy && !busyTheme} disabled={!animatedStudio.available || !idea.trim() || busy} onClick={() => void start(idea)}>
            <Sparkles className="h-4 w-4" /> Discuter avec le studio
          </Button>
        </div>
      </Card>
      <div aria-live="polite">{busy && <p className="mt-3 text-xs text-zinc-400">Le studio invente des options rien que pour vous… (10 à 40 secondes)</p>}
        {error && <p role="alert" className="mt-3 text-xs text-coral-300">{error}</p>}</div>

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
              <Link to={`/app/studio/${p.id}`} className="min-w-0 flex-1 rounded py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
                <span className="block truncate text-sm text-zinc-100">{p.title ?? 'Nouvelle vidéo'}</span>
                <span className="block text-[11px] text-zinc-500">{new Date(p.created_at).toLocaleDateString()}</span>
              </Link>
              <StatusPill p={p} />
              {(p.status === 'brief' || p.status === 'done' || p.status === 'failed') && (
                <button aria-label={`Supprimer ${p.title ?? 'cette vidéo'}`} onClick={() => window.confirm('Supprimer cette vidéo ? Cette action est définitive.') && animatedStudio.remove(p.id)}
                  className="touch-hit rounded-lg p-2 text-zinc-500 hover:bg-line/5 hover:text-coral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"><Trash2 className="h-4 w-4" /></button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** **bold** spans from the studio's replies, rendered as <strong> (no HTML is ever injected) */
function Rich({ text }: { text: string }) {
  return <>{text.split('**').map((part, i) => (i % 2 ? <strong key={i} className="font-semibold text-zinc-50">{part}</strong> : <span key={i}>{part}</span>))}</>;
}

function Bubble({ line }: { line: ChatLine }) {
  const me = line.role === 'user';
  return (
    <div className={cn('flex', me ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
        me ? 'bg-violet-600/90 text-white' : 'surface text-zinc-200')}>
        {me ? line.text : <Rich text={line.text} />}
      </div>
    </div>
  );
}

/** preview stills of each engine decor (rendered by the engine itself, public/studio/decors) */
const DECOR_THUMBS: Record<string, { n: number; label: string }> = {
  river_town: { n: 2, label: 'Ville au bord de l’eau' }, town_square: { n: 2, label: 'Place de ville' }, stadium: { n: 2, label: 'Stade' },
  castle: { n: 2, label: 'Château' }, city: { n: 2, label: 'Ville moderne' }, lab: { n: 1, label: 'Laboratoire' },
  harbour: { n: 2, label: 'Port et mer' }, farm: { n: 2, label: 'Ferme' }, desert: { n: 2, label: 'Désert d’Égypte' }, space: { n: 2, label: 'Espace et Lune' },
};
const DecorThumbs = ({ decor }: { decor: string }) => {
  const d = DECOR_THUMBS[decor];
  if (!d) return null;
  return (
    <span className="mb-2 flex gap-1.5" aria-hidden>
      {Array.from({ length: d.n }, (_, i) => (
        <img key={i} src={`/studio/decors/${decor}-${i + 1}.jpg`} alt="" width={270} height={480} loading="lazy" decoding="async"
          className="aspect-[9/16] w-1/2 max-w-[120px] rounded-lg bg-line/[0.06] object-cover" />
      ))}
    </span>
  );
};

const STEP_ICON: Record<Choices['step'], LucideIcon> = { format: Clapperboard, story: BookOpen, decor: MapPin, other: Sparkles };
const STEP_LABEL: Record<Choices['step'], string> = { format: 'Format', story: 'Histoire', decor: 'Décor', other: 'Choix' };

const StepIcon = ({ step }: { step: Choices['step'] }) => {
  const I = STEP_ICON[step] ?? Sparkles;
  return <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-300"><I className="h-4 w-4" /></span>;
};

/** the studio's clickable options for the next decision */
function ChoiceCards({ choices, onPick, disabled }: { choices: Choices; onPick: (text: string) => void; disabled: boolean }) {
  return (
    <section aria-label={choices.question} className="pl-0 sm:pl-2">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-violet-200">{STEP_LABEL[choices.step] ?? 'Choix'} · <span className="normal-case tracking-normal text-zinc-300">{choices.question}</span></p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {choices.options.map((o) => (
          <li key={o.title} className="min-w-0">
            <button type="button" disabled={disabled} onClick={() => onPick(`${o.title} — ${o.detail}`)}
              className="surface flex h-full w-full items-start gap-3 rounded-2xl p-3 text-left [touch-action:manipulation] transition-colors hover:border-violet-500/40 hover:bg-violet-500/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 disabled:opacity-50">
              <StepIcon step={choices.step} />
              <span className="min-w-0">
                {o.decor && <DecorThumbs decor={o.decor} />}
                <span className="block break-words text-sm font-medium text-zinc-100">{o.title}</span>
                <span className="mt-0.5 block break-words text-xs text-zinc-400">{o.detail}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-zinc-500">Aucune ne vous plaît ? Écrivez ce que vous voulez en bas, ou demandez « d’autres propositions ».</p>
    </section>
  );
}

function BriefCard({ brief }: { brief: Brief }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-emerald-300">Récapitulatif</p>
      <p className="text-balance font-display text-xl text-zinc-50">{brief.title}</p>
      <p className="text-sm text-zinc-200">{brief.hook}</p>
      <dl className="grid gap-1 text-xs text-zinc-400 sm:grid-cols-2">
        <div><dt className="inline text-zinc-500">Format : </dt><dd className="inline text-zinc-300">{brief.format}</dd></div>
        <div><dt className="inline text-zinc-500">Décor : </dt><dd className="inline text-zinc-300">{brief.decor}</dd></div>
      </dl>
      <details className="text-xs text-zinc-400">
        <summary className="cursor-pointer rounded text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">Faits vérifiés et sources ({brief.facts.length})</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">{brief.facts.map((f, i) => <li key={i} className="break-words">{f.fact} <span className="text-zinc-500">({f.source})</span></li>)}</ul>
      </details>
    </div>
  );
}

/** narrator voices with their sample; one shared <audio> so only one plays at a time */
function VoicePicker({ voices, value, onChange }: { voices: Voice[]; value: string; onChange: (id: string) => void }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => () => audio.current?.pause(), []);
  const toggle = (v: Voice) => {
    if (!v.preview) return;
    if (playing === v.id) { audio.current?.pause(); setPlaying(null); return; }
    audio.current?.pause();
    const a = new Audio(v.preview);
    a.onended = () => setPlaying(null);
    audio.current = a; setPlaying(v.id);
    void a.play().catch(() => setPlaying(null));
  };
  return (
    <div role="radiogroup" aria-label="Voix de la narration" className="grid gap-2 sm:grid-cols-2">
      {voices.map((v) => {
        const on = v.id === value;
        return (
          <div key={v.id} className={cn('surface flex items-center gap-2 rounded-2xl p-2 pr-3 transition-colors', on && 'border-violet-500/60 bg-violet-500/10')}>
            {v.preview ? (
              <button type="button" onClick={() => toggle(v)} aria-label={`${playing === v.id ? 'Arrêter' : 'Écouter'} la voix ${v.name}`}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-line/[0.06] text-zinc-100 [touch-action:manipulation] hover:bg-line/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
                {playing === v.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
            ) : <span className="h-11 w-11 shrink-0" />}
            <button type="button" role="radio" aria-checked={on} onClick={() => onChange(v.id)}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1 text-left [touch-action:manipulation] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zinc-100">{v.name}</span>
                <span className="block truncate text-xs text-zinc-400">{v.tagline}</span>
              </span>
              {on && <Check className="h-4 w-4 shrink-0 text-violet-300" aria-hidden />}
            </button>
          </div>
        );
      })}
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
  const [dlUrl, setDlUrl] = useState<string | null>(null);
  const [voice, setVoice] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => animatedStudio.watch(id, () => undefined), [id]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [project?.transcript?.length, pending]);
  useEffect(() => {
    if (project?.status !== 'done' || !project.video_path) return;
    void animatedStudio.videoUrl(project.video_path).then(setUrl);
    void animatedStudio.videoUrl(project.video_path, `${(project.title ?? 'storyit').replace(/[^\p{L}\p{N} -]/gu, '').trim() || 'storyit'}.mp4`).then(setDlUrl);
  }, [project?.status, project?.video_path, project?.title]);
  // leaving mid-reply loses nothing (the reply is saved server-side), but warn while a message is being sent
  useEffect(() => {
    if (!sending) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [sending]);

  if (loading && !project) return <LoadState loading error={null} />;
  if (loadError || !project) return <LoadState loading={false} error={loadError ?? 'Vidéo introuvable.'} />;

  const send = async (raw: string = msg, typed = true) => {
    const text = raw.trim();
    if (!text || sending) return;
    setSending(true); setError(null); setPending(text); if (typed) setMsg('');
    try { await animatedStudio.chat(text, id, project.language); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); if (typed) setMsg(text); }
    finally { setSending(false); setPending(null); }
  };
  const generate = async () => {
    setLaunching(true); setError(null);
    try { await animatedStudio.generate(id, project.language, chosenVoice); toast('Vidéo lancée. Vous pouvez quitter la page.'); }
    catch (e) {
      if (e instanceof InsufficientCreditsError) openPaywall();
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLaunching(false); }
  };
  const transcript = project.transcript ?? [];
  const last = transcript.at(-1);
  const cards = project.status === 'brief' && !pending && last?.role === 'assistant' ? last.choices : undefined;
  const brief = [...transcript].reverse().find((l) => l.brief)?.brief;
  const voices = voicesFor(project.language);
  const chosenVoice = voice ?? voices[0]?.id;
  const working = ['queued', 'writing', 'voicing', 'rendering'].includes(project.status);
  const stageIdx = STAGES.findIndex((s) => s.key === project.status);

  return (
    <>
      <Link to="/app/studio" className="touch-hit mb-4 inline-flex items-center gap-1 rounded text-xs text-zinc-400 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
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
                <p className="text-xs text-zinc-400">Elle est aussi dans votre <Link to="/app/library" className="rounded text-violet-300 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">bibliothèque vidéo</Link>, prête à être publiée.</p>
                <a href={dlUrl ?? url}
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
        {transcript.map((l, i) => (l.text || l.role === 'user') && <Bubble key={i} line={l} />)}
        {cards && <ChoiceCards choices={cards} disabled={sending} onPick={(t) => void send(t, false)} />}
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

      {project.status === 'brief' && brief && !pending && (
        <Card className="mt-6 border-violet-500/30">
          <BriefCard brief={brief} />
          <h2 className="mb-2 mt-5 text-sm font-semibold text-zinc-100">Choisissez la voix du narrateur</h2>
          <VoicePicker voices={voices} value={chosenVoice ?? ''} onChange={setVoice} />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button loading={launching} disabled={sending} onClick={() => void generate()}>
              <Clapperboard className="h-4 w-4" /> Générer la vidéo · {ANIMATED_SHORT_COST} crédits
            </Button>
            <span className="text-xs text-zinc-500">Débités une seule fois, remboursés si le rendu échoue. Environ 30 minutes.</span>
          </div>
        </Card>
      )}

      {project.status === 'brief' && (
        <Card className="mt-6">
          <label htmlFor="msg" className="mb-2 block text-xs text-zinc-400">{brief ? 'Un détail à changer ? Dites-le au studio.' : 'Ou écrivez au studio'}</label>
          <textarea id="msg" name="msg" rows={2} maxLength={4000} value={msg} onChange={(e) => setMsg(e.target.value)} disabled={sending}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder={brief ? 'Je préfère la lumière du coucher de soleil…' : 'Je veux une histoire qui se passe au Japon…'}
            className="w-full break-words rounded-xl border border-line/10 bg-transparent p-3 text-base text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 sm:text-sm" />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button variant="secondary" loading={sending} disabled={!msg.trim()} onClick={() => void send()}><Send className="h-4 w-4" /> Envoyer</Button>
            {!brief && <span className="text-xs text-zinc-500">Quand le format, l’histoire et le décor sont choisis, vous choisirez la voix puis lancerez la vidéo.</span>}
          </div>
          <div aria-live="polite">{error && <p role="alert" className="mt-3 text-xs text-coral-300">{error}</p>}</div>
        </Card>
      )}
      {project.status !== 'brief' && error && <p role="alert" className="mt-3 text-xs text-coral-300">{error}</p>}
    </>
  );
}
