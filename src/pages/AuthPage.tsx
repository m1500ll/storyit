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

const COPY: Record<Mode, { title: string; sub: string; cta: string }> = {
  signin: { title: 'Welcome back', sub: 'Sign in to continue your series.', cta: 'Sign In' },
  signup: { title: 'Create your studio', sub: 'Free plan with 3,000 credits. No card required.', cta: 'Create Account' },
  forgot: { title: 'Reset your password', sub: 'We’ll email you a link to choose a new one.', cta: 'Send Reset Link' },
};

/** Turns Supabase auth errors into a next step the user can act on. */
function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Wrong email or password. Try again, or reset your password.';
  if (/already registered/i.test(message)) return 'This email already has an account — sign in instead.';
  if (/provider is not enabled/i.test(message)) return 'Google sign-in isn’t enabled yet on this project.';
  if (/email not confirmed/i.test(message)) return 'Confirm your email first — check your inbox.';
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
  useSeo({ title: 'Sign in', path: '/login', noindex: true });
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
      return setMessage(error ? { kind: 'error', text: friendly(error.message) } : { kind: 'info', text: 'If an account exists for this email, a reset link is on its way.' });
    }
    const { data, error } = mode === 'signin'
      ? await supabase!.auth.signInWithPassword({ email, password })
      : await supabase!.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}${from}` } });
    setLoading(null);
    if (error) return setMessage({ kind: 'error', text: friendly(error.message) });
    if (data.session) return navigate(from, { replace: true });
    setMessage({ kind: 'info', text: 'Check your inbox to confirm your email, then sign in.' });
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
            {['3,000 free credits to try the Prompt Studio', 'Post each video on all your TikTok and Instagram accounts', 'Free plan, no card, cancel anytime'].map((t) => (
              <li key={t} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-violet-400" />{t}</li>
            ))}
          </ul>
        )}

        {mode !== 'forgot' && googleEnabled && (
          <>
            <button onClick={google} disabled={loading !== null}
              className="mt-6 flex h-11 w-full items-center justify-center gap-3 rounded-xl bg-white text-sm font-medium text-zinc-900 transition hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 disabled:opacity-60">
              <GoogleIcon />{loading === 'google' ? 'Redirecting to Google…' : 'Continue with Google'}
            </button>
            <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-widest text-zinc-600">
              <span className="h-px flex-1 bg-line/10" />or with email<span className="h-px flex-1 bg-line/10" />
            </div>
          </>
        )}

        <form onSubmit={submit} className={mode === 'forgot' ? 'mt-6 space-y-3' : 'space-y-3'}>
          <label className="sr-only" htmlFor="email">Email</label>
          <input id="email" className="input" type="email" name="email" required autoComplete="email" spellCheck={false}
            placeholder="you@studio.com…" value={email} onChange={(e) => setEmail(e.target.value)} />
          {mode !== 'forgot' && (
            <>
              <label className="sr-only" htmlFor="password">Password</label>
              <input id="password" className="input" type="password" name="password" required minLength={6}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                placeholder={mode === 'signup' ? 'Password (6+ characters)…' : 'Password…'} value={password} onChange={(e) => setPassword(e.target.value)} />
            </>
          )}
          {mode === 'signin' && (
            <button type="button" onClick={() => switchMode('forgot')} className="block text-xs text-zinc-500 hover:text-zinc-300">Forgot password?</button>
          )}
          <div aria-live="polite">
            {message && <p className={message.kind === 'error' ? 'text-xs text-coral-300' : 'text-xs text-emerald-300'}>{message.text}</p>}
          </div>
          <Button type="submit" className="w-full" loading={loading === 'form'} disabled={loading === 'google'}>{copy.cta}</Button>
        </form>

        {mode === 'forgot' ? (
          <button onClick={() => switchMode('signin')} className="mt-5 flex w-full items-center justify-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300">
            <ArrowLeft className="h-3 w-3" /> Back to sign in
          </button>
        ) : (
          <button onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')} className="mt-5 w-full text-center text-xs text-zinc-500 hover:text-zinc-300">
            {mode === 'signin' ? 'No account? Create one' : 'Already have an account? Sign in'}
          </button>
        )}
        <p className="mt-6 text-center text-[11px] leading-relaxed text-zinc-600">
          By continuing you agree to how we handle your data in our <Link to="/privacy" className="underline hover:text-zinc-400">Privacy Policy</Link>.
        </p>
        </div>
        </div>
      </main>
      <AuthShowcase />
    </div>
  );
}
