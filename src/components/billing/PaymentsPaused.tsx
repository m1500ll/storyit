import { Wrench, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PAYMENTS_PAUSED_EVENT } from '@/services/billing';

const TITLE = 'Paiements en maintenance';
const TEXT = 'On met en place un nouveau système de paiement, plus fiable. Les abonnements et les packs de crédits sont donc indisponibles pendant quelques jours.';
const KEEP = 'Tes crédits, tes vidéos et ton compte ne changent pas : tu peux continuer à créer avec les crédits que tu as.';

/** inline notice shown above the plans while payments are paused */
export function PaymentsPausedBanner({ className = '' }: { className?: string }) {
  return (
    <div role="status" className={`flex gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/[0.08] p-4 text-left ${className}`}>
      <Wrench className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
      <div>
        <p className="text-sm font-semibold text-amber-100">{TITLE}</p>
        <p className="mt-1 text-sm text-zinc-300">{TEXT} {KEEP}</p>
      </div>
    </div>
  );
}

/** the sheet that opens when someone clicks a payment button while payments are paused (mounted once in AppShell) */
export function PaymentsPausedNotice() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(PAYMENTS_PAUSED_EVENT, show);
    return () => window.removeEventListener(PAYMENTS_PAUSED_EVENT, show);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center overscroll-contain sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="pp-title">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="surface relative w-full max-w-md rounded-b-none p-6 text-center sm:rounded-2xl md:p-8">
        <button type="button" onClick={() => setOpen(false)} aria-label="Fermer"
          className="touch-hit absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-lg text-zinc-400 hover:bg-white/5 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
          <X className="h-4 w-4" aria-hidden />
        </button>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-400/15 text-amber-300"><Wrench className="h-7 w-7" aria-hidden /></span>
        <h2 id="pp-title" className="mt-4 font-display text-2xl text-zinc-50">{TITLE}</h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-300">{TEXT}</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">{KEEP}</p>
        <button type="button" onClick={() => setOpen(false)}
          className="touch-hit mt-6 w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
          J’ai compris
        </button>
      </div>
    </div>
  );
}
