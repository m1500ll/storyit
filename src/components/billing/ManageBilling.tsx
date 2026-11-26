import { ArrowRight, CreditCard, Heart, LifeBuoy, LogOut } from 'lucide-react';
import { useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { cn } from '@/lib/cn';
import { billingService, type CancelReason } from '@/services/billing';
import { PLANS, formatCredits } from '@/services/credits';

const REASONS: { id: CancelReason; label: string }[] = [
  { id: 'too_expensive', label: 'C’est trop cher pour moi' },
  { id: 'not_using', label: 'Je ne l’utilise pas assez' },
  { id: 'no_views', label: 'Mes vidéos ne font pas assez de vues' },
  { id: 'quality', label: 'Les vidéos ne me plaisent pas' },
  { id: 'bug', label: 'J’ai eu un problème technique' },
  { id: 'other', label: 'Autre raison' },
];
const DISCORD = 'https://discord.gg/S3A9Jg5xe';
const starter = PLANS.find((p) => p.id === 'starter')!;

/** "Gérer la facturation": invoices and card go straight to the payment provider's page; cancelling first asks why
 *  and, for the bigger plans, offers Starter at $9 instead of leaving. The answer is stored for the owner. */
export function ManageBilling({ plan }: { plan: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'menu' | 'why' | 'offer'>('menu');
  const [reason, setReason] = useState<CancelReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canDowngrade = ['creator', 'pro', 'studio'].includes(plan);
  const close = () => { setOpen(false); setStep('menu'); setReason(null); setDetails(''); setError(null); };
  const portal = async (key: string) => {
    setBusy(key); setError(null);
    try { await billingService.openPortal(); } catch (e) { setError(e instanceof Error ? e.message : 'La page de facturation n’a pas pu s’ouvrir.'); setBusy(null); }
  };
  const decide = async (outcome: 'cancel' | 'downgrade' | 'stayed') => {
    if (reason) await billingService.cancelFeedback(reason, details, outcome).catch(() => undefined); // never blocks the customer
    if (outcome === 'stayed') { close(); return; }
    if (outcome === 'cancel') { await portal('cancel'); return; }
    setBusy('downgrade'); setError(null);
    try { await billingService.checkout('starter', { returnTo: '/app/billing' }); } catch (e) { setError(e instanceof Error ? e.message : 'Le changement d’offre n’a pas pu démarrer.'); setBusy(null); }
  };

  return (
    <>
      <Button size="sm" variant="secondary" className="mt-auto" onClick={() => setOpen(true)}>
        <CreditCard className="h-3.5 w-3.5" aria-hidden /> Gérer la facturation et les factures
      </Button>
      <Modal open={open} onClose={close} title={step === 'menu' ? 'Gérer mon abonnement' : step === 'why' ? 'Avant de partir' : 'Une autre option'}>
        {step === 'menu' && (
          <div className="grid gap-2">
            <button type="button" onClick={() => void portal('portal')} disabled={!!busy}
              className="touch-hit flex min-h-[52px] items-center gap-3 rounded-xl border border-line/10 px-4 text-left text-sm text-zinc-100 hover:bg-line/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 disabled:opacity-60">
              <CreditCard className="h-4 w-4 shrink-0 text-violet-300" aria-hidden />
              <span className="flex-1">Mes factures et ma carte bancaire</span>{busy === 'portal' ? '…' : <ArrowRight className="h-4 w-4 text-zinc-500" aria-hidden />}
            </button>
            <button type="button" onClick={() => setStep('why')}
              className="touch-hit flex min-h-[52px] items-center gap-3 rounded-xl border border-line/10 px-4 text-left text-sm text-zinc-100 hover:bg-line/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
              <LogOut className="h-4 w-4 shrink-0 text-coral-300" aria-hidden />
              <span className="flex-1">Résilier mon abonnement</span><ArrowRight className="h-4 w-4 text-zinc-500" aria-hidden />
            </button>
          </div>
        )}

        {step === 'why' && (
          <>
            <p className="text-zinc-300">Pourquoi veux-tu arrêter ? Ta réponse nous aide à améliorer Storyit.</p>
            <div className="mt-3 grid gap-2" role="radiogroup" aria-label="Raison">
              {REASONS.map((r) => (
                <button key={r.id} type="button" role="radio" aria-checked={reason === r.id} onClick={() => setReason(r.id)}
                  className={cn('touch-hit min-h-[44px] rounded-xl border px-4 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
                    reason === r.id ? 'border-violet-500/60 bg-violet-500/10 text-zinc-50' : 'border-line/10 text-zinc-300 hover:bg-line/5')}>
                  {r.label}
                </button>
              ))}
            </div>
            <label htmlFor="cancel-details" className="mt-3 block text-xs text-zinc-500">Un détail à ajouter ? (facultatif)</label>
            <textarea id="cancel-details" rows={2} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line/10 bg-transparent px-3 py-2 text-base text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 md:text-sm" />
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => setStep('menu')}>Retour</Button>
              <Button disabled={!reason} onClick={() => setStep('offer')}>Continuer</Button>
            </div>
          </>
        )}

        {step === 'offer' && reason && (
          <>
            {reason === 'bug' || reason === 'quality' ? (
              <div className="rounded-xl border border-violet-500/30 bg-violet-500/[0.07] p-4">
                <p className="flex items-center gap-2 font-semibold text-zinc-100"><LifeBuoy className="h-4 w-4 text-violet-300" aria-hidden /> On peut sûrement régler ça</p>
                <p className="mt-1 text-zinc-300">Explique-nous ce qui ne va pas sur le Discord Storyit : l’équipe répond vite et corrige les problèmes.</p>
                <a href={DISCORD} target="_blank" rel="noreferrer" onClick={() => void billingService.cancelFeedback(reason, details, 'stayed').catch(() => undefined)}
                  className="touch-hit mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
                  Écrire à l’équipe <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
              </div>
            ) : canDowngrade ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] p-4">
                <p className="flex items-center gap-2 font-semibold text-zinc-100"><Heart className="h-4 w-4 text-emerald-300" aria-hidden /> Reste pour {starter.price} $/mois avec Starter</p>
                <p className="mt-1 text-zinc-300">{formatCredits(starter.credits)} crédits par mois, jusqu’à 3 vidéos. Ton offre actuelle s’arrête et tu passes à Starter tout de suite, <strong className="text-zinc-100">en gardant tous tes crédits restants</strong>. Sans engagement.</p>
                <Button className="mt-3" loading={busy === 'downgrade'} disabled={!!busy} onClick={() => void decide('downgrade')}>Passer à Starter, {starter.price} $/mois</Button>
              </div>
            ) : (
              <p className="text-zinc-300">Merci pour ta réponse. Tu gardes ton accès et tes crédits jusqu’à la fin de la période déjà payée.</p>
            )}
            {error && <p className="mt-3 text-xs text-coral-300" role="alert">{error}</p>}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <Button variant="secondary" onClick={() => void decide('stayed')} disabled={!!busy}>Finalement, je reste</Button>
              <button type="button" onClick={() => void decide('cancel')} disabled={!!busy}
                className="touch-hit rounded text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
                {busy === 'cancel' ? 'Ouverture…' : 'Non merci, résilier'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
