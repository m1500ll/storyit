import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { StartLink } from './StartLink';
import { TRIAL } from '@/services/credits';

/** Phone-only call to action that appears once the hero is out of view (no popups, no timers). */
export function StickyCTA() {
  const { session } = useAuth();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const pricing = document.getElementById('pricing')?.getBoundingClientRect();
      // Hidden while the pricing cards (which have their own buttons) are on screen.
      const overPricing = pricing ? pricing.top < window.innerHeight && pricing.bottom > 0 : false;
      setShow(window.scrollY > 650 && !overPricing);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (session || !show) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line/10 bg-ink-950/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur md:hidden">
      <StartLink to="/app/billing" className="flex h-12 items-center justify-center gap-2 rounded-xl bg-violet-600 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
        Try {TRIAL.days} days for ${TRIAL.price} <ArrowRight className="h-4 w-4" aria-hidden />
      </StartLink>
    </div>
  );
}
