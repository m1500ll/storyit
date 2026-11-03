import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button, Card, Logo, useToast } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

/** Landing page for the password-reset email link (Supabase signs the user in via the link). */
export default function ResetPasswordPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!supabase) return <Navigate to="/" replace />;
  if (session === null) return <Navigate to="/login" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error: err } = await supabase!.auth.updateUser({ password });
    setLoading(false);
    if (err) return setError(err.message);
    toast('Password updated.');
    navigate('/app', { replace: true });
  };

  return (
    <div className="grid min-h-screen place-items-center bg-ink-950 px-4">
      <Card className="w-full max-w-sm p-8">
        <Logo />
        <h1 className="mt-8 font-display text-3xl text-zinc-50">Choose a new password</h1>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <label className="sr-only" htmlFor="new-password">New password</label>
          <input id="new-password" className="input" type="password" name="new-password" autoComplete="new-password" required minLength={6}
            placeholder="New password (6+ characters)…" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div aria-live="polite">{error && <p className="text-xs text-coral-300">{error}</p>}</div>
          <Button type="submit" className="w-full" loading={loading}>Save Password</Button>
        </form>
      </Card>
    </div>
  );
}
