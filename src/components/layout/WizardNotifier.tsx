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
    toast(lastCompleted.kind === 'concepts' ? 'Vos 3 concepts sont prêts — ouvrez le nouvel épisode pour en choisir un.' : 'Votre storyboard de 15 scènes est prêt — ouvrez le nouvel épisode pour le relire.', 'info');
    // Also update the tab title so it is noticeable from another tab.
    const prev = document.title;
    document.title = '✓ Ready — Storyit';
    const restore = () => { document.title = prev; };
    window.addEventListener('focus', restore, { once: true });
  }, [lastCompleted, pathname, toast]);

  return null;
}
