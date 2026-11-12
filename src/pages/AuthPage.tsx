import { ArrowLeft, Gift } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useSeo } from '@/lib/seo';
import { Button, Logo, ThemeToggle } from '@/components/ui';
import { AuthShowcase, AuthShowcaseStrip } from '@/components/auth/AuthShowcase';
import { GoogleIcon } from '@/components/ui/GoogleIcon';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { pendingReferral } from '@/lib/referral';
import { keepAffiliateInUrl } from '@/lib/affiliate';
import { REFERRAL_FRIEND_BONUS, formatCredits } from '@/services/credits';

type Mode = 'signin' | 'signup' | 'forgot';

/** French for French-speaking browsers (most customers), English otherwise (visitors from the English landing page) */
const FR = typeof navigator !== 'undefined' && /^fr\b/i.test(navigator.language || '');
const COPY: Record<Mode, { title: string; sub: string; cta: string }> = FR ? {
  signin: { title: 'Content de vous revoir', sub: 'Connectez-vous pour continuer vos séries.', cta: 'Se connecter' },
  signup: { title: 'Créez votre studio', sub: 'Offre gratuite avec 3 000 crédits. Sans carte bancaire.', cta: 'Créer mon compte' },
  forgot: { title: 'Réinitialiser le mot de passe', sub: 'Nous vous envoyons un lien par e-mail pour en choisir un nouveau.', cta: 'Envoyer le lien' },
} : {
  signin: { title: 'Welcome back', sub: 'Sign in to continue your series.', cta: 'Sign In' },
  signup: { title: 'Create your studio', sub: 'Free plan with 3,000 credits. No card required.', cta: 'Create Account' },
  forgot: { title: 'Reset your password', sub: 'We’ll email you a link to choose a new one.', cta: 'Send Reset Link' },
};
const L = FR ? {
  wrong: 'E-mail ou mot de passe incorrect. Réessayez, ou réinitialisez votre mot de passe.', exists: 'Cet e-mail a déjà un compte : connectez-vous plutôt.',
  noGoogle: 'La connexion Google n’est pas encore activée.', confirm: 'Confirmez d’abord votre e-mail : regardez votre boîte de réception.',
  resetSent: 'Si un compte existe pour cet e-mail, un lien de réinitialisation est en route.', checkInbox: 'Regardez votre boîte de réception pour confirmer votre e-mail, puis connectez-vous.',
  perks: ['3 000 crédits offerts pour essayer les studios', 'Des vidéos IA prêtes pour TikTok, Reels et Shorts', 'Offre gratuite, sans carte, sans engagement'],
  redirect: 'Redirection vers Google…', google: 'Continuer avec Google', orEmail: 'ou avec un e-mail', password: 'Mot de passe', passNew: 'Mot de passe (6 caractères minimum)…', pass: 'Mot de passe…',
  forgotQ: 'Mot de passe oublié ?', back: 'Retour à la connexion', noAccount: 'Pas de compte ? Créez-en un', haveAccount: 'Déjà un compte ? Connectez-vous',
  privacy1: 'En continuant, vous acceptez la façon dont nous traitons vos données, décrite dans notre', privacy2: 'politique de confidentialité', email: 'vous@studio.com…', seo: 'Connexion',
} : {
  wrong: 'Wrong email or password. Try again, or reset your password.', exists: 'This email already has an account — sign in instead.',
  noGoogle: 'Google sign-in isn’t enabled yet on this project.', confirm: 'Confirm your email first — check your inbox.',
  resetSent: 'If an account exists for this email, a reset link is on its way.', checkInbox: 'Check your inbox to confirm your email, then sign in.',
  perks: ['3,000 free credits to try the studios', 'AI videos ready for TikTok, Reels and Shorts', 'Free plan, no card, cancel anytime'],
  redirect: 'Redirecting to Google…', google: 'Continue with Google', orEmail: 'or with email', password: 'Password', passNew: 'Password (6+ characters)…', pass: 'Password…',
  forgotQ: 'Forgot password?', back: 'Back to sign in', noAccount: 'No account? Create one', haveAccount: 'Already have an account? Sign in',
  privacy1: 'By continuing you agree to how we handle your data in our', privacy2: 'Privacy Policy', email: 'you@studio.com…', seo: 'Sign in',
};

/** Turns Supabase auth errors into a next step the user can act on. */
function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return L.wrong;
  if (/already registered/i.test(message)) return L.exists;
  if (/provider is not enabled/i.test(message)) return L.noGoogle;
  if (/email not confirmed/i.test(message)) return L.confirm;
  return message;
}

export default function AuthPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const nextParam = new URLSearchParams(location.search).get('next');
  // Only same-site paths, never external URLs.
  const [mode, setMode] = useState<Mode>(() => (new URLSearchParams(window.location.search).get('mode') === 'signin' ? 'signin' : 'signup'));
  // Everyone lands on Home (the overview, Prompt Studio first) unless a specific page was asked for.
  const from = (location.state as { from?: string } | null)?.from ?? (nextParam?.startsWith('/app') ? nextParam : '/app');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState<'form' | 'google' | null>(null);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  // Show "Continue with Google" only when the provider is really enabled on the auth server.
  useSeo({ title: L.seo, path: '/login', noindex: true });
  useEffect(() => { keepAffiliateInUrl(); }, []);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { external?: { google?: boolean } } | null) => setGoogleEnabled(Boolean(d?.external?.google)))
      .catch(() => setGoogleEnabled(false));
  }, []);

  if (!supabase || session) return <Navigate to={from} replace />;

  const switchMode = (m: Mode) => { setMode(m); setMessage(null); };

  const google = async () => {
    setLoading('google');
    setMessage(null);
    const { error } = await supabase!.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${from}`, queryParams: { prompt: 'select_account' } },
    });
    // On success the browser leaves for Google; we only get here on error.
    if (error) { setLoading(null); setMessage({ kind: 'error', text: friendly(error.message) }); }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading('form');
    setMessage(null);
    if (mode === 'forgot') {
      const { error } = await supabase!.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      setLoading(null);
      return setMessage(error ? { kind: 'error', text: friendly(error.message) } : { kind: 'info', text: L.resetSent });
    }
    const { data, error } = mode === 'signin'
      ? await supabase!.auth.signInWithPassword({ email, password })
      : await supabase!.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}${from}` } });
    setLoading(null);
    if (error) return setMessage({ kind: 'error', text: friendly(error.message) });
    if (data.session) return navigate(from, { replace: true });
    setMessage({ kind: 'info', text: L.checkInbox });
  };

  const copy = COPY[mode];
  const invited = !!pendingReferral();
  return (
    <div className="min-h-screen bg-ink-950 text-zinc-100 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <main className="relative flex min-h-screen flex-col overflow-hidden px-4 py-6 sm:px-8">
        <div className="pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-violet-400/25 blur-[110px]" />
        <div className="pointer-events-none absolute -bottom-40 right-0 h-[380px] w-[380px] rounded-full bg-coral-500/20 blur-[110px]" />
        <ThemeToggle className="absolute right-4 top-5 z-10 sm:right-8" />
        <Link to="/" className="relative self-start rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50" aria-label="Storyit home"><Logo /></Link>
        <div className="relative mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
        <AuthShowcaseStrip />
        <div className="rounded-3xl border border-line/[0.07] bg-ink-900/90 p-7 shadow-[0_30px_80px_-30px_rgba(76,29,149,0.35)] backdrop-blur sm:p-8">
        <h1 className="font-display text-4xl leading-tight text-zinc-50">{copy.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{copy.sub}</p>
        {mode === 'signup' && invited && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs text-zinc-100">
            <Gift className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" aria-hidden />
            Invité par un ami : {formatCredits(REFERRAL_FRIEND_BONUS)} crédits offerts avec votre premier abonnement.
          </p>
        )}
        {mode === 'signup' && (
          <ul className="mt-4 space-y-1.5 text-xs text-zinc-400">
            {L.perks.map((t) => (
              <li key={t} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-violet-400" />{t}</li>
            ))}
          </ul>
        )}

        {mode !== 'forgot' && googleEnabled && (
          <>
            <button onClick={google} disabled={loading !== null}
              className="mt-6 flex h-11 w-full items-center justify-center gap-3 rounded-xl bg-white text-sm font-medium text-zinc-900 transition hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 disabled:opacity-60">
              <GoogleIcon />{loading === 'google' ? L.redirect : L.google}
            </button>
            <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-widest text-zinc-600">
              <span className="h-px flex-1 bg-line/10" />{L.orEmail}<span className="h-px flex-1 bg-line/10" />
            </div>
          </>
        )}

        <form onSubmit={submit} className={mode === 'forgot' ? 'mt-6 space-y-3' : 'space-y-3'}>
          <label className="sr-only" htmlFor="email">Email</label>
          <input id="email" className="input" type="email" name="email" required autoComplete="email" spellCheck={false}
            placeholder={L.email} value={email} onChange={(e) => setEmail(e.target.value)} />
          {mode !== 'forgot' && (
            <>
              <label className="sr-only" htmlFor="password">{L.password}</label>
              <input id="password" className="input" type="password" name="password" required minLength={6}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                placeholder={mode === 'signup' ? L.passNew : L.pass} value={password} onChange={(e) => setPassword(e.target.value)} />
            </>
          )}
          {mode === 'signin' && (
            <button type="button" onClick={() => switchMode('forgot')} className="block text-xs text-zinc-500 hover:text-zinc-300">{L.forgotQ}</button>
          )}
          <div aria-live="polite">
            {message && <p className={message.kind === 'error' ? 'text-xs text-coral-300' : 'text-xs text-emerald-300'}>{message.text}</p>}
          </div>
          <Button type="submit" className="w-full" loading={loading === 'form'} disabled={loading === 'google'}>{copy.cta}</Button>
        </form>

        {mode === 'forgot' ? (
          <button onClick={() => switchMode('signin')} className="mt-5 flex w-full items-center justify-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300">
            <ArrowLeft className="h-3 w-3" /> {L.back}
          </button>
        ) : (
          <button onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')} className="mt-5 w-full text-center text-xs text-zinc-500 hover:text-zinc-300">
            {mode === 'signin' ? L.noAccount : L.haveAccount}
          </button>
        )}
        <p className="mt-6 text-center text-[11px] leading-relaxed text-zinc-600">
          {L.privacy1} <Link to="/privacy" className="underline hover:text-zinc-400">{L.privacy2}</Link>.
        </p>
        </div>
        </div>
      </main>
      <AuthShowcase />
    </div>
  );
}
