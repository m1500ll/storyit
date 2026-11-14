import { Check, ChevronLeft, Copy, ExternalLink, Lightbulb, Loader2, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, Card, LoadState, PageHeader, useToast } from '@/components/ui';
import { usePaywall } from '@/components/billing/Paywall';
import { useLiveQuery } from '@/hooks/useStore';
import { cn } from '@/lib/cn';
import { InsufficientCreditsError } from '@/services/errors';
import { PROMPT_PROJECT_COST, formatCredits } from '@/services/credits';
import { promptStudio, type PhaseKey, type StyleKey } from '@/services/promptStudio';
import { V4Project, V4_STEPS } from '@/components/prompts/V4Project';
import { TrendIdeas } from '@/components/prompts/TrendIdeas';
import { conceptToStory } from '@shared/trends.ts';
import { STYLES } from '@shared/promptStudio.ts';
import { LengthPicker } from '@/components/prompts/LengthPicker';
import { CastPicker } from '@/components/characters/CastPicker';
import { DEFAULT_VIDEO_LENGTH, type VideoLength } from '@shared/promptVideo.ts';

const STEPS: { key: PhaseKey; label: string; waiting: string }[] = [
  { key: 'concepts', label: 'Concepts', waiting: 'Écriture de 3 concepts…' },
  { key: 'script', label: 'Script', waiting: 'Écriture des 15 à 20 scènes et des dialogues…' },
  { key: 'images', label: 'Prompts image', waiting: 'Écriture des prompts image, scène par scène…' },
  { key: 'videos', label: 'Prompts vidéo', waiting: 'Écriture des prompts vidéo avec dialogues…' },
  { key: 'pack', label: 'Miniature & SEO', waiting: 'Écriture de la miniature, des titres et des hashtags…' },
];
const pretty = (o: unknown) => JSON.stringify(o, null, 2);
/** A project costs PROMPT_PROJECT_COST credits once, at the start. */
function useCost() {
  return { label: `${formatCredits(PROMPT_PROJECT_COST)} crédits` };
}

function CopyBtn({ text, label = 'Copier' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button onClick={() => navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); })}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs text-zinc-300 hover:bg-line/[0.06] hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
      {done ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}{done ? 'Copié' : label}
    </button>
  );
}

/** Copies a ready-to-paste prompt, then opens the tool in a new tab: the user generates on their own account (their Gemini or Grok plan). */
function OpenBtn({ text, url, label }: { text: string; url: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button onClick={() => { void navigator.clipboard.writeText(text).catch(() => undefined); window.open(url, '_blank', 'noopener'); setDone(true); setTimeout(() => setDone(false), 2500); }}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-violet-500/15 px-2.5 text-xs font-medium text-violet-200 hover:bg-violet-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
      {done ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <ExternalLink className="h-3.5 w-3.5" />}{done ? 'Copié, collez-le' : label}
    </button>
  );
}

function JsonBlock({ title, value, open }: { title: string; value: unknown; open?: { text: string; url: string; label: string } }) {
  const text = pretty(value);
  return (
    <div className="surface overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-1 border-b border-line/[0.06] px-4 py-2"><span className="text-xs font-medium text-zinc-200">{title}</span><span className="flex gap-1">{open && <OpenBtn {...open} />}<CopyBtn text={text} /></span></div>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words p-4 text-[12px] leading-relaxed text-zinc-300">{text}</pre>
    </div>
  );
}

export default function PromptStudioPage() {
  const { projectId } = useParams();
  return projectId ? <Project id={projectId} /> : <Start />;
}

function useGenerate() {
  const toast = useToast();
  const openPaywall = usePaywall();
  const [busy, setBusy] = useState<PhaseKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (input: Parameters<typeof promptStudio.generate>[0]) => {
    setBusy(input.phase); setError(null);
    try {
      let p = await promptStudio.generate(input);
      // the script is always proofread (sense, real sentences, natural pace); when the first pass ran out of time, do it now
      if (input.phase === 'script' && (p.data as { script_reviewed?: boolean }).script_reviewed === false) {
        try { p = await promptStudio.review(p.id); } catch { /* the script stays usable; the checklist shows what to fix */ }
      }
      toast(input.phase === 'script' ? 'Script écrit et relu.' : 'Étape générée.'); return p;
    } catch (e) {
      if (e instanceof InsufficientCreditsError) openPaywall();
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally { setBusy(null); }
  };
  return { run, busy, error };
}

function Waiting({ text }: { text: string }) {
  return (
    <Card role="status" aria-live="polite">
      <p className="flex items-center gap-2 text-sm text-zinc-200"><Loader2 className="h-4 w-4 animate-spin text-violet-300 motion-reduce:animate-none" />{text}</p>
      <p className="mt-1 text-xs text-zinc-500">Cela prend généralement 20 à 90 secondes. Le résultat est enregistré : vous pouvez quitter la page.</p>
      <div className="mt-4 space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-line/[0.05] motion-reduce:animate-none" />)}</div>
    </Card>
  );
}

const VEILLE = [
  'On ne cherche pas l’idée géniale : on part d’une histoire qui a DÉJÀ cartonné ailleurs (souvent aux États-Unis), et on l’adapte.',
  'Sur TikTok, cherchez « fruit story ai part 1 » ou « ai fruit drama » et triez par vidéos récentes. Une extension qui affiche les vues et la date aide beaucoup.',
  'Gardez une vidéo qui a beaucoup de vues et de partages, publiée il y a moins de 48 h.',
  'Vérifiez qu’elle n’existe pas encore en français : cherchez 3 ou 4 mots-clés du sujet. S’il y a déjà des copies, passez à la suivante.',
  'Résumez l’histoire en quelques lignes ici.',
  'On l’adapte : têtes, prénoms, décors et 2-3 détails changés, avec vos propres vannes. On ne recopie jamais le titre, le texte ni les visuels.',
];

function Start() {
  const cost = useCost();
  const [params] = useSearchParams();
  const [style, setStyle] = useState<StyleKey>(() => { const q = params.get('style'); return q && q in STYLES ? (q as StyleKey) : 'fruits'; });
  const [story, setStory] = useState(() => params.get('idea')?.slice(0, 3000) ?? ''); // prefilled from the dashboard
  const [part2, setPart2] = useState(false);
  const [part, setPart] = useState(2);
  const [previousEnd, setPreviousEnd] = useState('');
  const [veille, setVeille] = useState(false);
  const [length, setLength] = useState<VideoLength>(DEFAULT_VIDEO_LENGTH);
  const [cast, setCast] = useState<string[]>([]);
  const { run, busy, error } = useGenerate();
  const navigate = useNavigate();
  const { data: projects = [], loading } = useLiveQuery(() => promptStudio.list(), 'prompt-projects');
  const common = { style, length, ...(cast.length ? { cast } : {}), ...(part2 ? { part, previous_end: previousEnd } : {}) };
  const start = async (phase: 'script' | 'concepts') => { const p = await run({ phase, story, ...common }); if (p) navigate(`/app/prompts/${p.id}`); };
  return (
    <>
      <PageHeader eyebrow="Studio IA · V4" title="Creative Studio"
        description="Votre histoire devient un mini-drama 3D vertical de plus d’une minute : hook, découpage minuté, prompts d’images pour ChatGPT et prompts d’animation pour Grok Imagine, pensés pour la rétention et l’engagement." />
      {!promptStudio.available && <div className="mb-4"><LoadState loading={false} error="Le Creative Studio a besoin du serveur Storyit (mode démo)." /></div>}
      {busy ? <Waiting text={V4_STEPS.find((x) => x.key === busy)?.waiting ?? 'Écriture…'} /> : (
        <Card>
          <h2 className="text-sm font-semibold text-zinc-100">1. Vos personnages <span className="font-normal text-zinc-500">(les mêmes dans toute la série)</span></h2>
          <div className="mt-3"><CastPicker value={cast} onChange={setCast} /></div>

          <h2 className={cn('mt-6 text-sm font-semibold text-zinc-100', cast.length > 0 && 'opacity-50')}>{cast.length ? 'Style des personnages : remplacé par vos personnages' : 'Ou laissez le studio inventer les personnages, dans ce style'}</h2>
          <div role="radiogroup" aria-label="Style des personnages" aria-disabled={cast.length > 0} className={cn('mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4', cast.length > 0 && 'pointer-events-none opacity-40')}>
            {(Object.keys(STYLES) as StyleKey[]).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={style === k} onClick={() => setStyle(k)}
                className={cn('group relative overflow-hidden rounded-2xl border text-left transition [touch-action:manipulation] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60',
                  style === k ? 'border-violet-500 ring-2 ring-violet-500/40' : 'border-line/10 hover:border-violet-400/50')}>
                <img src={promptStudio.styleImage(k)} alt="" width={640} height={854} loading="lazy" className="aspect-[4/5] w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
                <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                {k === 'fruits' && <span className="absolute left-2 top-2 rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-semibold text-white">Conseillé</span>}
                {style === k && <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-violet-600 text-white"><Check className="h-3.5 w-3.5" aria-hidden /></span>}
                <span className="absolute inset-x-0 bottom-0 p-3">
                  <span className="block text-sm font-semibold text-white">{STYLES[k].label}</span>
                  <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-white/75">{STYLES[k].text}</span>
                </span>
              </button>
            ))}
          </div>

          <h2 className="mt-6 text-sm font-semibold text-zinc-100">2. La durée de la vidéo <span className="font-normal text-zinc-500">(l’histoire est écrite pour cette durée)</span></h2>
          <div className="mt-2 max-w-md"><LengthPicker value={length} onChange={setLength} /></div>

          <label htmlFor="story" className="mt-6 block text-sm font-semibold text-zinc-100">3. Votre histoire <span className="font-normal text-zinc-500">(quelques lignes, même en vrac)</span></label>
          <textarea id="story" rows={4} maxLength={3000} value={story} onChange={(e) => setStory(e.target.value)}
            placeholder="Un livreur fraise trouve un sac de billets dans son scooter. Son patron citron l’accuse de l’avoir volé devant toute la pizzeria…"
            className="mt-2 w-full rounded-xl border border-line/10 bg-transparent p-3 text-base text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 sm:text-sm" />
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
              <input type="checkbox" checked={part2} onChange={(e) => setPart2(e.target.checked)} className="h-4 w-4 accent-violet-500" /> C’est une suite
            </label>
            <button type="button" onClick={() => setVeille(!veille)} aria-expanded={veille} className="inline-flex items-center gap-1.5 text-xs text-violet-300 hover:underline">
              <Lightbulb className="h-3.5 w-3.5" aria-hidden /> Pas d’idée ? La méthode de veille
            </button>
          </div>
          {part2 && (
            <div className="mt-3 grid gap-3 sm:grid-cols-[120px_1fr]">
              <label className="text-xs text-zinc-400">Numéro de partie
                <input type="number" min={2} max={20} value={part} onChange={(e) => setPart(Math.max(2, Math.min(20, Number(e.target.value) || 2)))}
                  className="mt-1 block h-11 w-full rounded-xl border border-line/10 bg-transparent px-3 text-base text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 sm:text-sm" />
              </label>
              <label className="text-xs text-zinc-400">La fin de la partie précédente (le cliffhanger)
                <textarea rows={2} maxLength={1500} value={previousEnd} onChange={(e) => setPreviousEnd(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-line/10 bg-transparent p-3 text-base text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 sm:text-sm" />
              </label>
            </div>
          )}
          {veille && (
            <ol className="mt-3 list-decimal space-y-1.5 rounded-xl border border-line/10 bg-line/[0.02] py-3 pl-8 pr-4 text-xs leading-relaxed text-zinc-300">
              {VEILLE.map((v) => <li key={v}>{v}</li>)}
            </ol>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button disabled={!promptStudio.available || !story.trim()} onClick={() => void start('script')}><Wand2 className="h-4 w-4" /> Créer mon mini-drama · {cost.label}</Button>
            <Button variant="secondary" disabled={!promptStudio.available} onClick={() => void start('concepts')}><Sparkles className="h-4 w-4" /> Propose-moi 3 histoires</Button>
          </div>
          <p className="mt-2 text-xs text-zinc-500">{`${formatCredits(PROMPT_PROJECT_COST)} crédits pour le projet complet, débités une seule fois au démarrage. Les 5 étapes, les régénérations et les dépannages sont inclus.`}</p>
          {error && <p role="alert" className="mt-3 text-xs text-coral-300">{error}</p>}
        </Card>
      )}
      {!busy && <TrendIdeas onUse={(c) => {
        setStory(conceptToStory({ title: c.title, cast_text: c.cast_text ?? '', hook: c.hook ?? '', outline: c.outline ?? '', ending: c.ending ?? '', repeat_line: c.repeat_line ?? '', screen_line: c.screen_line ?? '' }));
        document.getElementById('story')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        document.getElementById('story')?.focus({ preventScroll: true });
      }} />}
      <h2 className="mb-3 mt-8 text-sm font-semibold text-zinc-100">Vos projets</h2>
      {loading ? <LoadState loading error={null} /> : projects.length === 0 ? <p className="text-xs text-zinc-500">Aucun projet pour l'instant.</p> : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {projects.map((p) => (
            <li key={p.id} className="surface flex items-center gap-3 py-2 pl-2 pr-3">
              <img src={promptStudio.styleImage(p.style)} alt="" width={48} height={64} loading="lazy" className="h-16 w-12 shrink-0 rounded-xl object-cover" />
              <Link to={`/app/prompts/${p.id}`} className="min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
                <span className="block truncate text-sm text-zinc-100">{p.title}</span>
                <span className="block text-[11px] text-zinc-500">Étape {p.phase}/5 · {V4_STEPS[p.phase - 1]?.label} · {new Date(p.updated_at).toLocaleDateString()}</span>
              </Link>
              <button aria-label={`Supprimer ${p.title}`} onClick={() => window.confirm('Supprimer ce projet ?') && promptStudio.remove(p.id)}
                className="rounded-lg p-2 text-zinc-500 hover:bg-line/5 hover:text-coral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Project({ id }: { id: string }) {
  const { data: project, loading, error: loadError } = useLiveQuery(() => promptStudio.get(id), `prompt-project:${id}`);
  const { run, busy, error } = useGenerate();
  const [view, setView] = useState<PhaseKey | null>(null);
  const [feedback, setFeedback] = useState('');
  const d = project?.data ?? {};
  // Default view: the furthest generated phase.
  const current: PhaseKey = useMemo(() => (d.pack ? 'pack' : d.videos ? 'videos' : d.images ? 'images' : d.script ? 'script' : 'concepts'), [d]);
  useEffect(() => { setView(null); setFeedback(''); }, [current]);
  if (!project) return <LoadState loading={loading} error={loadError ?? (loading ? null : 'Projet introuvable')} />;
  if (project.data.v4) return (
    <>
      <Link to="/app/prompts" className="mb-4 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"><ChevronLeft className="h-3 w-3" /> Tous les projets</Link>
      <PageHeader eyebrow="Creative Studio" title={project.title} description={project.data.story || undefined} />
      {busy && <Waiting text={V4_STEPS.find((x) => x.key === busy)?.waiting ?? 'Écriture…'} />}
      <V4Project project={project} run={run} busy={busy} error={error} />
    </>
  );
  const shown = view ?? current;
  const has: Record<PhaseKey, boolean> = { concepts: Boolean(d.concepts), script: Boolean(d.script), images: Boolean(d.images), videos: Boolean(d.videos), pack: Boolean(d.pack) };
  const next = (phase: PhaseKey, extra: { choice?: number } = {}) => run({ phase, project_id: id, feedback: feedback || undefined, ...extra });
  const redo = (phase: PhaseKey) => run({ phase, project_id: id, feedback: feedback || undefined, ...(phase === 'script' ? { choice: d.chosen } : {}) });

  // Projects made before the V4 studio are read-only (the server refuses new steps on them).
  const adjust = (_phase: PhaseKey, _children?: ReactNode) => (
    <Card className="mt-4 text-xs text-zinc-400">Ce projet a été créé avec l’ancienne version du studio : il reste consultable, mais pour les nouvelles étapes (hooks, découpage minuté, prompts Grok multi-plans), <Link to="/app/prompts" className="text-violet-300 underline">créez un nouveau projet</Link>.</Card>
  );
  void next; void redo; void feedback; void setFeedback;

  return (
    <>
      <Link to="/app/prompts" className="mb-4 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"><ChevronLeft className="h-3 w-3" /> Tous les projets</Link>
      <PageHeader eyebrow="Creative Studio" title={project.title} description={project.idea ?? undefined} />
      <ol className="mb-6 flex gap-1.5 overflow-x-auto pb-1" aria-label="Étapes">
        {STEPS.map((s, i) => (
          <li key={s.key}>
            <button disabled={!has[s.key]} onClick={() => setView(s.key)} aria-current={shown === s.key ? 'step' : undefined}
              className={cn('flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 disabled:cursor-not-allowed',
                shown === s.key ? 'bg-violet-500/15 text-violet-200' : has[s.key] ? 'text-zinc-300 hover:bg-line/[0.05]' : 'text-zinc-600')}>
              <span className={cn('grid h-5 w-5 place-items-center rounded-full text-[11px] tabular-nums', has[s.key] ? 'bg-emerald-500/15 text-emerald-300' : 'bg-line/5')}>{has[s.key] ? <Check className="h-3 w-3" /> : i + 1}</span>{s.label}
            </button>
          </li>
        ))}
      </ol>
      {error && <p role="alert" className="mb-4 rounded-xl border border-coral-500/30 bg-coral-500/10 px-4 py-3 text-xs text-coral-300">{error}</p>}
      {busy ? <Waiting text={STEPS.find((s) => s.key === busy)!.waiting} /> : (
        <>
          {shown === 'concepts' && d.concepts && (
            <>
              <p className="mb-3 text-sm text-zinc-300">Choisissez l'histoire à développer :</p>
              <div className="grid gap-3 lg:grid-cols-3">
                {d.concepts.map((c, i) => (
                  <Card key={c.title} className={cn('flex flex-col', d.chosen === i && 'border-violet-500/50')}>
                    <p className="text-xs text-zinc-500">Option {i + 1}</p>
                    <h2 className="mt-1 font-display text-2xl text-zinc-50">{c.title}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-300">{c.synopsis}</p>
                    <p className="mt-3 text-xs text-zinc-500">Personnages</p>
                    <ul className="mt-1 space-y-1 text-xs text-zinc-300">{c.characters.map((p) => <li key={p.name}><strong className="text-zinc-100">{p.name}</strong> ({p.fruit}) · {p.role}</li>)}</ul>
                    <p className="mt-3 text-xs text-zinc-500">Lieux</p>
                    <p className="mt-1 text-xs text-zinc-300">{c.locations.join(' → ')}</p>
                    <Button className="mt-4 w-full" onClick={() => next('script', { choice: i })}>Choisir l'option {i + 1}</Button>
                  </Card>
                ))}
              </div>
              {adjust('concepts')}
            </>
          )}
          {shown === 'script' && d.script && (
            <>
              <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
                <ol className="min-w-0 space-y-2">
                  {d.script.scenes.map((s) => (
                    <li key={s.scene_number} className="surface p-4">
                      <p className="text-xs text-zinc-500">Scène {s.scene_number} · {s.location} · {s.emotional_beat}</p>
                      <p className="mt-1 text-sm text-zinc-200">{s.action}</p>
                      {s.dialogue.length > 0 && <ul className="mt-2 space-y-1">{s.dialogue.map((l, k) => <li key={k} className="text-sm text-zinc-300"><strong className="text-zinc-100">{l.character}</strong> <span className="text-xs text-zinc-500">({l.voice_accent_tone})</span> : « {l.line} »</li>)}</ul>}
                    </li>
                  ))}
                </ol>
                <div className="space-y-3 self-start">
                  <Card><p className="text-xs text-zinc-500">Personnages</p><ul className="mt-2 space-y-2 text-xs text-zinc-300">{d.script.characters.map((c) => <li key={c.name}><strong className="text-zinc-100">{c.name}</strong> ({c.fruit}) · {c.archetype}<br /><span className="text-zinc-500">{c.look}</span></li>)}</ul></Card>
                  <Card><p className="text-xs text-zinc-500">Feuille de route des lieux</p><p className="mt-2 text-xs text-zinc-300">{d.script.locations.join(' → ')}</p></Card>
                </div>
              </div>
              {adjust('script', <Button onClick={() => next('images')}>Valider le script → prompts image</Button>)}
            </>
          )}
          {shown === 'images' && d.images && (
            <>
              <Guide text="Avec votre compte Gemini : « Ouvrir dans Gemini » copie le prompt de la scène et ouvre Gemini, il ne reste qu'à coller (Cmd/Ctrl + V) et envoyer." all={d.images} />
              <div className="grid gap-3 md:grid-cols-2">{d.images.map((p) => <JsonBlock key={p.scene_number} title={`Scène ${p.scene_number} · ${p.location_environment}`} value={p}
                open={{ label: 'Ouvrir dans Gemini', url: 'https://gemini.google.com/app', text: `Crée une image verticale 9:16, style ${p.style}. Lieu : ${p.location_environment}. ${p.prompt} Aucun texte ni filigrane sur l'image.` }} />)}</div>
              {adjust('images', <Button onClick={() => next('videos')}>Valider → prompts vidéo</Button>)}
            </>
          )}
          {shown === 'videos' && d.videos && (
            <>
              <Guide text="« Ouvrir dans Grok » copie le prompt et ouvre Grok Imagine : importez l'image de la scène, collez (Cmd/Ctrl + V), choisissez le format vertical 9:16, puis générez." all={d.videos} />
              <div className="grid gap-3 md:grid-cols-2">{d.videos.map((p) => <JsonBlock key={p.scene_number} title={`Scène ${p.scene_number}`} value={p}
                open={{ label: 'Ouvrir dans Grok', url: 'https://grok.com/imagine', text: p.prompt }} />)}</div>
              {adjust('videos', <Button onClick={() => next('pack')}>Valider → miniature & SEO</Button>)}
            </>
          )}
          {shown === 'pack' && d.pack && (
            <>
              <JsonBlock title="Prompt de miniature (9:16)" value={d.pack.thumbnail} />
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <Card><div className="flex items-center justify-between"><p className="text-xs text-zinc-500">5 titres</p><CopyBtn text={d.pack.titles.join('\n')} label="Tout copier" /></div>
                  <ol className="mt-2 space-y-1.5">{d.pack.titles.map((t) => <li key={t} className="flex items-start justify-between gap-2 text-sm text-zinc-200"><span className="min-w-0 break-words">{t}</span><CopyBtn text={t} /></li>)}</ol></Card>
                <Card><div className="flex items-center justify-between"><p className="text-xs text-zinc-500">Légende + hashtags</p><CopyBtn text={`${d.pack.caption}\n\n${d.pack.hashtags.join(' ')}`} /></div>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-zinc-200">{d.pack.caption}</p>
                  <p className="mt-2 break-words text-xs text-violet-300">{d.pack.hashtags.join(' ')}</p></Card>
              </div>
              <Card className="mt-4 text-sm text-zinc-300">Projet terminé. Une fois la vidéo montée, importez-la dans la <Link to="/app/library" className="text-violet-300 underline">bibliothèque</Link> pour la publier sur vos comptes.</Card>
              {adjust('pack')}
            </>
          )}
        </>
      )}
    </>
  );
}

function Guide({ text, all }: { text: string; all: unknown[] }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line/10 bg-line/[0.02] px-4 py-3">
      <p className="text-xs text-zinc-300">{text}</p>
      <CopyBtn text={all.map((x) => pretty(x)).join('\n\n')} label={`Copier les ${all.length} blocs`} />
    </div>
  );
}
