import { Loader2, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { billingService } from '@/services/billing';

/** Paddle's secure checkout (merchant of record) for a transaction made by the billing function: /pay?_ptxn=txn_…&back=/app/…
 *  Paddle.js reads _ptxn from the address and opens its overlay. Card data never touches Storyit. */
declare global { interface Window { Paddle?: any } }

const safeBack = (b: string | null) => (b && /^\/app\/[A-Za-z0-9/_-]*(\?[A-Za-z0-9=&_-]*)?$/.test(b) ? b : '/app/billing');

function loadPaddle(): Promise<any> {
  if (window.Paddle) return Promise.resolve(window.Paddle);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    s.onload = () => (window.Paddle ? resolve(window.Paddle) : reject(new Error('Paddle')));
    s.onerror = () => reject(new Error('Paddle'));
    document.head.appendChild(s);
  });
}

export default function PayPage() {
  const [params] = useSearchParams();
  const back = safeBack(params.get('back'));
  const [state, setState] = useState<'loading' | 'open' | 'closed' | 'error'>('loading');

  useEffect(() => {
    let alive = true;
    const go = (path: string) => window.location.assign(path);
    (async () => {
      try {
        const [token, Paddle] = await Promise.all([billingService.paddleToken(), loadPaddle()]);
        if (!token) throw new Error('no token');
        Paddle.Initialize({
          token,
          checkout: { settings: { displayMode: 'overlay', theme: 'dark', locale: navigator.language?.startsWith('fr') ? 'fr' : 'en' } },
          eventCallback: (e: { name?: string }) => {
            if (e.name === 'checkout.loaded' && alive) setState('open');
            if (e.name === 'checkout.completed') setTimeout(() => go(`${back}${back.includes('?') ? '&' : '?'}checkout=success`), 1500);
            if (e.name === 'checkout.closed' && alive) setState('closed');
          },
        });
      } catch {
        if (alive) setState('error');
      }
    })();
    return () => { alive = false; };
  }, [back]);

  return (
    <main id="main" className="grid min-h-screen place-items-center bg-ink-950 px-4 text-center">
      <div className="max-w-sm">
        {state === 'loading' || state === 'open' ? (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-400" aria-hidden />
            <p className="mt-4 text-zinc-200">Ouverture du paiement sécurisé…</p>
          </>
        ) : state === 'closed' ? (
          <>
            <p className="font-display text-2xl text-zinc-50">Paiement annulé</p>
            <p className="mt-2 text-sm text-zinc-400">Rien n’a été débité.</p>
            <div className="mt-6 flex flex-col gap-2">
              <button type="button" onClick={() => window.location.reload()} className="touch-hit rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Reprendre le paiement</button>
              <Link to={`${back}${back.includes('?') ? '&' : '?'}checkout=cancelled`} className="touch-hit inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm text-zinc-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Retour à Storyit</Link>
            </div>
          </>
        ) : (
          <>
            <p className="font-display text-2xl text-zinc-50">Le paiement n’a pas pu s’ouvrir</p>
            <p className="mt-2 text-sm text-zinc-400">Rien n’a été débité. Réessaie dans un instant, ou désactive un bloqueur de publicité.</p>
            <Link to={back} className="touch-hit mt-6 inline-flex items-center justify-center rounded-xl bg-white/10 px-5 py-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Retour à Storyit</Link>
          </>
        )}
        <p className="mt-8 inline-flex items-center gap-1.5 text-xs text-zinc-500"><ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Paiement sécurisé par Paddle</p>
      </div>
    </main>
  );
}
