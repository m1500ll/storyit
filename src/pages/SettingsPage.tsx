import { LogOut, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, CardHeader, PageHeader } from '@/components/ui';
import { useProfile } from '@/hooks/useStore';
import { useAuth } from '@/lib/auth';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { store } from '@/services/store';

export default function SettingsPage() {
  const { data: profile } = useProfile();
  const { theme, toggle } = useTheme();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const value = name ?? profile?.display_name ?? '';

  const save = async () => {
    if (!supabase || !profile) return;
    setSaving(true);
    await supabase.from('profiles').update({ display_name: value.trim() || null }).eq('id', profile.id);
    setSaving(false);
    setName(null);
    store.notify();
  };

  return (
    <>
      <PageHeader eyebrow="Account" title="Settings" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Profile" />
          <label className="label" htmlFor="name">Display name</label>
          <div className="mt-2 flex gap-2">
            <input id="name" className="input" value={value} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" />
            {isSupabaseConfigured && <Button variant="secondary" onClick={save} loading={saving} disabled={name === null}>Save</Button>}
          </div>
          <p className="mt-4 text-xs text-zinc-500">Backend: {isSupabaseConfigured ? <span className="text-emerald-300">Supabase connected</span> : <span className="text-amber-300">Demo mode</span>}</p>
        </Card>
        <Card>
          <CardHeader title="Appearance" subtitle="Applies on this device." />
          <div className="grid grid-cols-2 gap-2">
            {(['dark', 'light'] as const).map((t) => (
              <button key={t} onClick={() => theme !== t && toggle()} aria-pressed={theme === t}
                className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm transition ${theme === t ? 'border-violet-500/50 bg-violet-500/10 text-zinc-100' : 'border-line/10 text-zinc-400 hover:text-zinc-200'}`}>
                {t === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}{t === 'dark' ? 'Dark' : 'Light'}
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Plan & credits" subtitle="Upgrade, top up and see your credit history." />
          <Link to="/app/billing"><Button variant="secondary">Open Plan & credits</Button></Link>
        </Card>
        {isSupabaseConfigured && (
          <Card>
            <CardHeader title="Session" subtitle={`Need to delete your account? Email hello@storyit.fun.`} />
            <Button variant="danger" onClick={() => signOut().then(() => navigate('/'))}><LogOut className="h-4 w-4" /> Sign out</Button>
          </Card>
        )}
      </div>
    </>
  );
}
