import { Rocket } from 'lucide-react';
import { useEffect, useState } from 'react';
import { billingService, type TrialStatus } from '@/services/billing';
import { PLANS } from '@/services/credits';
import { store } from '@/services/store';
import { Button, useToast } from '../ui';

/** During the $1 trial: ends it now and starts the paid plan (full credits at once), on Creator or Studio. */
export function TrialUpgrade() {
  const toast = useToast();
  const [status, setStatus] = useState<TrialStatus | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { billingService.trialStatus().then(setStatus).catch(() => setStatus(null)); }, []);
  if (!status?.trialing) return null;

  const end = status.trial_end ? new Date(status.trial_end * 1000) : null;
  const activate = async (product: 'creator' | 'studio') => {
    setPending(product); setError(null);
    try {
      const r = await billingService.endTrial(product);
      if (r.paid) {
        toast('Abonnement activé : vos crédits arrivent dans quelques secondes.');
        setStatus({ ...status, trialing: false });
        setTimeout(() => store.notify(), 4000);
      } else if (r.invoice_url) window.location.assign(r.invoice_url); // the card needs a confirmation (3-D Secure) or failed
      else setError('Le paiement est en attente. Vérifiez votre moyen de paiement dans « Gérer la facturation ».');
    } catch (e) { setError(e instanceof Error ? e.message : 'Activation impossible.'); }
    finally { setPending(null); }
  };
  const plans = PLANS.filter((p) => p.id === 'creator' || p.id === 'studio');
  return (
    <div className="mb-6 rounded-2xl border border-coral-400/40 bg-gradient-to-r from-coral-500/15 via-violet-500/10 to-transparent p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-zinc-100"><Rocket className="h-4 w-4 text-coral-300" aria-hidden /> Vous êtes en période d’essai</p>
      <p className="mt-1 text-xs text-zinc-400">
        {end ? `Elle se termine le ${end.toLocaleDateString()} à ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. ` : ''}
        Plus assez de crédits ? Activez votre abonnement maintenant : vous recevez tout de suite tous les crédits de l’offre.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {plans.map((p) => (
          <Button key={p.id} size="sm" variant={p.id === (status.product ?? 'creator') ? 'primary' : 'secondary'} loading={pending === p.id} disabled={pending !== null}
            onClick={() => void activate(p.id as 'creator' | 'studio')}>
            Activer {p.name} maintenant · ${p.price}/mo · {p.credits} crédits
          </Button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">Le prix de l’offre choisie est débité immédiatement sur votre carte ; l’essai prend fin et l’abonnement se renouvelle ensuite chaque mois.</p>
      <div aria-live="polite">{error && <p role="alert" className="mt-2 text-xs text-coral-300">{error}</p>}</div>
    </div>
  );
}
