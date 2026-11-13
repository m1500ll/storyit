import { ChevronDown, Rocket, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { billingService, type TrialStatus } from '@/services/billing';
import { PLANS, formatCredits } from '@/services/credits';
import { store } from '@/services/store';
import { Button, useToast } from '../ui';

/** During the $1 trial: ends it now and starts the paid plan (full credits at once), on Creator or Studio. */
export function TrialUpgrade() {
  const toast = useToast();
  const [status, setStatus] = useState<TrialStatus | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<'creator' | 'pro' | 'studio' | null>(null);
  const navigate = useNavigate();
  useEffect(() => { billingService.trialStatus().then(setStatus).catch(() => setStatus(null)); }, []);
  if (!status?.trialing) return null;

  const end = status.trial_end ? new Date(status.trial_end * 1000) : null;
  const activate = async (product: 'creator' | 'pro' | 'studio') => {
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
  const plans = PLANS.filter((p) => p.id !== 'free');
  const chosen = plans.find((p) => p.id === confirm);
  // Calm by default: right after paying $1, people must not mistake "pay the plan now" for "activate my trial".
  return (
    <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.07] p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-zinc-100"><Rocket className="h-4 w-4 text-emerald-300" aria-hidden /> Votre essai est actif</p>
      <p className="mt-1 text-sm text-zinc-300">
        {end ? `Il dure jusqu’au ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} à ${end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}. ` : ''}
        Vos crédits d’essai sont prêts : créez votre première vidéo.
      </p>
      <Button className="mt-3" onClick={() => navigate('/app')}><Sparkles className="h-4 w-4" aria-hidden /> Créer ma première vidéo</Button>

      <button type="button" onClick={() => { setOpen(!open); setConfirm(null); }} aria-expanded={open}
        className="touch-hit mt-3 flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
        Plus assez de crédits ? Passer à l’abonnement maintenant <ChevronDown className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-line/10 p-3">
          {!chosen ? (
            <>
              <p className="text-xs text-zinc-400">L’essai se termine et le prix de l’offre est débité tout de suite ; vous recevez aussitôt tous ses crédits.</p>
              <div className="mt-2 flex flex-col flex-wrap gap-2 sm:flex-row">
                {plans.map((p) => (
                  <Button key={p.id} size="sm" variant="secondary" disabled={pending !== null} onClick={() => setConfirm(p.id as 'creator' | 'pro' | 'studio')}>
                    {p.name} · {p.price} $/mois · {formatCredits(p.credits)} crédits
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-zinc-100">Vous allez payer <strong>{chosen.price} $ maintenant</strong> pour {chosen.name}. Votre essai se termine aussitôt. Confirmer ?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" loading={pending === chosen.id} disabled={pending !== null} onClick={() => void activate(chosen.id as 'creator' | 'pro' | 'studio')}>Oui, payer {chosen.price} $ maintenant</Button>
                <Button size="sm" variant="secondary" disabled={pending !== null} onClick={() => setConfirm(null)}>Non, garder mon essai</Button>
              </div>
            </>
          )}
        </div>
      )}
      <div aria-live="polite">{error && <p role="alert" className="mt-2 text-xs text-coral-300">{error}</p>}</div>
    </div>
  );
}
