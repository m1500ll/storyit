import { ArrowLeft, ArrowRight, Check, Lightbulb, Music, Pause, Play, Sparkles, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, useToast } from '@/components/ui';
import { usePaywall } from '@/components/billing/Paywall';
import { CastPicker } from '@/components/characters/CastPicker';
import { UniverseGrid } from '@/components/characters/UniverseGrid';
import { cn } from '@/lib/cn';
import { InsufficientCreditsError } from '@/services/errors';
import { formatCredits, PROMPT_PROJECT_COST } from '@/services/credits';
import { promptStudio } from '@/services/promptStudio';
import { useCredits } from '@/hooks/useStore';
import { UNIVERSES, type Universe } from '@shared/characters.ts';
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
  const [music, setMusic] = useState<string | null>(MUSIC_TRACKS[1]!.id);
  const [story, setStory] = useState('');
  const [busy, setBusy] = useState(false);
  const [ideaBusy, setIdeaBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
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
    const a = new Audio(`/music/${id}.mp3`); a.volume = 0.6; a.onended = () => setPlaying(null);
    void a.play().then(() => setPlaying(id)).catch(() => setPlaying(null));
    audio.current = a;
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
    <div ref={top} className="mx-auto max-w-3xl scroll-mt-24">
      <ol className="grid grid-cols-5 gap-1.5" aria-label="Étapes">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" onClick={() => i < step && go(i)} disabled={i >= step} aria-current={i === step ? 'step' : undefined} aria-label={`Étape ${i + 1} : ${s}`}
              className="touch-hit block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 disabled:cursor-default">
              <span className={cn('block h-1.5 rounded-full transition-colors', i <= step ? 'bg-violet-500' : 'bg-line/10')} />
              <span className={cn('mt-1.5 hidden truncate text-[11px] sm:block', i === step ? 'text-zinc-100' : 'text-zinc-500')}>{s}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-6">
        {step === 0 && (
          <section aria-labelledby="w-uni">
            <h2 id="w-uni" className="text-balance font-display text-2xl text-zinc-50">Choisis ton univers</h2>
            <p className="mt-1 text-sm text-zinc-400">Le style visuel s’applique à toutes les images et scènes de ta vidéo.</p>
            <div className="mt-4"><UniverseGrid value={universe} onChange={setUniverse} label="Univers de la vidéo" cols="grid-cols-3 sm:grid-cols-5" /></div>
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
                  <span className="block font-display text-3xl text-zinc-50">{lengthLabel(l)}</span>
                  <span className={cn('mt-1 block text-xs', l === 60 ? 'text-emerald-300' : 'text-zinc-400')}>{LENGTH_HINT[l]}</span>
                  <span className="mt-3 block text-sm font-semibold tabular-nums text-violet-300">{formatCredits(total(l))} crédits</span>
                  {length === l && <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-violet-600 text-white"><Check className="h-3.5 w-3.5" aria-hidden /></span>}
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
            <h3 className="mt-6 text-sm font-semibold text-zinc-100">Musique de fond <span className="font-normal text-zinc-500">· musiques originales Storyit, sans droits d’auteur</span></h3>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Musique de fond">
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
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-line/[0.06] text-zinc-100 hover:bg-violet-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60">
                    {playing === m.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                  <button type="button" role="radio" aria-checked={music === m.id} onClick={() => setMusic(m.id)} className="flex h-full min-w-0 flex-1 items-center justify-between gap-2 text-left focus-visible:outline-none">
                    <span className="min-w-0"><span className="block truncate text-sm font-medium text-zinc-100">{m.title}</span><span className="block text-[11px] text-zinc-500">{m.mood}</span></span>
                    {music === m.id ? <Check className="h-4 w-4 shrink-0 text-violet-300" aria-hidden /> : <Music className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden />}
                  </button>
                </li>
              ))}
            </ul>
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
              <div className="flex justify-between gap-3"><dt className="text-zinc-400">Musique · {MUSIC_TRACKS.find((x) => x.id === music)?.title ?? 'aucune'}</dt><dd className="text-emerald-300">Inclus</dd></div>
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
          ? <Button onClick={() => go(step + 1)}>Suivant <ArrowRight className="h-4 w-4" /></Button>
          : <Button disabled={!promptStudio.available || !story.trim()} onClick={() => void generate()}><Sparkles className="h-4 w-4" /> Générer · {formatCredits(total(length))} crédits</Button>}
      </div>
    </div>
  );
}
