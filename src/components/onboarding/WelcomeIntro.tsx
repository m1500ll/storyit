import { ArrowLeft, ArrowRight, Check, Clock, Gift, Loader2, Sparkles, Target, TrendingUp, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '@/hooks/useStore';
import { cn } from '@/lib/cn';
import { billingPlan, billingService } from '@/services/billing';
import { formatCredits, PLANS, PROMPT_PROJECT_COST, TRIAL, TRIAL_ENABLED } from '@/services/credits';
import { repository } from '@/services/repository';
import { VIDEO_PRICES } from '@shared/promptVideo.ts';

/** Right after sign-up, shown once: welcome (real Storyit videos) → 5 quick questions about the customer's goal →
 *  "the AI builds your plan" → their plan, computed honestly from their answers (no earnings promise) → the $1 trial.
 *  The answers do not change the product; they are saved on the profile (profiles.onboarding) for the owner. */

const SEEN = 'storyit:welcome-seen';
const VIDEOS = ['chevelure-sans-fin', 'banane-honnete', 'plaque-de-cuisson', 'mensonge-mere', 'cache-oreilles'];
const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
function seen() { try { return localStorage.getItem(SEEN) === '1'; } catch { return true; } }

type Opt = { id: string; label: string; hint?: string };
type Question = { id: 'goal' | 'target' | 'time' | 'level' | 'platforms'; title: string; sub?: string; multi?: boolean; options: Opt[] };
const QUESTIONS: Question[] = [
  { id: 'goal', title: 'Quel est ton objectif avec Storyit ?', options: [
    { id: 'side', label: 'Un revenu en plus', hint: 'À côté de mes études ou de mon travail' },
    { id: 'business', label: 'En faire mon vrai business', hint: 'Vivre de mes comptes' },
    { id: 'grow', label: 'Faire exploser mon compte', hint: 'Plus de vues et d’abonnés' },
    { id: 'test', label: 'Tester par curiosité', hint: 'Voir ce que ça donne' },
  ] },
  { id: 'target', title: 'Combien aimerais-tu gagner par mois avec tes vidéos ?', sub: 'Ton objectif, pour construire ton plan.', options: [
    { id: '100-500', label: '100 à 500 $' }, { id: '500-2000', label: '500 à 2 000 $' },
    { id: '2000-5000', label: '2 000 à 5 000 $' }, { id: '5000+', label: 'Plus de 5 000 $' },
  ] },
  { id: 'time', title: 'Combien de temps peux-tu y consacrer par jour ?', options: [
    { id: '15', label: '15 minutes' }, { id: '30', label: '30 minutes' }, { id: '60', label: '1 heure' }, { id: '120', label: '2 heures ou plus' },
  ] },
  { id: 'level', title: 'Où en es-tu aujourd’hui ?', options: [
    { id: 'zero', label: 'Je n’ai jamais posté', hint: 'Je pars de zéro' },
    { id: 'posted', label: 'J’ai déjà posté quelques vidéos' },
    { id: 'views', label: 'Je fais déjà des vues' },
    { id: 'paid', label: 'Je gagne déjà de l’argent' },
  ] },
  { id: 'platforms', title: 'Sur quelles plateformes veux-tu poster ?', sub: 'Plusieurs choix possibles.', multi: true, options: [
    { id: 'tiktok', label: 'TikTok' }, { id: 'reels', label: 'Instagram Reels' }, { id: 'shorts', label: 'YouTube Shorts' },
  ] },
];
type Answers = Partial<Record<Question['id'], string | string[]>>;

/** videos a month at their pace, kept within what the plans really pay for (a 30 s video = 3,500 credits) */
const PACE: Record<string, number> = { '15': 10, '30': 20, '60': 40, '120': 60 };
const VIDEO_30S = PROMPT_PROJECT_COST + VIDEO_PRICES.eco[30];

export function planFor(a: Answers) {
  const perMonth = PACE[String(a.time)] ?? 30;
  const offers = PLANS.filter((p) => p.price > 0).map((p) => ({ ...p, videos: Math.floor(p.credits / VIDEO_30S) }));
  const plan = offers.find((p) => p.videos >= perMonth) ?? offers[offers.length - 1]!;
  const profile = a.goal === 'business' || a.time === '120' ? 'Créateur ambitieux' : a.level === 'views' || a.level === 'paid' ? 'Créateur qui accélère' : a.level === 'zero' ? 'Nouveau créateur motivé' : 'Créateur régulier';
  const platforms = Array.isArray(a.platforms) && a.platforms.length ? a.platforms : ['tiktok'];
  return { perMonth, perWeek: Math.round(perMonth / 4.3), plan, profile, platforms };
}

const TARGET_LABEL: Record<string, string> = { '100-500': '100 à 500 $ par mois', '500-2000': '500 à 2 000 $ par mois', '2000-5000': '2 000 à 5 000 $ par mois', '5000+': 'plus de 5 000 $ par mois' };
const PLATFORM_LABEL: Record<string, string> = { tiktok: 'TikTok', reels: 'Reels', shorts: 'Shorts' };
const THINKING = ['J’analyse ton objectif…', 'Je calcule ton rythme de publication…', 'Je choisis le meilleur format…', 'Je prépare ton plan…'];

export function WelcomeIntro() {
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<'welcome' | 'quiz' | 'thinking' | 'plan'>('welcome');
  const [q, setQ] = useState(0);
  // a screen with no question after "how much time": whatever they picked, Storyit makes a video in minutes
  const [interlude, setInterlude] = useState(false);
  const [answers, setAnswers] = useState<Answers>({});
  const [thought, setThought] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // new accounts only (created in the last 3 days, not answered yet, never shown on this device)
  useEffect(() => {
    if (!profile || seen() || (profile as { onboarding?: unknown }).onboarding) return;
    if (Date.now() - Date.parse(profile.created_at) < 3 * 86_400_000) setOpen(true);
  }, [profile]);

  // "the AI builds your plan": the steps tick one after another
  useEffect(() => {
    if (stage !== 'thinking') return;
    setThought(0);
    const t = setInterval(() => setThought((n) => n + 1), reduced() ? 250 : 850);
    return () => clearInterval(t);
  }, [stage]);
  useEffect(() => { if (stage === 'thinking' && thought > THINKING.length) setStage('plan'); }, [stage, thought]);

  const close = () => { try { localStorage.setItem(SEEN, '1'); } catch { /* private mode */ } setOpen(false); };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  if (!open) return null;

  const still = reduced();
  const question = QUESTIONS[q]!;
  const finish = (a: Answers) => {
    setStage('thinking');
    repository.saveOnboarding(a).catch(() => undefined);
  };
  const pick = (id: string) => {
    if (question.multi) {
      const cur = Array.isArray(answers[question.id]) ? (answers[question.id] as string[]) : [];
      setAnswers({ ...answers, [question.id]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
      return;
    }
    const next = { ...answers, [question.id]: id };
    setAnswers(next);
    setTimeout(() => {
      if (question.id === 'time') { setInterlude(true); setQ(q + 1); return; }
      if (q < QUESTIONS.length - 1) setQ(q + 1); else finish(next);
    }, still ? 0 : 220);
  };
  const plan = planFor(answers);
  const canTrial = TRIAL_ENABLED && billingPlan(profile).plan === 'free' && !billingPlan(profile).trialUsed;
  // the plan the answers point to (with the $1 trial when it is open)
  const startTrial = async () => {
    setPending(true); setError(null);
    try { await billingService.checkout(canTrial ? 'creator' : plan.plan.id as 'creator' | 'pro' | 'studio', { trial: canTrial, returnTo: '/app/prompts' }); setPending(false); close(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Le paiement n’a pas pu démarrer.'); setPending(false); }
  };
  const toStudio = () => { close(); navigate('/app/prompts'); };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto overscroll-contain bg-[#07040f]/95 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/3 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-600/25 blur-[120px]" />
      <button type="button" onClick={close} aria-label="Fermer" className="touch-hit absolute right-4 top-4 z-10 rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"><X className="h-5 w-5" /></button>

      {stage === 'welcome' && (
        <div className="relative flex w-full max-w-3xl flex-col items-center text-center">
          <div aria-hidden className="relative h-[280px] w-full sm:h-[340px]">
            {VIDEOS.map((slug, i) => {
              const k = i - 2, centre = k === 0;
              return (
                <div key={slug} className={cn('absolute left-1/2 top-1/2 aspect-[9/16] overflow-hidden rounded-2xl border border-white/15 bg-black shadow-[0_20px_60px_-15px_rgba(0,0,0,.9)]', centre ? 'z-10 w-[140px] sm:w-[170px]' : 'w-[104px] sm:w-[124px]')}
                  style={{ transform: `translate(calc(-50% + ${centre ? 0 : k * 112}px), calc(-50% + ${Math.abs(k) * 16}px)) rotate(${k * 7}deg)`, opacity: Math.abs(k) === 2 ? 0.55 : 1,
                    animation: still ? undefined : `welcomefly 0.8s ${0.12 * Math.abs(k)}s cubic-bezier(.2,.8,.2,1) both` }}>
                  {centre ? <video src={`/showcase/${slug}-preview.mp4`} poster={`/showcase/${slug}.webp`} muted autoPlay={!still} loop playsInline className="h-full w-full object-cover" />
                    : <img src={`/showcase/${slug}.webp`} alt="" className="h-full w-full object-cover" />}
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.25em] text-fuchsia-300">Bienvenue sur Storyit</p>
          <h2 id="welcome-title" className={cn('mt-2 text-balance font-display text-4xl leading-[1.05] text-white sm:text-5xl', !still && 'anim-popin')}>
            Des vidéos comme <span className="whitespace-nowrap">celles-ci,</span> <span className="bg-gradient-to-r from-violet-300 to-fuchsia-400 bg-clip-text text-transparent">à partir d’une seule idée</span>
          </h2>
          <p className="mt-3 max-w-md text-sm text-white/70">Réponds à 5 questions rapides : l’IA construit ton plan pour atteindre ton objectif.</p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200">
            <Gift className="h-4 w-4" aria-hidden /> {formatCredits(profile?.credit_balance ?? 3000)} crédits offerts
          </p>
          <button type="button" onClick={() => setStage('quiz')}
            className="touch-hit mt-6 inline-flex h-14 items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-8 text-base font-semibold text-white shadow-[0_0_40px_-6px_rgba(217,70,239,0.9)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            Créer mon plan · 30 secondes <ArrowRight className="h-5 w-5" aria-hidden />
          </button>
          <button type="button" onClick={toStudio} className="touch-hit mt-3 rounded text-xs text-white/50 hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Passer, je crée directement</button>
        </div>
      )}

      {stage === 'quiz' && interlude && (
        <div className={cn('relative w-full max-w-lg text-center', !still && 'anim-fadein')}>
          <span className={cn('mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-[0_0_40px_-6px_rgba(16,185,129,0.8)]', !still && 'anim-popin')}><Clock className="h-8 w-8" aria-hidden /></span>
          <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-300">Bonne nouvelle</p>
          <h2 id="welcome-title" className="mt-2 text-balance font-display text-3xl leading-tight text-white sm:text-4xl">Peu importe le temps que tu as : Storyit fait tout en quelques minutes</h2>
          <div className="mt-7 grid grid-cols-2 gap-3 text-left">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Sans Storyit</p>
              <p className="mt-2 font-display text-2xl text-white/60 line-through decoration-coral-400/80">Des heures</p>
              <p className="mt-1 text-xs text-white/50">écrire, dessiner, doubler les voix, monter…</p>
            </div>
            <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 shadow-[0_0_30px_-12px_rgba(16,185,129,0.9)]">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Avec Storyit</p>
              <p className="mt-2 font-display text-2xl text-white">Quelques minutes</p>
              <p className="mt-1 text-xs text-white/70">tu écris ton idée, l’IA fait tout le reste</p>
            </div>
          </div>
          <p className="mt-5 text-sm text-white/65">Même avec 15 minutes par jour, tu peux poster comme les plus gros comptes.</p>
          <button type="button" onClick={() => setInterlude(false)}
            className="touch-hit mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-base font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            Continuer <ArrowRight className="h-5 w-5" aria-hidden />
          </button>
        </div>
      )}

      {stage === 'quiz' && !interlude && (
        <div key={q} className={cn('relative w-full max-w-lg', !still && 'anim-fadein')}>
          <div className="flex items-center gap-3">
            {q > 0 ? <button type="button" onClick={() => (QUESTIONS[q - 1]!.id === 'time' ? setInterlude(true) : setQ(q - 1))} aria-label="Question précédente" className="touch-hit rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"><ArrowLeft className="h-5 w-5" /></button> : <span className="w-9" />}
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={1} aria-valuemax={QUESTIONS.length} aria-valuenow={q + 1} aria-label="Progression">
              <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-[width] duration-500" style={{ width: `${((q + 1) / QUESTIONS.length) * 100}%` }} />
            </div>
            <span className="w-9 text-right text-xs tabular-nums text-white/50">{q + 1}/{QUESTIONS.length}</span>
          </div>
          <h2 id="welcome-title" className="mt-8 text-balance font-display text-3xl leading-tight text-white">{question.title}</h2>
          {question.sub && <p className="mt-2 text-sm text-white/60">{question.sub}</p>}
          <div className="mt-6 grid gap-3" role={question.multi ? 'group' : 'radiogroup'} aria-label={question.title}>
            {question.options.map((o) => {
              const v = answers[question.id];
              const on = Array.isArray(v) ? v.includes(o.id) : v === o.id;
              return (
                <button key={o.id} type="button" onClick={() => pick(o.id)} role={question.multi ? 'checkbox' : 'radio'} aria-checked={on}
                  className={cn('flex min-h-[56px] items-center justify-between gap-3 rounded-2xl border px-5 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400',
                    on ? 'border-fuchsia-400/80 bg-violet-600/25 shadow-[0_0_30px_-10px_rgba(217,70,239,0.9)]' : 'border-white/10 bg-white/[0.04] hover:border-violet-400/50 hover:bg-white/[0.07]')}>
                  <span><span className="block text-base font-semibold text-white">{o.label}</span>{o.hint && <span className="block text-xs text-white/55">{o.hint}</span>}</span>
                  <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full border', on ? 'border-fuchsia-400 bg-fuchsia-500 text-white' : 'border-white/25')}>{on && <Check className="h-3.5 w-3.5" aria-hidden />}</span>
                </button>
              );
            })}
          </div>
          {question.multi && (
            <button type="button" disabled={!(answers[question.id] as string[] | undefined)?.length} onClick={() => finish(answers)}
              className="touch-hit mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-base font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-40">
              Voir mon plan <ArrowRight className="h-5 w-5" aria-hidden />
            </button>
          )}
        </div>
      )}

      {stage === 'thinking' && (
        <div className="relative w-full max-w-md text-center" role="status" aria-live="polite">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-[0_0_40px_-6px_rgba(217,70,239,0.9)]"><Sparkles className="h-8 w-8 animate-pulse motion-reduce:animate-none" aria-hidden /></span>
          <h2 id="welcome-title" className="mt-5 font-display text-3xl text-white">L’IA prépare ton plan…</h2>
          <ul className="mx-auto mt-6 max-w-xs space-y-3 text-left">
            {THINKING.map((t, i) => (
              <li key={t} className={cn('flex items-center gap-3 text-sm transition-opacity duration-300', i <= thought ? 'opacity-100' : 'opacity-0')}>
                {i < thought ? <Check className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden /> : <Loader2 className="h-4 w-4 shrink-0 animate-spin text-fuchsia-300 motion-reduce:animate-none" aria-hidden />}
                <span className={i < thought ? 'text-white' : 'text-white/70'}>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {stage === 'plan' && (
        <div className={cn('relative w-full max-w-lg py-6', !still && 'anim-fadein')}>
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.25em] text-fuchsia-300">Ton plan est prêt 🎉</p>
          <h2 id="welcome-title" className={cn('mt-2 text-balance text-center font-display text-4xl leading-tight text-white', !still && 'anim-popin')}>{plan.profile}</h2>
          <p className="mt-2 text-center text-sm text-white/65">Construit à partir de tes réponses.</p>

          <ul className="mt-6 space-y-3">
            {answers.target && (
              <li className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                <Target className="mt-0.5 h-5 w-5 shrink-0 text-fuchsia-300" aria-hidden />
                <span><span className="block text-sm font-semibold text-white">Ton objectif : {TARGET_LABEL[String(answers.target)]}</span>
                  <span className="block text-xs text-white/60">La clé, c’est de poster souvent et régulièrement. C’est exactement ce que Storyit rend facile.</span></span>
              </li>
            )}
            <li className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
              <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
              <span><span className="block text-sm font-semibold text-white">Ton rythme : {plan.perMonth} vidéos par mois</span>
                <span className="block text-xs text-white/60">Environ {plan.perWeek} par semaine sur {plan.platforms.map((p) => PLATFORM_LABEL[p] ?? p).join(', ')}. Format conseillé : des histoires de plus d’1 minute, le format que TikTok rémunère.</span></span>
            </li>
            <li className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
              <span><span className="block text-sm font-semibold text-white">Environ 2 minutes de ton temps par vidéo</span>
                <span className="block text-xs text-white/60">Tu écris l’idée, Storyit écrit l’histoire, crée les personnages, les voix et le montage.</span></span>
            </li>
          </ul>
          <p className="mt-3 text-center text-xs text-white/55">Offre adaptée à ton rythme : <strong className="text-white/80">{plan.plan.name}</strong> (jusqu’à {plan.plan.videos} vidéos de 30 s par mois{plan.perMonth > plan.plan.videos ? ', et des recharges pour aller plus loin' : ''}).</p>

          {canTrial ? (
            <>
              <button type="button" onClick={() => void startTrial()} disabled={pending}
                className="touch-hit mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-base font-semibold text-white shadow-[0_0_40px_-6px_rgba(217,70,239,0.9)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60">
                {pending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Sparkles className="h-5 w-5" aria-hidden />} Essayer gratuitement 3 jours
              </button>
              <p className="mt-2 text-center text-[11px] text-white/50">{formatCredits(TRIAL.credits)} crédits (ta première vidéo complète). Carte demandée, 0 $ aujourd’hui, résiliable en 1 clic.</p>
              {error && <p className="mt-2 text-center text-xs text-coral-300" aria-live="polite">{error}</p>}
              <button type="button" onClick={toStudio} className="touch-hit mx-auto mt-3 block rounded text-xs text-white/50 hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Commencer avec mes crédits gratuits</button>
            </>
          ) : billingPlan(profile).plan === 'free' ? (
            <>
              <button type="button" onClick={() => void startTrial()} disabled={pending}
                className="touch-hit mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-base font-semibold text-white shadow-[0_0_40px_-6px_rgba(217,70,239,0.9)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60">
                {pending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Sparkles className="h-5 w-5" aria-hidden />} Commencer mon plan · {plan.plan.name} {plan.plan.price}&nbsp;$/mois
              </button>
              <p className="mt-2 text-center text-[11px] text-white/50">{formatCredits(plan.plan.credits)} crédits chaque mois. Sans engagement, résiliable en 1 clic.</p>
              {error && <p className="mt-2 text-center text-xs text-coral-300" aria-live="polite">{error}</p>}
              <button type="button" onClick={toStudio} className="touch-hit mx-auto mt-3 block rounded text-xs text-white/50 hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Commencer avec mes 3 000 crédits gratuits</button>
            </>
          ) : (
            <button type="button" onClick={toStudio}
              className="touch-hit mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-base font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              Créer ma première vidéo <ArrowRight className="h-5 w-5" aria-hidden />
            </button>
          )}
          <p className="mt-4 text-center text-[10px] leading-snug text-white/35">Les revenus dépendent de ton compte, de ton audience et des règles des plateformes : personne ne peut les garantir.</p>
        </div>
      )}
    </div>
  );
}
