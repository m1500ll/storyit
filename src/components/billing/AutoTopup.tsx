import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Card, useToast } from '@/components/ui';
import { useProfile } from '@/hooks/useStore';
import { cn } from '@/lib/cn';
import { billingService } from '@/services/billing';
import { formatCredits, isTopupAmount, TOPUP, topupPriceCents } from '@/services/credits';
import { store } from '@/services/store';

const PRESETS = [5000, 10000, 25000, 50000, 100000];
const usd = (cents: number) => `${(cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })} $`;
const chip = (on: boolean) => cn('touch-hit rounded-full px-3.5 py-2 text-sm font-semibold tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 disabled:cursor-not-allowed',
  on ? 'bg-violet-600 text-white' : 'bg-line/[0.06] text-zinc-300 hover:text-zinc-100');

/** Subscribers can opt in: credits are bought with their saved card whenever their balance drops below a threshold. */
export function AutoTopup() {
  const toast = useToast();
  const { data: profile } = useProfile();
  const p = profile as { plan?: string; auto_topup_enabled?: boolean; auto_topup_threshold?: number; auto_topup_credits?: number; auto_topup_error?: string | null } | null;
  const [enabled, setEnabled] = useState(false);
  const [threshold, setThreshold] = useState(3000);
  const [credits, setCredits] = useState(10000);
  const [custom, setCustom] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!p) return;
    setEnabled(!!p.auto_topup_enabled);
    setThreshold((TOPUP.thresholds as readonly number[]).includes(p.auto_topup_threshold ?? 0) ? p.auto_topup_threshold! : 3000);
    const c = isTopupAmount(p.auto_topup_credits) ? p.auto_topup_credits : 10000;
    setCredits(c); setCustom(PRESETS.includes(c) ? '' : String(c));
  }, [p?.auto_topup_enabled, p?.auto_topup_threshold, p?.auto_topup_credits]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!p || !p.plan || p.plan === 'free') return null;
  const customN = Number(custom.replace(/\s/g, ''));
  const amount = custom ? customN : credits;
  const valid = isTopupAmount(amount);
  const dirty = enabled !== !!p.auto_topup_enabled || threshold !== (p.auto_topup_threshold ?? 3000) || amount !== (p.auto_topup_credits ?? 10000);

  const save = async () => {
    if (enabled && !valid) return setError(`Choisissez entre ${formatCredits(TOPUP.min)} et ${formatCredits(TOPUP.max)} crédits, par tranches de 1 000.`);
    setSaving(true); setError(null);
    try {
      await billingService.setAutoTopup({ enabled, threshold, credits: valid ? amount : 10000 });
      toast(enabled ? 'Recharge automatique activée.' : 'Recharge automatique désactivée.');
      store.notify();
    } catch (e) { setError(e instanceof Error ? e.message : 'Enregistrement impossible.'); } finally { setSaving(false); }
  };

  return (
    <Card className="mt-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-300"><RefreshCw className="h-5 w-5" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-zinc-100">Recharge automatique</h2>
          <p className="mt-0.5 text-sm text-zinc-400">Ne soyez jamais bloqué en plein projet : des crédits sont ajoutés tout seuls quand votre solde devient bas.</p>
        </div>
      </div>

      {p.auto_topup_error && !p.auto_topup_enabled && (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-coral-500/30 bg-coral-500/10 px-3 py-2.5 text-sm text-coral-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />La dernière recharge automatique n’a pas pu se faire. {p.auto_topup_error}
        </p>
      )}

      <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-line/10 px-3 py-3">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-5 w-5 accent-violet-500" />
        <span className="text-sm font-medium text-zinc-100">Activer la recharge automatique</span>
      </label>

      <div className={cn('mt-4 space-y-4', !enabled && 'opacity-50')}>
        <fieldset disabled={!enabled}>
          <legend className="text-xs text-zinc-400">Quand mon solde passe sous</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {TOPUP.thresholds.map((t) => (
              <button key={t} type="button" aria-pressed={threshold === t} onClick={() => setThreshold(t)} className={chip(threshold === t)}>{formatCredits(t)} crédits</button>
            ))}
          </div>
        </fieldset>
        <fieldset disabled={!enabled}>
          <legend className="text-xs text-zinc-400">Ajouter</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESETS.map((c) => (
              <button key={c} type="button" aria-pressed={!custom && credits === c} onClick={() => { setCredits(c); setCustom(''); }} className={chip(!custom && credits === c)}>
                {formatCredits(c)} · {usd(topupPriceCents(c))}
              </button>
            ))}
          </div>
          <label className="mt-3 flex flex-wrap items-center gap-2 text-sm text-zinc-300">
            Autre montant
            <input type="text" inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^\d\s]/g, '').slice(0, 9))}
              placeholder="ex. 30 000…" aria-label="Autre montant de crédits" name="topup-credits" autoComplete="off"
              className={cn('h-10 w-36 rounded-lg border bg-transparent px-3 text-base tabular-nums text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 sm:text-sm',
                custom && !valid ? 'border-coral-500/60' : custom ? 'border-violet-500/60' : 'border-line/10')} />
            crédits
            {custom && <span className={cn('text-xs', valid ? 'text-violet-300' : 'text-coral-300')}>{valid ? `= ${usd(topupPriceCents(customN))}` : `entre ${formatCredits(TOPUP.min)} et ${formatCredits(TOPUP.max)}, par 1 000`}</span>}
          </label>
          <p className="mt-2 text-[11px] text-zinc-500">1,20 $ les 1 000 crédits, 0,98 $ à partir de 50 000.</p>
        </fieldset>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-zinc-400" aria-live="polite">
        {enabled && valid
          ? <>En activant cette option, vous autorisez Storyit à débiter <strong className="text-zinc-200">{usd(topupPriceCents(amount))}</strong> sur la carte de votre abonnement chaque fois que votre solde passe sous <strong className="text-zinc-200">{formatCredits(threshold)} crédits</strong>, pour ajouter {formatCredits(amount)} crédits. 3 recharges au maximum par jour. Désactivable à tout moment ici.</>
          : enabled ? <>Choisissez un montant.</> : <>Désactivée : rien n’est débité automatiquement.</>}
      </p>
      {error && <p role="alert" className="mt-3 text-sm text-coral-300">{error}</p>}
      <Button className="mt-4" onClick={() => void save()} disabled={!dirty || saving} loading={saving}>Enregistrer</Button>
    </Card>
  );
}
