import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Kind = 'success' | 'error' | 'info';
interface Toast { id: number; kind: Kind; text: string }

const ToastContext = createContext<(text: string, kind?: Kind) => void>(() => {});
const ICONS = { success: CheckCircle2, error: XCircle, info: Info };
const COLORS = { success: 'text-emerald-300', error: 'text-coral-300', info: 'text-violet-300' };

/** Lightweight, screen-reader-announced notifications. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));
  const toast = useCallback((text: string, kind: Kind = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, kind, text }]);
    setTimeout(() => dismiss(id), 4500);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6">
        {toasts.map(({ id, kind, text }) => {
          const Icon = ICONS[kind];
          return (
            <div key={id} role="status" className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border border-line/10 bg-ink-800/95 px-4 py-3 text-sm text-zinc-100 shadow-2xl backdrop-blur animate-[fadein_.2s_ease]">
              <Icon className={cn('h-4 w-4 shrink-0', COLORS[kind])} />
              <span className="flex-1">{text}</span>
              <button onClick={() => dismiss(id)} aria-label="Fermer" className="text-zinc-500 hover:text-zinc-200"><X className="h-3.5 w-3.5" /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
