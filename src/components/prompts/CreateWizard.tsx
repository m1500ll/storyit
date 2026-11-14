import { ArrowLeft, ArrowRight, Check, Lightbulb, Music, Pause, Play, Sparkles, Upload, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, useToast } from '@/components/ui';
import { usePaywall } from '@/components/billing/Paywall';
import { CastPicker } from '@/components/characters/CastPicker';
import { UniverseGrid, universeScene } from '@/components/characters/UniverseGrid';
import { WizardPreview } from './WizardPreview';
import { characters } from '@/services/characters';
import { uploadMusic } from '@/services/music';
import { useLiveQuery } from '@/hooks/useStore';
import { cn } from '@/lib/cn';
import { InsufficientCreditsError } from '@/services/errors';
import { formatCredits, PROMPT_PROJECT_COST } from '@/services/credits';
import { promptStudio } from '@/services/promptStudio';
import { useCredits } from '@/hooks/useStore';
import { LIBRARY, librarySheet, UNIVERSES, type Universe } from '@shared/characters.ts';
import { MUSIC_TRACKS, SUBTITLE_STYLES, VIDEO_PRICES, type SubtitleStyle } from '@shared/promptVideo.ts';
import { DEFAULT_VIDEO_LENGTH, lengthLabel, VIDEO_LENGTHS, type VideoLength } from '@shared/promptVideo.ts';

const STEPS = ['Univers', 'Personnages', 'Durée', 'Personnalise', 'Ton histoire'] as const;
const LENGTH_HINT: Record<VideoLength, string> = { 30: 'Court et percutant', 45: 'Recommandé', 60: 'Rémunérée par TikTok' };
const total = (len: VideoLength) => PROMPT_PROJECT_COST + VIDEO_PRICES.eco[len];

/** what the subtitle tile shows (a small imitation of the burned-in style) */
function SubtitleSample({ id }: { id: SubtitleStyle }) {
  if (id === 'none') return <span className="text-xs text-zinc-400">Sans sous-titres</span>;
  const base = 'font-display text-lg leading-none tracking-tight [text-shadow:0_2px_0_#000,0_-2px_0_#000,2px_0_0_#000,-2px_0_0_#000]';
  if (id === 'karaoke') return <span className={base}><span className="text-yellow-300">TU M’AS</span> <span className="text-white">MENTI</span></span>;
  if (id === 'italique') return <span className={cn(base, 'italic text-white')}>tu m’as menti</span>;
  return <span className={cn(base, 'text-white')}>TU M’AS MENTI</span>;
}

function Bars({ on }: { on: boolean }) {
  return (
    <span className="flex h-4 items-end gap-[2px]" aria-hidden>
      {[0, 1, 2, 3].map((i) => <span key={i} className={cn('w-[3px] rounded-full', on ? 'anim-eq h-4 bg-violet-400' : 'h-1.5 bg-zinc-600')} style={on ? { animationDelay: `${i * 0.13}s` } : undefined} />)}
    </span>
  );
}

/** The video wizard: universe → characters → length → subtitles & music → story; "Générer" runs everything by itself. */
export function CreateWizard() {
  const navigate = useNavigate();
  const toast = useToast();
  const openPaywall = usePaywall();
  const [step, setStep] = useState(0);
  const [universe, setUniverse] = useState<Universe>('fruits');
  const [cast, setCast] = useState<string[]>([]);
  const [length, setLength] = useState<VideoLength>(DEFAULT_VIDEO_LENGTH);
  const [subtitles, setSubtitles] = useState<SubtitleStyle>('karaoke');
  const [music, setMusic] = useState<string | null>('yara-yara');
  const [story, setStory] = useState('');
  const [busy, setBusy] = useState(false);
  const [ideaBusy, setIdeaBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [musicTab, setMusicTab] = useState<'library' | 'upload'>('library');
  const [upload, setUpload] = useState<{ name: string; value: string; url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [rights, setRights] = useState(false);
  const { data: mine = [] } = useLiveQuery(() => characters.list(), 'user-characters');
  const castCards = cast.map((id) => {
    const lib = LIBRARY.find((c) => `lib:${c.slug}` === id);
    const own = mine.find((c) => c.id === id);
    return { id, name: lib?.name ?? own?.name ?? '', image: lib ? librarySheet(lib.slug) : own?.sheet_url ?? null };
  });
  const audio = useRef<HTMLAudioElement | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const { balance, known } = useCredits();
  // a trial (7,000 credits) pays for 30 s, not 45 s: start on the longest length the balance covers
  const picked = useRef(false);
  useEffect(() => {
    if (!known || picked.current) return;
    picked.current = true;
    if (balance < total(DEFAULT_VIDEO_LENGTH)) setLength([...VIDEO_LENGTHS].reverse().find((l) => total(l) <= balance) ?? 30);
  }, [known, balance]);

  useEffect(() => () => { audio.current?.pause(); }, []);
  useEffect(() => { if (step !== 3) { audio.current?.pause(); setPlaying(null); } }, [step]);
  const pick = (l: VideoLength) => { picked.current = true; setLength(l); };
  const go = (n: number) => { setStep(n); setError(null); top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  const preview = (id: string) => {
    if (playing === id) { audio.current?.pause(); setPlaying(null); return; }
    audio.current?.pause();
    const a = new Audio(id === 'upload' ? upload?.url ?? '' : `/music/${id}.mp3`); a.volume = 0.6; a.onended = () => setPlaying(null);
    void a.play().then(() => setPlaying(id)).catch(() => setPlaying(null));
    audio.current = a;
  };
  const pickFile = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true); setError(null);
    try {
      const value = await uploadMusic(f);
      setUpload({ name: f.name, value, url: URL.createObjectURL(f) }); setMusic(value); setRights(false);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setUploading(false); }
  };
  const idea = async () => {
    setIdeaBusy(true); setError(null);
    try { setStory(await promptStudio.storyIdea(universe, cast)); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setIdeaBusy(false); }
  };
  const generate = async () => {
    setBusy(true); setError(null);
    try {
      const p = await promptStudio.generate({ phase: 'script', story, universe, cast, length, auto: { subtitles, music } });
      toast('C’est parti : votre vidéo se crée toute seule.');
      navigate(`/app/prompts/${p.id}`);
    } catch (e) {
      if (e instanceof InsufficientCreditsError || /insuffisants/i.test(String(e))) openPaywall();
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  if (busy) return (
    <Card role="status" aria-live="polite" className="mx-auto max-w-2xl">
      <p className="flex items-center gap-2 text-sm font-semibold text-zinc-100"><Sparkles className="h-4 w-4 animate-pulse text-violet-300 motion-reduce:animate-none" aria-hidden /> Écriture de votre histoire et des dialogues…</p>
      <p className="mt-1 text-xs text-zinc-500">Environ 1 minute. Ensuite tout continue tout seul : les scènes, l’animation et le montage. Vous pourrez quitter la page.</p>
      <div className="mt-4 space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-line/[0.05] motion-reduce:animate-none" />)}</div>
    </Card>
  );

  return (
    <div ref={top} className="mx-auto grid max-w-6xl scroll-mt-24 gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
     <div className="min-w-0">
      <ol className="grid grid-cols-5 gap-1.5" aria-label="Étapes">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" onClick={() => i < step && go(i)} disabled={i >= step} aria-current={i === step ? 'step' : undefined} aria-label={`Étape ${i + 1} : ${s}`}
              className="touch-hit block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 disabled:cursor-default">
              <span className="block h-1.5 overflow-hidden rounded-full bg-line/10"><span className={cn('block h-full rounded-full bg-gradient-to-r from-violet-500 to-coral-400 transition-[width] duration-500 ease-out', i <= step ? 'w-full' : 'w-0')} /></span>
              <span className={cn('mt-1.5 hidden truncate text-[11px] sm:block', i === step ? 'text-zinc-100' : 'text-zinc-500')}>{s}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-5 flex items-center gap-4 lg:hidden">
        <WizardPreview mini className="w-20 shrink-0 rounded-2xl border-[3px]" universe={universe} cast={castCards} length={length} subtitles={subtitles} music={music} story="" />
        <p className="min-w-0 text-xs text-zinc-400"><span className="block font-semibold text-zinc-200">{UNIVERSES[universe].label} · {lengthLabel(length)}</span>{cast.length ? `${cast.length} personnage${cast.length > 1 ? 's' : ''} · ` : ''}{subtitles === 'none' ? 'sans sous-titres' : `sous-titres ${SUBTITLE_STYLES.find((x) => x.id === subtitles)?.label.toLowerCase()}`} · {music ? 'musique' : 'sans musique'}</p>
      </div>
      <div key={step} className="anim-stepin mt-6 motion-reduce:animate-none">
        {step === 0 && (
          <section aria-labelledby="w-uni">
            <h2 id="w-uni" className="text-balance font-display text-2xl text-zinc-50">Choisis ton univers</h2>
            <p className="mt-1 text-sm text-zinc-400">Le style visuel s’applique à toutes les images et scènes de ta vidéo.</p>
            <div className="mt-4"><UniverseGrid value={universe} onChange={setUniverse} label="Univers de la vidéo" cols="grid-cols-3 sm:grid-cols-4 xl:grid-cols-5" imageFor={universeScene} /></div>
            <p className="mt-2 text-xs text-zinc-500">{UNIVERSES[universe].hint.replace(/…$/, '')}.</p>
          </section>
        )}

        {step === 1 && (
          <section aria-labelledby="w-cast">
            <h2 id="w-cast" className="text-balance font-display text-2xl text-zinc-50">Choisis tes personnages</h2>
            <p className="mt-1 text-sm text-zinc-400">Les mêmes visages et les mêmes tenues dans toute ta série. Facultatif.</p>
            <div className="mt-4"><CastPicker value={cast} onChange={setCast} /></div>
          </section>
        )}

        {step === 2 && (
          <section aria-labelledby="w-len">
            <h2 id="w-len" className="text-balance font-display text-2xl text-zinc-50">Choisis la durée</h2>
            <p className="mt-1 text-sm text-zinc-400">L’histoire est écrite pour cette durée. Le prix comprend l’histoire et la vidéo finie.</p>
            <div role="radiogroup" aria-label="Durée de la vidéo" className="mt-4 grid gap-3 sm:grid-cols-3">
              {VIDEO_LENGTHS.map((l) => (
                <button key={l} type="button" role="radio" aria-checked={length === l} onClick={() => pick(l)}
                  className={cn('surface relative px-4 py-5 text-left transition [touch-action:manipulation] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60',
                    length === l ? 'border-violet-500 ring-2 ring-violet-500/40' : 'hover:border-violet-400/40')}>
                  <span className="flex h-6 items-end gap-1" aria-hidden>{Array.from({ length: l / 15 + 1 }, (_, k) => <span key={k} className={cn('w-2 rounded-sm transition-all duration-500', length === l ? 'bg-gradient-to-t from-violet-500 to-coral-400' : 'bg-line/15')} style={{ height: `${40 + k * 18}%` }} />)}</span>
                  <span className="mt-3 block font-display text-3xl text-zinc-50">{lengthLabel(l)}</span>
                  <span className={cn('mt-1 block text-xs', l === 60 ? 'text-emerald-300' : 'text-zinc-400')}>{LENGTH_HINT[l]}</span>
                  <span className="mt-3 block text-sm font-semibold tabular-nums text-violet-300">{formatCredits(total(l))} crédits</span>
                  {length === l && <span className="anim-popin absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-violet-600 text-white"><Check className="h-3.5 w-3.5" aria-hidden /></span>}
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 3 && (
          <section aria-labelledby="w-opt">
            <h2 id="w-opt" className="text-balance font-display text-2xl text-zinc-50">Personnalise ta vidéo</h2>
            <p className="mt-1 text-sm text-zinc-400">Sous-titres et musique de fond, inclus sans supplément.</p>
            <h3 className="mt-5 text-sm font-semibold text-zinc-100">Sous-titres</h3>
            <div role="radiogroup" aria-label="Style des sous-titres" className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SUBTITLE_STYLES.map((st) => (
                <button key={st.id} type="button" role="radio" aria-checked={subtitles === st.id} onClick={() => setSubtitles(st.id)}
                  className={cn('surface overflow-hidden text-center transition [touch-action:manipulation] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60',
                    subtitles === st.id ? 'border-violet-500 ring-2 ring-violet-500/40' : 'hover:border-violet-400/40')}>
                  <span className="grid h-20 place-items-center bg-gradient-to-b from-zinc-700 to-zinc-900 px-2"><SubtitleSample id={st.id} /></span>
                  <span className={cn('block py-2 text-xs font-medium', subtitles === st.id ? 'text-violet-200' : 'text-zinc-300')}>{st.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-100">Musique de fond</h3>
              <div role="tablist" aria-label="Source de la musique" className="inline-flex rounded-xl border border-line/10 p-0.5">
                {(['library', 'upload'] as const).map((t) => (
                  <button key={t} type="button" role="tab" aria-selected={musicTab === t} onClick={() => setMusicTab(t)}
                    className={cn('h-9 rounded-lg px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60', musicTab === t ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-zinc-100')}>
                    {t === 'library' ? 'Musiques Storyit' : 'Importer ma musique'}
                  </button>
                ))}
              </div>
            </div>
            {musicTab === 'library' ? (
              <ul className="anim-stepin mt-2 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Musique de fond">
                <li>
                  <button type="button" role="radio" aria-checked={music === null} onClick={() => setMusic(null)}
                    className={cn('surface flex h-14 w-full items-center gap-3 px-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60',
                      music === null ? 'border-violet-500 ring-2 ring-violet-500/40' : 'hover:border-violet-400/40')}>
                    <VolumeX className="h-5 w-5 text-zinc-500" aria-hidden /> <span className="font-medium text-zinc-100">Sans musique</span>
                  </button>
                </li>
                {MUSIC_TRACKS.map((m) => (
                  <li key={m.id} className={cn('surface flex h-14 items-center gap-2 pl-2 pr-3 transition', music === m.id ? 'border-violet-500 ring-2 ring-violet-500/40' : 'hover:border-violet-400/40')}>
                    <button type="button" onClick={() => preview(m.id)} aria-label={playing === m.id ? `Arrêter ${m.title}` : `Écouter ${m.title}`}
                      className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60', playing === m.id ? 'bg-violet-600 text-white' : 'bg-line/[0.06] text-zinc-100 hover:bg-violet-500/20')}>
                      {playing === m.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button type="button" role="radio" aria-checked={music === m.id} onClick={() => setMusic(m.id)} className="flex h-full min-w-0 flex-1 items-center justify-between gap-2 text-left focus-visible:outline-none">
                      <span className="min-w-0"><span className="block truncate text-sm font-medium text-zinc-100">{m.title}</span><span className="block text-[11px] text-zinc-500">{m.mood}</span></span>
                      {playing === m.id ? <Bars on /> : music === m.id ? <Check className="h-4 w-4 shrink-0 text-violet-300" aria-hidden /> : <Music className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden />}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="anim-stepin mt-2">
                {upload ? (
                  <div className={cn('surface flex h-14 items-center gap-2 pl-2 pr-3', music === upload.value ? 'border-violet-500 ring-2 ring-violet-500/40' : '')}>
                    <button type="button" onClick={() => preview('upload')} aria-label={playing === 'upload' ? 'Arrêter' : 'Écouter'}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-line/[0.06] text-zinc-100 hover:bg-violet-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60">
                      {playing === 'upload' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button type="button" onClick={() => setMusic(upload.value)} className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left">
                      <span className="truncate text-sm font-medium text-zinc-100">{upload.name}</span>
                      {playing === 'upload' ? <Bars on /> : <Check className={cn('h-4 w-4', music === upload.value ? 'text-violet-300' : 'text-transparent')} aria-hidden />}
                    </button>
                  </div>
                ) : null}
                <label className={cn('mt-2 flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed border-line/15 px-4 py-5 text-center text-xs text-zinc-400 hover:border-violet-400/50 hover:text-zinc-200 focus-within:ring-2 focus-within:ring-violet-500/50', uploading && 'opacity-60')}>
                  <Upload className="h-5 w-5" aria-hidden />{uploading ? 'Import en cours…' : upload ? 'Changer de fichier' : 'Choisir un fichier audio'}
                  <span className="text-[11px] text-zinc-500">MP3, M4A, WAV ou OGG · 15 Mo max</span>
                  <input type="file" accept="audio/*" className="sr-only" disabled={uploading} onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ''; }} />
                </label>
                {upload && (
                  <label className="mt-3 flex items-start gap-2 text-xs text-zinc-300">
                    <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-violet-500" />
                    J’ai le droit d’utiliser cette musique. Je sais qu’un son protégé peut faire couper le son ou bloquer la vidéo sur TikTok.
                  </label>
                )}
              </div>
            )}
            <p className="mt-3 rounded-xl bg-violet-500/[0.07] px-3 py-2 text-xs text-zinc-300">Astuce : pour un son tendance (phonk, funk, mème…), choisissez « Sans musique » ici puis ajoutez le son directement dans TikTok. Il est sous licence et la tendance aide votre vidéo à percer.</p>
          </section>
        )}

        {step === 4 && (
          <section aria-labelledby="w-story">
            <h2 id="w-story" className="text-balance font-display text-2xl text-zinc-50">Décris ta vidéo</h2>
            <p className="mt-1 text-sm text-zinc-400">Quelques lignes suffisent, même en vrac : le studio écrit l’histoire, les dialogues et les scènes.</p>
            <label htmlFor="w-story-text" className="sr-only">Ton histoire</label>
            <textarea id="w-story-text" rows={5} maxLength={3000} value={story} onChange={(e) => setStory(e.target.value)}
              placeholder="Un homme grenade apprend que sa fille n’est pas la sienne : sa femme avoue après quinze ans de mensonge…"
              className="mt-4 w-full rounded-xl border border-line/10 bg-transparent p-3 text-base text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 sm:text-sm" />
            <button type="button" onClick={() => void idea()} disabled={ideaBusy}
              className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line/10 text-sm text-zinc-300 hover:border-violet-400/50 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 disabled:opacity-60">
              <Lightbulb className="h-4 w-4" aria-hidden /> {ideaBusy ? 'Idée en cours…' : 'Propose-moi une idée'}
            </button>
            <dl className="surface mt-5 space-y-2 p-4 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-zinc-400">Histoire, dialogues et scènes</dt><dd className="tabular-nums text-zinc-100">{formatCredits(PROMPT_PROJECT_COST)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-zinc-400">Vidéo finie · {lengthLabel(length)} · {UNIVERSES[universe].label}</dt><dd className="tabular-nums text-zinc-100">{formatCredits(VIDEO_PRICES.eco[length])}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-zinc-400">Sous-titres · {SUBTITLE_STYLES.find((x) => x.id === subtitles)?.label}</dt><dd className="text-emerald-300">Inclus</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-zinc-400">Musique · {upload && music === upload.value ? upload.name : MUSIC_TRACKS.find((x) => x.id === music)?.title ?? 'aucune'}</dt><dd className="text-emerald-300">Inclus</dd></div>
              <div className="flex justify-between gap-3 border-t border-line/10 pt-2 font-semibold"><dt className="text-zinc-100">Total</dt><dd className="tabular-nums text-violet-300">{formatCredits(total(length))} crédits</dd></div>
            </dl>
            <p className="mt-2 text-xs text-zinc-500">Débité au lancement. Si la vidéo ne peut pas être créée, les crédits de la vidéo sont rendus automatiquement.</p>
          </section>
        )}
      </div>

      {error && <p role="alert" aria-live="polite" className="mt-4 text-sm text-coral-300">{error}</p>}
      <div className="mt-6 flex items-center justify-between gap-3">
        {step > 0 ? <Button variant="secondary" onClick={() => go(step - 1)}><ArrowLeft className="h-4 w-4" /> Retour</Button> : <span />}
        {step < 4
          ? <Button disabled={step === 3 && !!upload && music === upload.value && !rights} onClick={() => go(step + 1)}>Suivant <ArrowRight className="h-4 w-4" /></Button>
          : <Button disabled={!promptStudio.available || !story.trim()} onClick={() => void generate()}><Sparkles className="h-4 w-4" /> Générer · {formatCredits(total(length))} crédits</Button>}
      </div>
     </div>
     <aside className="hidden lg:block" aria-label="Aperçu de la vidéo">
       <div className="sticky top-24">
         <WizardPreview universe={universe} cast={castCards} length={length} subtitles={subtitles} music={music} story={story} />
         <p className="mt-3 text-center text-xs text-zinc-500">Aperçu : ta vidéo prend forme à chaque choix</p>
       </div>
     </aside>
    </div>
  );
}
