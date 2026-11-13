import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Card, useToast } from '@/components/ui';
import { useProfile } from '@/hooks/useStore';
import { cn } from '@/lib/cn';
import { billingService } from '@/services/billing';
import { CREDIT_PACKS, formatCredits } from '@/services/credits';
import { store } from '@/services/store';

const THRESHOLDS = [1000, 3000, 5000] as const;
type Threshold = (typeof THRESHOLDS)[number];
type Pack = 'pack_100' | 'pack_500';

/** Subscribers can opt in: a credit pack is bought with their saved card whenever their balance drops below a threshold. */
export function AutoTopup() {
  const toast = useToast();
  const { data: profile } = useProfile();
  const p = profile as { plan?: string; auto_topup_enabled?: boolean; auto_topup_threshold?: number; auto_topup_pack?: Pack; auto_topup_error?: string | null } | null;
  const [enabled, setEnabled] = useState(false);
  const [threshold, setThreshold] = useState<Threshold>(3000);
  const [pack, setPack] = useState<Pack>('pack_100');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!p) return;
    setEnabled(!!p.auto_topup_enabled);
    setThreshold((THRESHOLDS as readonly number[]).includes(p.auto_topup_threshold ?? 0) ? (p.auto_topup_threshold as Threshold) : 3000);
    setPack(p.auto_topup_pack === 'pack_500' ? 'pack_500' : 'pack_100');
  }, [p?.auto_topup_enabled, p?.auto_topup_threshold, p?.auto_topup_pack]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!p || !p.plan || p.plan === 'free') return null;
  const chosen = CREDIT_PACKS.find((k) => k.id === pack)!;
  const dirty = enabled !== !!p.auto_topup_enabled || threshold !== (p.auto_topup_threshold ?? 3000) || pack !== (p.auto_topup_pack ?? 'pack_100');

  const save = async () => {
    setSaving(true); setError(null);
    try {
      await billingService.setAutoTopup({ enabled, threshold, pack });
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
          <p className="mt-0.5 text-sm text-zinc-400">Ne soyez jamais bloqué en plein projet : un pack de crédits est acheté tout seul quand votre solde devient bas.</p>
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

      <div className={cn('mt-4 grid gap-4 sm:grid-cols-2', !enabled && 'opacity-50')}>
        <fieldset disabled={!enabled}>
          <legend className="text-xs text-zinc-400">Quand mon solde passe sous</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {THRESHOLDS.map((t) => (
              <button key={t} type="button" aria-pressed={threshold === t} onClick={() => setThreshold(t)}
                className={cn('touch-hit rounded-full px-3.5 py-2 text-sm font-semibold tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 disabled:cursor-not-allowed',
                  threshold === t ? 'bg-violet-600 text-white' : 'bg-line/[0.06] text-zinc-300 hover:text-zinc-100')}>{formatCredits(t)} crédits</button>
            ))}
          </div>
        </fieldset>
        <fieldset disabled={!enabled}>
          <legend className="text-xs text-zinc-400">Ajouter</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {CREDIT_PACKS.map((k) => (
              <button key={k.id} type="button" aria-pressed={pack === k.id} onClick={() => setPack(k.id as Pack)}
                className={cn('touch-hit rounded-full px-3.5 py-2 text-sm font-semibold tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 disabled:cursor-not-allowed',
                  pack === k.id ? 'bg-violet-600 text-white' : 'bg-line/[0.06] text-zinc-300 hover:text-zinc-100')}>{formatCredits(k.credits)} crédits · {k.price} $</button>
            ))}
          </div>
        </fieldset>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-zinc-400">
        {enabled
          ? <>En activant cette option, vous autorisez Storyit à débiter <strong className="text-zinc-200">{chosen.price} $</strong> sur la carte de votre abonnement chaque fois que votre solde passe sous <strong className="text-zinc-200">{formatCredits(threshold)} crédits</strong>, pour ajouter {formatCredits(chosen.credits)} crédits. 3 recharges au maximum par jour. Désactivable à tout moment ici.</>
          : <>Désactivée : rien n’est débité automatiquement.</>}
      </p>
      {error && <p role="alert" className="mt-3 text-sm text-coral-300">{error}</p>}
      <Button className="mt-4" onClick={() => void save()} disabled={!dirty || saving} loading={saving}>Enregistrer</Button>
    </Card>
  );
}
