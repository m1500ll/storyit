import { Sparkles } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useProfile } from '@/hooks/useStore';
import { PlanPicker } from './PlanPicker';

interface PaywallState { required?: number }
const PaywallContext = createContext<(state?: PaywallState) => void>(() => {});

/** Global upgrade sheet, opened whenever an action needs more credits than the user has. */
export function PaywallProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PaywallState | null>(null);
  const open = useCallback((s: PaywallState = {}) => setState(s), []);
  const { data: profile } = useProfile();

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setState(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state]);

  return (
    <PaywallContext.Provider value={open}>
      {children}
      {state && (
        <div className="fixed inset-0 z-50 flex overscroll-contain items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Get more Story Credits">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setState(null)} />
          <div className="surface relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-b-none p-6 sm:rounded-2xl md:p-8">
            <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-violet-600/25 blur-3xl" />
            <Sparkles className="relative h-5 w-5 text-coral-400" />
            <h2 className="relative mt-3 font-display text-3xl text-zinc-50">Keep the series going</h2>
            <p className="relative mt-1 text-sm text-zinc-400">
              {state.required
                ? <>This step needs <strong className="text-zinc-200">{state.required} credits</strong> — you have {profile?.credit_balance ?? 0}.</>
                : 'Pick a plan or a top-up pack.'}
            </p>
            <div className="relative mt-6"><PlanPicker currentPlan={profile?.plan} compact /></div>
            <button onClick={() => setState(null)} className="relative mt-4 w-full text-center text-xs text-zinc-500 hover:text-zinc-300">Not now</button>
          </div>
        </div>
      )}
    </PaywallContext.Provider>
  );
}

export const usePaywall = () => useContext(PaywallContext);
