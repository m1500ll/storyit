import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useWizard } from '@/services/wizardStore';
import { useToast } from '../ui';

/** Tells the user a background generation finished when they are on another page. */
export function WizardNotifier() {
  const { lastCompleted } = useWizard();
  const { pathname } = useLocation();
  const toast = useToast();
  const seen = useRef(lastCompleted?.at ?? 0);

  useEffect(() => {
    if (!lastCompleted || lastCompleted.at === seen.current) return;
    seen.current = lastCompleted.at;
    if (pathname.startsWith('/app/new')) return;
    toast(lastCompleted.kind === 'concepts' ? 'Your 3 concepts are ready — open New episode to pick one.' : 'Your 15-scene storyboard is ready — open New episode to review it.', 'info');
    // Also update the tab title so it is noticeable from another tab.
    const prev = document.title;
    document.title = '✓ Ready — Storyit';
    const restore = () => { document.title = prev; };
    window.addEventListener('focus', restore, { once: true });
  }, [lastCompleted, pathname, toast]);

  return null;
}
