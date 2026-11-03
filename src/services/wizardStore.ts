import { useSyncExternalStore } from 'react';
import type { SceneDraft, StoryConcept } from '@/types/domain';
import { InsufficientCreditsError } from './credits';
import { storyAI } from './gemini';

/**
 * Episode-creation wizard state, kept OUTSIDE React components so that a generation keeps running
 * while the user browses other pages, and saved to localStorage so results survive a reload.
 */
export type WizardPending = 'concepts' | 'scenes' | null;

export interface WizardState {
  step: 0 | 1 | 2;
  idea: string;
  concepts: StoryConcept[];
  selectedId: string | null;
  scenes: SceneDraft[];
  pending: WizardPending;
  /** Set when a step fails; `credits` means the paywall should open. */
  error: { message: string; credits?: boolean } | null;
  /** Bumped when a generation finishes, so the app can notify the user wherever they are. */
  lastCompleted: { kind: 'concepts' | 'scenes'; at: number } | null;
}

const KEY = 'storyit:wizard';
const EMPTY: WizardState = { step: 0, idea: '', concepts: [], selectedId: null, scenes: [], pending: null, error: null, lastCompleted: null };

function load(): WizardState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const saved = JSON.parse(raw) as WizardState;
    // A generation can't survive a full reload of the tab: tell the user instead of spinning forever.
    if (saved.pending) {
      return { ...saved, pending: null, error: { message: 'The page was reloaded while the AI was working. Please run that step again — credits are only charged when a generation succeeds.' } };
    }
    return { ...EMPTY, ...saved };
  } catch {
    return EMPTY;
  }
}

let state: WizardState = load();
const listeners = new Set<() => void>();

function set(patch: Partial<WizardState>) {
  state = { ...state, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify({ ...state, lastCompleted: null })); } catch { /* storage full/blocked */ }
  listeners.forEach((l) => l());
}

function failure(e: unknown): WizardState['error'] {
  const message = e instanceof Error ? e.message : 'Something went wrong';
  return { message, credits: e instanceof InsufficientCreditsError || /not enough story credits/i.test(message) };
}

export const wizard = {
  get: () => state,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },

  setIdea: (idea: string) => set({ idea }),
  select: (selectedId: string) => set({ selectedId }),
  goTo: (step: WizardState['step']) => set({ step, error: null }),
  clearError: () => set({ error: null }),
  reset: (idea = '') => set({ ...EMPTY, idea }),

  /** Runs in the background: navigating away does not cancel it. */
  async generateConcepts() {
    if (state.pending) return;
    set({ pending: 'concepts', error: null });
    try {
      const concepts = await storyAI.generateConcepts(state.idea);
      set({ concepts, selectedId: null, step: 1, pending: null, lastCompleted: { kind: 'concepts', at: Date.now() } });
    } catch (e) {
      set({ pending: null, error: failure(e) });
    }
  },

  async generateScenes() {
    const concept = state.concepts.find((c) => c.id === state.selectedId);
    if (state.pending || !concept) return;
    set({ pending: 'scenes', error: null });
    try {
      const scenes = await storyAI.generateScenes(concept);
      set({ scenes, step: 2, pending: null, lastCompleted: { kind: 'scenes', at: Date.now() } });
    } catch (e) {
      set({ pending: null, error: failure(e) });
    }
  },
};

export function useWizard(): WizardState {
  return useSyncExternalStore(wizard.subscribe, wizard.get);
}
