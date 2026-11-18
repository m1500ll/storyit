import { Clapperboard, Play, RotateCcw, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { universeScene } from '@/components/characters/UniverseGrid';
import { cn } from '@/lib/cn';
import type { Universe } from '@shared/characters.ts';

/** The "wow" moment once a story is written, before the paid video: a cinematic trailer of THEIR story, made in the
 *  browser from what already exists (the universe scene, their characters' pictures, their dialogue lines, a music
 *  track). No AI call, no cost. It ends on the button that creates the real video. */

export interface TrailerLine { character: string; text: string }
const DEFAULT_TRACK = 'deep-slowed';
const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** how long a line stays on screen: about the time to read it */
const lineMs = (text: string) => Math.min(3400, Math.max(1900, text.split(/\s+/).length * 330 + 700));

export function StoryTrailer({ title, universe, lines, cast, music, onCreate, createLabel, className }: {
  title: string; universe: Universe; lines: TrailerLine[]; cast: { name: string; image: string | null }[];
  music: string | null; onCreate: () => void; createLabel: string; className?: string;
}) {
  const shown = useMemo(() => lines.filter((l) => l.text?.trim()).slice(0, 6), [lines]);
  // -1 = poster, 0 = title card, 1..n = lines, n + 1 = end card
  const [scene, setScene] = useState(-1);
  const [word, setWord] = useState(0);
  const [muted, setMuted] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const end = shown.length + 1;

  // scene timeline
  useEffect(() => {
    if (scene < 0 || scene >= end) return;
    const ms = scene === 0 ? 2200 : lineMs(shown[scene - 1]!.text);
    const t = setTimeout(() => setScene((s) => s + 1), ms);
    return () => clearTimeout(t);
  }, [scene, end, shown]);
  // the words of the current line appear one by one, the spoken one in yellow
  useEffect(() => {
    setWord(0);
    if (scene < 1 || scene > shown.length) return;
    const words = shown[scene - 1]!.text.split(/\s+/).length;
    const step = Math.max(140, (lineMs(shown[scene - 1]!.text) - 500) / words);
    const t = setInterval(() => setWord((w) => Math.min(words, w + 1)), step);
    return () => clearInterval(t);
  }, [scene, shown]);
  // music: fades out on the end card
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    if (scene === end) { const f = setInterval(() => { a.volume = Math.max(0, a.volume - 0.05); if (a.volume <= 0.05) { a.pause(); clearInterval(f); } }, 80); return () => clearInterval(f); }
  }, [scene, end]);
  useEffect(() => () => { audio.current?.pause(); }, []);
  useEffect(() => { if (audio.current) audio.current.muted = muted; }, [muted]);

  const play = () => {
    audio.current?.pause();
    const track = music && /^[a-z0-9-]+$/.test(music) ? music : DEFAULT_TRACK;
    const a = new Audio(`/music/${track}.mp3`);
    a.volume = 0.55; a.muted = muted;
    void a.play().catch(() => undefined);
    audio.current = a;
    setScene(0);
  };

  const line = scene >= 1 && scene <= shown.length ? shown[scene - 1]! : null;
  const speaker = line ? cast.find((c) => c.name.toLowerCase() === line.character.toLowerCase()) : null;
  const words = line ? line.text.split(/\s+/) : [];
  const still = reduced();

  return (
    <figure className={cn('relative mx-auto aspect-[9/16] w-full max-w-[300px] overflow-hidden rounded-[1.75rem] border-[5px] border-zinc-900 bg-black shadow-[0_30px_80px_-20px_rgba(168,85,247,0.6)]', className)}
      aria-label={`Bande-annonce de ton histoire « ${title} »`}>
      {/* the universe, drifting slowly (a different framing for every line) */}
      <img key={scene} src={universeScene(universe)} alt="" className={cn('absolute inset-0 h-full w-full object-cover', !still && 'anim-fadein')}
        style={{ transform: `scale(${1.15 + (Math.max(0, scene) % 3) * 0.08}) translate(${(scene % 2 ? -1 : 1) * 3}%, ${(scene % 3) - 1}%)`, transition: still ? undefined : 'transform 3.5s ease-out' }} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/10 to-black/80" />

      {scene === -1 && (
        <button type="button" onClick={play} className="group absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-violet-400">
          <span className="rounded-full border border-white/20 bg-black/50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-200 backdrop-blur">Ton histoire est écrite</span>
          <span className="text-balance font-display text-2xl leading-tight text-white [text-shadow:0_2px_12px_rgba(0,0,0,.8)]">{title}</span>
          <span className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-[0_0_40px_-4px_rgba(217,70,239,0.9)] ring-4 ring-white/20 transition group-hover:scale-105">
            <Play className="ml-1 h-7 w-7" fill="currentColor" aria-hidden />
          </span>
          <span className="text-sm font-semibold text-white">Voir la bande-annonce</span>
        </button>
      )}

      {scene === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
          <p className={cn('text-[10px] font-bold uppercase tracking-[0.3em] text-fuchsia-200', !still && 'anim-fadein')}>Storyit présente</p>
          <p className={cn('mt-3 text-balance font-display text-3xl leading-tight text-white [text-shadow:0_4px_20px_rgba(0,0,0,.9)]', !still && 'anim-popin')}>{title}</p>
        </div>
      )}

      {line && (
        <>
          {speaker?.image && (
            <div key={`s${scene}`} className={cn('absolute inset-x-0 bottom-[18%] flex justify-center', !still && 'anim-popin')}>
              <div className="h-[58%] w-[78%] overflow-hidden rounded-[1.5rem] border-2 border-white/30 shadow-[0_20px_60px_-10px_rgba(0,0,0,.8)]">
                <img src={speaker.image} alt="" className="h-full w-full object-cover object-[12%_0%] [transform:scale(2.1)] [transform-origin:12%_0%]" />
              </div>
            </div>
          )}
          <div className="absolute inset-x-0 top-0 p-3">
            <span key={`n${scene}`} className={cn('inline-block rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white backdrop-blur', !still && 'anim-popin')}>{line.character}</span>
          </div>
          <p className="absolute inset-x-0 bottom-[8%] px-4 text-center font-display text-[19px] font-extrabold uppercase leading-tight text-white [text-shadow:0_2px_0_#000,0_-2px_0_#000,2px_0_0_#000,-2px_0_0_#000,0_4px_14px_rgba(0,0,0,.7)]">
            {words.map((w, i) => (
              <span key={i} className={cn('mr-1 inline-block transition-opacity duration-150', i < word ? 'opacity-100' : still ? 'opacity-100' : 'opacity-0', i === word - 1 && 'text-yellow-300')}>{w}</span>
            ))}
          </p>
        </>
      )}

      {scene === end && (
        <div className={cn('absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 p-6 text-center backdrop-blur-sm', !still && 'anim-fadein')}>
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white"><Clapperboard className="h-6 w-6" aria-hidden /></span>
          <p className="text-balance font-display text-2xl leading-tight text-white">Maintenant, en vraie vidéo ?</p>
          <p className="text-xs text-white/75">Personnages animés, vraies voix, sous-titres et musique.</p>
          <button type="button" onClick={onCreate}
            className="touch-hit mt-1 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_0_30px_-6px_rgba(217,70,239,0.9)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            <Sparkles className="h-4 w-4" aria-hidden /> {createLabel}
          </button>
          <button type="button" onClick={play} className="touch-hit inline-flex items-center gap-1 rounded text-xs text-white/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><RotateCcw className="h-3 w-3" aria-hidden /> Revoir</button>
        </div>
      )}

      {scene >= 0 && scene < end && (
        <>
          <div className="absolute inset-x-3 bottom-2 flex gap-1" aria-hidden>
            {Array.from({ length: end }, (_, i) => <span key={i} className={cn('h-1 flex-1 rounded-full', i <= scene ? 'bg-white' : 'bg-white/25')} />)}
          </div>
          <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Remettre la musique' : 'Couper la musique'}
            className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </>
      )}
    </figure>
  );
}
