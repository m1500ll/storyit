import { CheckCircle2, ExternalLink, KeyRound, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button, Card, useToast } from '@/components/ui';
import { useLiveQuery } from '@/hooks/useStore';
import { cn } from '@/lib/cn';
import { promptStudio } from '@/services/promptStudio';

/** Connect / test / remove the user's own Gemini API key. The key is sent once, then only its last 4 characters come back. */
export function GeminiKeyCard({ compact = false }: { compact?: boolean }) {
  const { data: st, loading } = useLiveQuery(() => promptStudio.keyStatus(), 'gemini-key');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const toast = useToast();

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await promptStudio.saveKey(key.trim()); setKey(''); setOpen(false); toast('Clé Gemini connectée.'); }
    catch (x) { setErr(x instanceof Error ? x.message : String(x)); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm('Déconnecter votre clé Gemini ? Elle sera supprimée de Storyit.')) return;
    await promptStudio.deleteKey(); toast('Clé supprimée.');
  };
  if (loading || !promptStudio.available) return null;

  return (
    <Card className={cn(compact && 'p-4')}>
      <div className="flex flex-wrap items-start gap-3">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-100">Votre clé Gemini</p>
          {st?.connected ? (
            <>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" /> Connectée (…{st.hint}). Les étapes passent par votre compte Google : 0 crédit Storyit.</p>
              {st.status === 'no_billing' && <p className="mt-1.5 text-xs text-amber-300">Images bloquées : activez la facturation sur votre projet dans Google AI Studio (onglet Billing), puis relancez la génération.</p>}
              {st.status === 'invalid' && <p className="mt-1.5 text-xs text-coral-300">Cette clé a été refusée par Google. Collez une nouvelle clé.</p>}
            </>
          ) : (
            <p className="mt-0.5 text-xs text-zinc-400">Connectez votre propre clé pour générer les images automatiquement et faire les étapes sans crédits Storyit. Google facture directement votre compte.</p>
          )}
        </div>
        {st?.connected
          ? <div className="flex gap-1.5"><Button size="sm" variant="secondary" onClick={() => setOpen(!open)}>Changer</Button>
              <button onClick={remove} aria-label="Supprimer la clé Gemini" className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-line/5 hover:text-coral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"><Trash2 className="h-4 w-4" /></button></div>
          : <Button size="sm" onClick={() => setOpen(!open)}>Connecter ma clé</Button>}
      </div>
      {(open || st?.status === 'invalid') && (
        <div className="mt-4 border-t border-line/[0.06] pt-4">
          <ol className="space-y-1.5 text-xs text-zinc-300">
            <li>1. Ouvrez <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-violet-300 underline">Google AI Studio → API keys <ExternalLink className="h-3 w-3" /></a> avec votre compte Google.</li>
            <li>2. Cliquez sur <strong>Create API key</strong>, puis copiez la clé en entier (elle commence par « AIza » ou « AQ. »).</li>
            <li>3. Pour les images : dans AI Studio, onglet <strong>Billing</strong>, activez la facturation (environ 0,04 à 0,07 $ par image, facturé par Google). Le texte fonctionne sans.</li>
            <li>4. Collez la clé ci-dessous.</li>
          </ol>
          <form onSubmit={save} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <label htmlFor="gemini-key" className="sr-only">Clé API Gemini</label>
            <input id="gemini-key" name="gemini-key" type="password" autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} placeholder="AIza… ou AQ.…"
              className="h-10 min-w-0 flex-1 rounded-xl border border-line/10 bg-transparent px-3 font-mono text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50" />
            <Button type="submit" loading={busy} disabled={!key.trim()}>Tester et enregistrer</Button>
          </form>
          <p className="mt-2 text-[11px] text-zinc-500">La clé est chiffrée sur nos serveurs et n’est plus jamais affichée. Vous pouvez la supprimer à tout moment, ou la révoquer dans Google AI Studio.</p>
          {err && <p role="alert" className="mt-2 text-xs text-coral-300">{err}</p>}
        </div>
      )}
    </Card>
  );
}
