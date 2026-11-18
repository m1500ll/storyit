import { ArrowRight, Gift, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '@/hooks/useStore';
import { cn } from '@/lib/cn';
import { formatCredits } from '@/services/credits';

/** The "wow" right after sign-up, shown once: real Storyit videos fly in around a playing one, the welcome credits
 *  count up, and one button opens the video wizard. Real outputs only (public/showcase, made with Storyit). */

const SEEN = 'storyit:welcome-seen';
const VIDEOS = ['chevelure-sans-fin', 'banane-honnete', 'plaque-de-cuisson', 'mensonge-mere', 'cache-oreilles'];
const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function seen() { try { return localStorage.getItem(SEEN) === '1'; } catch { return true; } }

export function WelcomeIntro() {
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [credits, setCredits] = useState(0);
  const target = profile?.credit_balance ?? 3000;

  // new accounts only (created in the last 3 days, never shown on this device)
  useEffect(() => {
    if (!profile || seen()) return;
    const age = Date.now() - Date.parse(profile.created_at);
    if (age < 3 * 86_400_000) setOpen(true);
  }, [profile]);

  // the welcome credits count up
  useEffect(() => {
    if (!open) return;
    if (reduced()) { setCredits(target); return; }
    const t0 = performance.now(); let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0 - 900) / 1400);
      setCredits(Math.round(Math.max(0, k) ** 0.6 * target));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, target]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const close = () => { try { localStorage.setItem(SEEN, '1'); } catch { /* private mode */ } setOpen(false); };
  const start = () => { close(); navigate('/app/prompts'); };
  if (!open) return null;
  const still = reduced();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden overscroll-contain bg-[#07040f]/95 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/3 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-600/25 blur-[120px]" />
      <button type="button" onClick={close} aria-label="Fermer" className="touch-hit absolute right-4 top-4 rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"><X className="h-5 w-5" /></button>

      <div className="relative flex w-full max-w-3xl flex-col items-center text-center">
        {/* real Storyit videos fanning in, the middle one playing */}
        <div aria-hidden className="relative h-[300px] w-full sm:h-[360px]">
          {VIDEOS.map((slug, i) => {
            const k = i - 2;
            const centre = k === 0;
            return (
              <div key={slug} className={cn('absolute left-1/2 top-1/2 aspect-[9/16] overflow-hidden rounded-2xl border border-white/15 bg-black shadow-[0_20px_60px_-15px_rgba(0,0,0,.9)]', centre ? 'z-10 w-[150px] sm:w-[180px]' : 'w-[110px] sm:w-[130px]')}
                style={{
                  transform: `translate(calc(-50% + ${k * (centre ? 0 : 1) * 118}px), calc(-50% + ${Math.abs(k) * 16}px)) rotate(${k * 7}deg)`,
                  opacity: Math.abs(k) === 2 ? 0.55 : 1,
                  animation: still ? undefined : `welcomefly 0.8s ${0.12 * Math.abs(k)}s cubic-bezier(.2,.8,.2,1) both`,
                }}>
                {centre
                  ? <video src={`/showcase/${slug}-preview.mp4`} poster={`/showcase/${slug}.webp`} muted autoPlay={!still} loop playsInline className="h-full w-full object-cover" />
                  : <img src={`/showcase/${slug}.webp`} alt="" className="h-full w-full object-cover" />}
              </div>
            );
          })}
        </div>

        <p className={cn('mt-4 text-[11px] font-bold uppercase tracking-[0.25em] text-fuchsia-300', !still && 'anim-fadein')} style={{ animationDelay: '0.5s' }}>Bienvenue sur Storyit</p>
        <h2 id="welcome-title" className={cn('mt-2 text-balance font-display text-4xl leading-[1.05] text-white sm:text-5xl', !still && 'anim-popin')} style={{ animationDelay: '0.6s' }}>
          Des vidéos comme <span className="whitespace-nowrap">celles-ci,</span> <span className="bg-gradient-to-r from-violet-300 to-fuchsia-400 bg-clip-text text-transparent">à partir d’une seule idée</span>
        </h2>
        <p className="mt-3 max-w-md text-sm text-white/70">Tu écris une phrase, Storyit écrit l’histoire, crée les personnages, les voix et le montage.</p>

        <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200" aria-live="polite">
          <Gift className="h-4 w-4" aria-hidden /> <span className="tabular-nums">{formatCredits(credits)}</span> crédits offerts
        </p>

        <button type="button" onClick={start}
          className="touch-hit mt-6 inline-flex h-14 items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-8 text-base font-semibold text-white shadow-[0_0_40px_-6px_rgba(217,70,239,0.9)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
          Créer ma première vidéo <ArrowRight className="h-5 w-5" aria-hidden />
        </button>
        <button type="button" onClick={close} className="touch-hit mt-3 rounded text-xs text-white/50 hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Plus tard, je visite d’abord</button>
      </div>
    </div>
  );
}
