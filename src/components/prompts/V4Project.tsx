import { AlertTriangle, Check, ChevronDown, Copy, ExternalLink, RefreshCw, Wrench, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card } from '@/components/ui';
import { AutoVideo } from './AutoVideo';
import { cn } from '@/lib/cn';
import { promptStudio, type PhaseKey, type PromptProject, type V4Data } from '@/services/promptStudio';
import { checklist, clipStats, coverPrompt, FIX_PROBLEMS, grokPrompt, imagePrompt, sheetPrompt, STYLES } from '@shared/promptStudio.ts';

export const V4_STEPS: { key: PhaseKey; label: string; waiting: string }[] = [
  { key: 'concepts', label: 'Histoires', waiting: 'Écriture de 3 histoires…' },
  { key: 'script', label: 'Pitch & découpage', waiting: 'Écriture du pitch, des 5 hooks et du découpage minuté…' },
  { key: 'images', label: 'Prompts image', waiting: 'Écriture de la planche et des images de départ…' },
  { key: 'videos', label: 'Prompts Grok', waiting: 'Écriture des prompts Grok, plan par plan…' },
  { key: 'pack', label: 'Couverture & légende', waiting: 'Écriture de la couverture, de la légende et du commentaire épinglé…' },
];

function CopyBtn({ text, label = 'Copier' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={() => navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); })}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs text-zinc-300 hover:bg-line/[0.06] hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
      {done ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}{done ? 'Copié' : label}
    </button>
  );
}
function OpenBtn({ text, url, label }: { text: string; url: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={() => { void navigator.clipboard.writeText(text).catch(() => undefined); window.open(url, '_blank', 'noopener'); setDone(true); setTimeout(() => setDone(false), 2500); }}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-violet-500/15 px-2.5 text-xs font-medium text-violet-200 hover:bg-violet-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
      {done ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <ExternalLink className="h-3.5 w-3.5" />}{done ? 'Copié, collez-le' : label}
    </button>
  );
}
function PromptBlock({ title, text, open, extra, badge }: { title: string; text: string; open?: { url: string; label: string }; extra?: ReactNode; badge?: ReactNode }) {
  return (
    <div className="surface overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-1 border-b border-line/[0.06] px-4 py-2">
        <span className="flex items-center gap-2 text-xs font-medium text-zinc-200">{title}{badge}</span>
        <span className="flex flex-wrap gap-1">{extra}{open && <OpenBtn text={text} {...open} />}<CopyBtn text={text} /></span>
      </div>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words p-4 text-[12px] leading-relaxed text-zinc-300">{text}</pre>
    </div>
  );
}
function HowTo({ title, steps }: { title: string; steps: string[] }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-4 rounded-2xl border border-violet-500/25 bg-violet-500/[0.06]">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-zinc-100">
        {title}<ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && <ol className="list-decimal space-y-1.5 px-4 pb-4 pl-9 text-xs leading-relaxed text-zinc-300">{steps.map((s) => <li key={s}>{s}</li>)}</ol>}
    </div>
  );
}
function Checklist({ d }: { d: V4Data }) {
  const items = checklist(d);
  if (!items.length) return null;
  const ok = items.filter((c) => c.ok).length;
  return (
    <Card>
      <p className="flex items-center justify-between text-xs text-zinc-400">Checklist <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums', ok === items.length ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300')}>{ok}/{items.length}</span></p>
      <ul className="mt-2 space-y-2">
        {items.map((c) => (
          <li key={c.label} className="flex gap-2 text-xs">
            {c.ok ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" aria-label="OK" /> : <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-coral-300" aria-label="À corriger" />}
            <span><span className="text-zinc-200">{c.label}</span><span className="block text-[11px] text-zinc-500">{c.detail}</span></span>
          </li>
        ))}
      </ul>
      {ok < items.length && <p className="mt-3 text-[11px] text-zinc-500">Pour corriger : décrivez le souci dans « Un ajustement » puis régénérez l’étape, ou utilisez « Dépannage » sur le clip concerné.</p>}
    </Card>
  );
}

const wpsTone = (w: number) => (w >= 4.2 && w <= 4.6 ? 'text-emerald-300' : w >= 4.0 && w <= 4.9 ? 'text-amber-300' : 'text-coral-300');

export function V4Project({ project, run, busy, error }: {
  project: PromptProject; busy: PhaseKey | 'fix' | null; error: string | null;
  run: (input: Parameters<typeof promptStudio.generate>[0]) => Promise<unknown>;
}) {
  const d = project.data as unknown as V4Data;
  const id = project.id;
  const style = STYLES[d.style] ?? STYLES.fruits;
  const [view, setView] = useState<PhaseKey | null>(null);
  const [feedback, setFeedback] = useState('');
  const [fixing, setFixing] = useState<number | null>(null);
  const [problem, setProblem] = useState('slow');
  const [note, setNote] = useState('');
  const [fixBusy, setFixBusy] = useState(false);
  const [fixError, setFixError] = useState<string | null>(null);
  const current: PhaseKey = d.pack && d.videos ? 'pack' : d.videos ? 'videos' : d.images ? 'images' : d.script ? 'script' : 'concepts';
  const shown = view && (view === 'concepts' ? d.concepts : d[view]) ? view : current;
  const has: Record<PhaseKey, boolean> = { concepts: !!d.concepts, script: !!d.script, images: !!d.images, videos: !!d.videos, pack: !!d.pack };
  const steps = V4_STEPS.filter((s) => s.key !== 'concepts' || d.concepts);
  const go = (phase: PhaseKey, extra: { choice?: number } = {}) => { setView(phase); void run({ phase, project_id: id, feedback: feedback || undefined, ...extra }).then(() => setFeedback('')); };
  const fix = async (i: number) => {
    setFixBusy(true); setFixError(null);
    try { await promptStudio.fix({ project_id: id, scene: i, problem, note: note || undefined }); setFixing(null); setNote(''); }
    catch (e) { setFixError(e instanceof Error ? e.message : 'Échec du dépannage.'); } finally { setFixBusy(false); }
  };

  const adjust = (phase: PhaseKey, children?: ReactNode) => (
    <Card className="mt-4">
      <label htmlFor="fb" className="text-xs text-zinc-400">Un ajustement avant de régénérer ou de passer à la suite ? (facultatif)</label>
      <input id="fb" value={feedback} maxLength={600} onChange={(e) => setFeedback(e.target.value)} placeholder="Un méchant plus drôle, un hook avec un chiffre, la réplique culte au clip 4…"
        className="mt-1.5 h-11 w-full rounded-xl border border-line/10 bg-transparent px-3 text-base text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 sm:h-10 sm:text-sm" />
      <div className="mt-3 flex flex-wrap gap-2">
        {children}
        <Button variant="ghost" onClick={() => go(phase, phase === 'script' && d.chosen !== undefined ? { choice: d.chosen } : {})} disabled={Boolean(busy)}><RefreshCw className="h-4 w-4" /> Régénérer cette étape</Button>
      </div>
    </Card>
  );

  const s = d.script;
  return (
    <>
      <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line/10 py-1 pl-1 pr-3 text-xs text-zinc-300"><img src={promptStudio.styleImage(d.style)} alt="" width={24} height={24} className="h-6 w-6 rounded-full object-cover" /> Style {style.label} · verrouillé pour la série{d.part > 1 ? ` · Partie ${d.part}` : ''}</p>
      <ol className="mb-6 flex gap-1.5 overflow-x-auto pb-1" aria-label="Étapes">
        {steps.map((st, i) => (
          <li key={st.key}>
            <button type="button" disabled={!has[st.key]} onClick={() => setView(st.key)} aria-current={shown === st.key ? 'step' : undefined}
              className={cn('flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 disabled:cursor-not-allowed',
                shown === st.key ? 'bg-violet-500/15 text-violet-200' : has[st.key] ? 'text-zinc-300 hover:bg-line/[0.05]' : 'text-zinc-600')}>
              <span className={cn('grid h-5 w-5 place-items-center rounded-full text-[11px] tabular-nums', has[st.key] ? 'bg-emerald-500/15 text-emerald-300' : 'bg-line/5')}>{has[st.key] ? <Check className="h-3 w-3" /> : i + 1}</span>{st.label}
            </button>
          </li>
        ))}
      </ol>
      {d.videos && !busy && (shown === 'videos' || shown === 'pack') && <AutoVideo projectId={id} data={d} />}
      {error && <p role="alert" className="mb-4 rounded-xl border border-coral-500/30 bg-coral-500/10 px-4 py-3 text-xs text-coral-300">{error}</p>}
      {busy && busy !== 'fix' ? null : (
        <>
          {shown === 'concepts' && d.concepts && (
            <>
              <p className="mb-3 text-sm text-zinc-300">Choisissez l’histoire à développer :</p>
              <div className="grid gap-3 lg:grid-cols-3">
                {d.concepts.map((c, i) => (
                  <Card key={c.title + i} className={cn('flex flex-col', d.chosen === i && 'border-violet-500/50')}>
                    <p className="text-xs text-zinc-500">Option {i + 1}</p>
                    <h2 className="mt-1 font-display text-2xl text-zinc-50">{c.title}</h2>
                    <p className="mt-1 text-sm font-medium text-violet-200">{c.paradox}</p>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-300">{c.synopsis}</p>
                    {c.hook && <p className="mt-2 text-xs text-zinc-400">Hook : « {c.hook} »</p>}
                    <ul className="mt-3 space-y-1 text-xs text-zinc-300">{c.characters.map((p) => <li key={p.name}><strong className="text-zinc-100">{p.name}</strong> ({p.head}) · {p.role}</li>)}</ul>
                    <p className="mt-2 text-xs text-zinc-500">{c.locations.join(' → ')}</p>
                    <Button className="mt-4 w-full" onClick={() => go('script', { choice: i })}>Développer l’option {i + 1}</Button>
                  </Card>
                ))}
              </div>
              {adjust('concepts')}
            </>
          )}

          {shown === 'script' && s && (
            <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
              <div className="min-w-0 space-y-4">
                <Card>
                  <p className="label">A · Pitch</p>
                  <h2 className="mt-1 font-display text-3xl text-zinc-50">{s.title}</h2>
                  <p className="mt-1 text-sm font-medium text-violet-200">{s.paradox}</p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">{s.synopsis}</p>
                  <p className="mt-3 text-xs text-zinc-400">Lieux : {s.locations.join(' · ')} · Budget : {s.clips.length} clips ({s.clips.map((c) => `${c.seconds} s`).join(' + ')}) = <strong className="text-zinc-200">{s.clips.reduce((a, c) => a + c.seconds, 0)} s</strong></p>
                  <p className="mt-1 text-xs text-zinc-400">Cliffhanger : {s.cliffhanger}</p>
                </Card>
                <Card>
                  <p className="label">Personnages</p>
                  <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                    {s.characters.map((c) => (
                      <li key={c.name} className="rounded-xl bg-line/[0.03] p-3 text-xs">
                        <p className="text-sm font-semibold text-zinc-100">{c.name} <span className="font-normal text-zinc-500">« {c.phonetic} » · {c.role}</span></p>
                        <p className="mt-1 text-zinc-400">{c.head} · {c.outfit}</p>
                        <p className="mt-1 text-zinc-500">Voix : {c.voice}</p>
                      </li>
                    ))}
                  </ul>
                </Card>
                <Card>
                  <p className="label">A2 · Hook retenu</p>
                  <p className="mt-2 text-base font-semibold text-zinc-50">« {s.clips[0]?.lines[0]?.text} »</p>
                  <p className="mt-1 text-xs text-zinc-400">Image : {s.hook.image}</p>
                  <p className="mt-1 text-xs text-zinc-500">{s.hook.why}</p>
                  <details className="mt-3 text-xs text-zinc-300">
                    <summary className="cursor-pointer text-zinc-400">Les 5 hooks écrits et les 2 de rechange</summary>
                    <ul className="mt-2 space-y-1">{s.hook_candidates.map((h, i) => <li key={i}><span className="text-zinc-500">{h.mechanic} :</span> « {h.line} »</li>)}</ul>
                    <p className="mt-2 text-zinc-400">De rechange :</p>
                    <ul className="mt-1 space-y-1">{s.backup_hooks.map((h, i) => <li key={i}>« {h.line} » <span className="text-zinc-500">({h.image})</span></li>)}</ul>
                  </details>
                </Card>
                <Card>
                  <p className="label">A3 · Engagement</p>
                  <div className="mt-2 grid gap-3 text-xs sm:grid-cols-2">
                    <div><p className="text-zinc-500">Réplique culte</p><p className="mt-0.5 text-sm text-zinc-100">« {s.engagement.cult_line} »</p></div>
                    <div><p className="text-zinc-500">Commentaire visé</p><p className="mt-0.5 text-sm text-zinc-100">{s.engagement.target_comment}</p></div>
                    <div><p className="text-zinc-500">Leviers</p><ul className="mt-0.5 list-disc pl-4 text-zinc-300">{s.engagement.levers.map((l) => <li key={l}>{l}</li>)}</ul></div>
                    <div><p className="text-zinc-500">Références placées</p><ul className="mt-0.5 list-disc pl-4 text-zinc-300">{s.engagement.references.map((l) => <li key={l}>{l}</li>)}</ul></div>
                  </div>
                  <p className="mt-3 text-xs text-zinc-400">Note : <strong className="text-zinc-100">{Math.min(10, Object.values(s.engagement.scores).reduce((a, b) => a + b, 0))}/10</strong> · méchant {s.engagement.scores.villain}/2 · débat {s.engagement.scores.debate}/2 · réplique culte {s.engagement.scores.cult_line}/2 · partage {s.engagement.scores.share}/2 · « partie 2 vite » {s.engagement.scores.part2}/2 · détail +{s.engagement.scores.detail}</p>
                </Card>
                <div>
                  <p className="label mb-2">B · Découpage</p>
                  <ol className="space-y-2">
                    {s.clips.map((c, i) => {
                      const st = clipStats(c);
                      return (
                        <li key={i} className="surface p-4">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                            <span className="font-semibold text-zinc-100">Clip {i + 1}</span>
                            <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-violet-200">{c.seconds} s</span>
                            <span className="text-zinc-400">{c.location}</span>
                            <span className="text-zinc-500">{c.characters.join(', ')}</span>
                            <span className={cn('ml-auto tabular-nums', wpsTone(st.wps))}>{st.words} mots · {st.wps.toFixed(1)} mots/s</span>
                          </div>
                          <ul className="mt-2 space-y-1">
                            {c.lines.map((l, k) => <li key={k} className="text-sm text-zinc-300"><span className="tabular-nums text-[11px] text-zinc-500">{l.start.toFixed(1)}-{l.end.toFixed(1)}s</span> <strong className="text-zinc-100">{l.character}</strong> : « {l.text} »</li>)}
                          </ul>
                          <p className="mt-2 text-[11px] text-zinc-500">Question ouverte : {c.open_question} · Nouveau : {c.new_thing} · Mini-hook : {c.mini_hook}</p>
                        </li>
                      );
                    })}
                  </ol>
                </div>
                {adjust('script', <Button onClick={() => go('images')}>Valider → prompts image</Button>)}
              </div>
              <div className="space-y-4 self-start lg:sticky lg:top-4"><Checklist d={d} /></div>
            </div>
          )}

          {shown === 'images' && d.images && (
            <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
              <div className="min-w-0">
                <HowTo title="Mode d’emploi · ChatGPT (images)" steps={[
                  'Ouvrez une NOUVELLE discussion ChatGPT et générez d’abord la planche personnages.',
                  'Générez ensuite toutes les images DANS CETTE MÊME discussion, en JOIGNANT la planche à chaque message.',
                  'Vérifiez chaque image : tous les personnages qui parlent sont visibles, têtes et tenues identiques à la planche, aucun texte.',
                ]} />
                <PromptBlock title="C · Planche personnages" text={sheetPrompt(d)} open={{ url: 'https://chatgpt.com/', label: 'Ouvrir ChatGPT' }} />
                <div className="mt-3 grid gap-3">
                  {d.images.clips.map((_, i) => <PromptBlock key={i} title={`D · Image du clip ${i + 1}`} text={imagePrompt(d, i)} open={{ url: 'https://chatgpt.com/', label: 'Ouvrir ChatGPT' }} />)}
                </div>
                {adjust('images', <Button onClick={() => go('videos')}>Valider → prompts Grok</Button>)}
              </div>
              <div className="space-y-4 self-start lg:sticky lg:top-4"><Checklist d={d} /></div>
            </div>
          )}

          {shown === 'videos' && d.videos && s && (
            <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
              <div className="min-w-0">
                <HowTo title="Mode d’emploi · Grok Imagine (animation)" steps={[
                  'Chargez l’image du clip, choisissez Vidéo + 720p + la durée indiquée sur le clip, son activé, puis collez le prompt.',
                  'VÉRIFIEZ LA DURÉE à chaque fois : Grok repasse tout seul à 6 s.',
                  'Regardez chaque clip : le bon personnage parle, têtes et tenues stables, pas de musique ni de texte. Un clip raté se régénère, ou utilisez « Dépannage ».',
                ]} />
                <div className="grid gap-3">
                  {d.videos.clips.map((_, i) => (
                    <div key={i}>
                      <PromptBlock title={`E · Clip ${i + 1}`} text={grokPrompt(d, i)} open={{ url: 'https://grok.com/imagine', label: 'Ouvrir Grok' }}
                        badge={<span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">Durée Grok : {s.clips[i]?.seconds} s</span>}
                        extra={<button type="button" onClick={() => { setFixing(fixing === i ? null : i); setFixError(null); }}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs text-zinc-300 hover:bg-line/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"><Wrench className="h-3.5 w-3.5" /> Dépannage</button>} />
                      {d.fixes?.[i] && <p className="mt-1 px-1 text-[11px] text-emerald-300">Corrigé : {d.fixes[i]!.explanation}</p>}
                      {fixing === i && (
                        <Card className="mt-2">
                          <p className="text-xs font-medium text-zinc-200">Quel est le problème sur le clip {i + 1} ?</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {Object.entries(FIX_PROBLEMS).filter(([k]) => k !== 'hook' || i === 0).map(([k, p]) => (
                              <button key={k} type="button" onClick={() => setProblem(k)} aria-pressed={problem === k}
                                className={cn('rounded-full border px-3 py-1.5 text-xs', problem === k ? 'border-violet-600 bg-violet-600 text-white' : 'border-line/10 text-zinc-300 hover:bg-line/[0.05]')}>{p.label}</button>
                            ))}
                          </div>
                          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={400} placeholder="Précision (facultatif) : ce qui se passe dans le clip raté"
                            className="mt-2 h-11 w-full rounded-xl border border-line/10 bg-transparent px-3 text-base text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 sm:h-10 sm:text-sm" />
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Button size="sm" loading={fixBusy} onClick={() => void fix(i)}>Corriger ce clip</Button>
                            <span className="text-[11px] text-zinc-500">Inclus dans le projet. Le prompt d’image du clip est aussi mis à jour si besoin.</span>
                          </div>
                          {fixError && <p role="alert" className="mt-2 text-xs text-coral-300">{fixError}</p>}
                        </Card>
                      )}
                    </div>
                  ))}
                </div>
                {adjust('videos', <Button onClick={() => go('pack')}>Valider → couverture & légende</Button>)}
              </div>
              <div className="space-y-4 self-start lg:sticky lg:top-4"><Checklist d={d} /></div>
            </div>
          )}

          {shown === 'pack' && d.pack && s && (
            <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
              <div className="min-w-0">
                <PromptBlock title="F · Couverture (3:4, à joindre avec la planche)" text={coverPrompt(d)} open={{ url: 'https://chatgpt.com/', label: 'Ouvrir ChatGPT' }} />
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Card>
                    <div className="flex items-center justify-between"><p className="text-xs text-zinc-500">G · Légende + hashtags</p><CopyBtn text={`${d.pack.caption}\n\n${d.pack.hashtags.join(' ')}`} /></div>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm text-zinc-200">{d.pack.caption}</p>
                    <p className="mt-2 break-words text-xs text-violet-300">{d.pack.hashtags.join(' ')}</p>
                  </Card>
                  <Card>
                    <div className="flex items-center justify-between"><p className="text-xs text-zinc-500">Commentaire épinglé (dans les 5 minutes)</p><CopyBtn text={d.pack.pinned_comment} /></div>
                    <p className="mt-2 text-sm text-zinc-200">{d.pack.pinned_comment}</p>
                  </Card>
                </div>
                <div className="mt-4">
                  <HowTo title="Mode d’emploi · CapCut (montage)" steps={[
                    'Mettez les clips bord à bord, sans transition.',
                    'Coupez CHAQUE blanc de plus de 0,2 s.',
                    'Passez en 1,1x un clip qui parle mou (jamais plus de 1,15x).',
                    'Gardez 0,5 s de silence seulement sur le visage final.',
                    'La vidéo doit dépasser 60 s. Activez le label « contenu généré par IA » à la publication.',
                  ]} />
                </div>
                <Card className="text-sm text-zinc-300">Projet terminé. Une fois la vidéo montée, importez-la dans la <Link to="/app/library" className="text-violet-300 underline">bibliothèque</Link>. Pour la suite, créez un nouveau projet « Partie {d.part + 1} » en collant la fin de celle-ci.</Card>
                {adjust('pack')}
              </div>
              <div className="space-y-4 self-start lg:sticky lg:top-4"><Checklist d={d} /></div>
            </div>
          )}
          {s && checklist(d).some((c) => !c.ok) && shown !== 'concepts' && (
            <p className="mt-4 flex items-center gap-1.5 text-[11px] text-amber-300 lg:hidden"><AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Certains points de la checklist sont à revoir (voir le panneau).</p>
          )}
        </>
      )}
    </>
  );
}
