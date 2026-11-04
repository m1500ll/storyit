import { Check, ChevronLeft, Copy, ExternalLink, Loader2, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { SceneImages } from '@/components/prompts/SceneImages';
import { Button, Card, LoadState, PageHeader, useToast } from '@/components/ui';
import { usePaywall } from '@/components/billing/Paywall';
import { useLiveQuery } from '@/hooks/useStore';
import { cn } from '@/lib/cn';
import { InsufficientCreditsError } from '@/services/errors';
import { PROMPT_PROJECT_COST } from '@/services/credits';
import { promptStudio, type PhaseKey } from '@/services/promptStudio';

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
  return { label: `${PROMPT_PROJECT_COST} crédits` };
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
    try { const p = await promptStudio.generate(input); toast('Étape générée.'); return p; } catch (e) {
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

function Start() {
  const cost = useCost();
  const [params] = useSearchParams();
  const [idea, setIdea] = useState(() => params.get('idea')?.slice(0, 600) ?? ''); // prefilled from the dashboard
  const { run, busy, error } = useGenerate();
  const navigate = useNavigate();
  const { data: projects = [], loading } = useLiveQuery(() => promptStudio.list(), 'prompt-projects');
  return (
    <>
      <PageHeader eyebrow="Studio IA · Bêta" title="Prompt Studio"
        description="Storyit écrit avec vous une histoire Fruit Drama de plus d'une minute, étape par étape, puis vous donne les prompts JSON à coller dans Gemini (images) et Grok Imagine (vidéos)." />
      {!promptStudio.available && <div className="mb-4"><LoadState loading={false} error="Le Prompt Studio a besoin du serveur Storyit (mode démo)." /></div>}
      {busy ? <Waiting text={STEPS[0]!.waiting} /> : (
        <Card>
          <label htmlFor="idea" className="text-sm font-medium text-zinc-100">Une idée de départ ? <span className="font-normal text-zinc-500">(facultatif)</span></label>
          <textarea id="idea" rows={3} maxLength={600} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Une fraise trahie par sa sœur pastèque le jour de son mariage…"
            className="mt-2 w-full rounded-xl border border-line/10 bg-transparent p-3 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50" />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button disabled={!promptStudio.available} onClick={async () => { const p = await run({ phase: 'concepts', idea }); if (p) navigate(`/app/prompts/${p.id}`); }}>
              <Sparkles className="h-4 w-4" /> Générer un prompt complet · {cost.label}
            </Button>
            <span className="text-xs text-zinc-500">{`${PROMPT_PROJECT_COST} crédits pour le projet complet, débités une seule fois au démarrage. Les 5 étapes et les régénérations sont incluses.`}</span>
          </div>
          {error && <p role="alert" className="mt-3 text-xs text-coral-300">{error}</p>}
        </Card>
      )}
      <h2 className="mb-3 mt-8 text-sm font-semibold text-zinc-100">Vos projets</h2>
      {loading ? <LoadState loading error={null} /> : projects.length === 0 ? <p className="text-xs text-zinc-500">Aucun projet pour l'instant.</p> : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {projects.map((p) => (
            <li key={p.id} className="surface flex items-center gap-3 px-4 py-3">
              <Link to={`/app/prompts/${p.id}`} className="min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
                <span className="block truncate text-sm text-zinc-100">{p.title}</span>
                <span className="block text-[11px] text-zinc-500">Étape {p.phase}/5 · {STEPS[p.phase - 1]?.label} · {new Date(p.updated_at).toLocaleDateString()}</span>
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
  const shown = view ?? current;
  const has: Record<PhaseKey, boolean> = { concepts: Boolean(d.concepts), script: Boolean(d.script), images: Boolean(d.images), videos: Boolean(d.videos), pack: Boolean(d.pack) };
  const next = (phase: PhaseKey, extra: { choice?: number } = {}) => run({ phase, project_id: id, feedback: feedback || undefined, ...extra });
  const redo = (phase: PhaseKey) => run({ phase, project_id: id, feedback: feedback || undefined, ...(phase === 'script' ? { choice: d.chosen } : {}) });

  // A render helper (not a component), so the input keeps focus while typing.
  const adjust = (phase: PhaseKey, children?: ReactNode) => (
    <Card className="mt-4">
      <label htmlFor="fb" className="text-xs text-zinc-400">Un ajustement avant de régénérer ou de passer à la suite ? (facultatif)</label>
      <input id="fb" value={feedback} maxLength={600} onChange={(e) => setFeedback(e.target.value)} placeholder="Plus de suspense dans la scène 5, un méchant plus drôle…"
        className="mt-1.5 h-10 w-full rounded-xl border border-line/10 bg-transparent px-3 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50" />
      <div className="mt-3 flex flex-wrap gap-2">
        {children}
        <Button variant="ghost" onClick={() => redo(phase)} disabled={Boolean(busy)}><RefreshCw className="h-4 w-4" /> Régénérer cette étape</Button>
      </div>
    </Card>
  );

  return (
    <>
      <Link to="/app/prompts" className="mb-4 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"><ChevronLeft className="h-3 w-3" /> Tous les projets</Link>
      <PageHeader eyebrow="Prompt Studio" title={project.title} description={project.idea ?? undefined} />
      <ol className="mb-6 flex gap-1.5 overflow-x-auto pb-1" aria-label="Étapes">
        {STEPS.map((s, i) => (
          <li key={s.key}>
            <button disabled={!has[s.key]} onClick={() => setView(s.key)} aria-current={shown === s.key ? 'step' : undefined}
              className={cn('flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 disabled:cursor-not-allowed',
                shown === s.key ? 'bg-violet-500/15 text-violet-200' : has[s.key] ? 'text-zinc-300 hover:bg-line/[0.05]' : 'text-zinc-600')}>
              <span className={cn('grid h-5 w-5 place-items-center rounded-full text-[10px] tabular-nums', has[s.key] ? 'bg-emerald-500/15 text-emerald-300' : 'bg-line/5')}>{has[s.key] ? <Check className="h-3 w-3" /> : i + 1}</span>{s.label}
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
              <SceneImages project={project} scenes={d.images} />
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
