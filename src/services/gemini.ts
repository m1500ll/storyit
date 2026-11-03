import { FRUIT_DRAMA_CONCEPTS, FRUIT_DRAMA_SCENES } from '@/data/fruitDrama';
import { supabase } from '@/lib/supabase';
import { SCENES_PER_EPISODE, type SceneDraft, type StoryConcept } from '@/types/domain';
import { delay, store } from './store';

/**
 * Text-generation adapter. The Gemini API key lives server-side only:
 * the live implementation invokes the `gemini` Supabase Edge Function.
 */
export interface StoryAI {
  generateConcepts(idea: string): Promise<StoryConcept[]>;
  generateScenes(concept: StoryConcept, count?: number): Promise<SceneDraft[]>;
}

const mockAI: StoryAI = {
  async generateConcepts() {
    await delay(1200);
    return FRUIT_DRAMA_CONCEPTS;
  },
  async generateScenes(_concept, count = SCENES_PER_EPISODE) {
    await delay(1500);
    return FRUIT_DRAMA_SCENES.slice(0, count);
  },
};

/** Extracts the `{ error }` message our Edge Function returns on non-2xx responses. */
async function edgeError(error: unknown): Promise<Error> {
  const ctx = (error as { context?: Response }).context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = (await ctx.json()) as { error?: string };
      if (body.error) return new Error(body.error);
    } catch { /* fall through */ }
  }
  return error instanceof Error ? error : new Error('AI generation failed');
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase!.functions.invoke<T>('gemini', { body });
  if (error) throw await edgeError(error);
  if (!data) throw new Error('Empty AI response');
  store.notify(); // credits were debited server-side
  return data;
}

const edgeAI: StoryAI = {
  async generateConcepts(idea) {
    return (await invoke<{ concepts: StoryConcept[] }>({ task: 'concepts', idea })).concepts;
  },
  async generateScenes(concept, count = SCENES_PER_EPISODE) {
    return (await invoke<{ scenes: SceneDraft[] }>({ task: 'scenes', concept, count })).scenes;
  },
};

/** Real Gemini whenever Supabase is configured; set VITE_AI_MODE=demo to force canned output. */
const useEdge = supabase !== null && import.meta.env.VITE_AI_MODE !== 'demo';
export const storyAI: StoryAI = useEdge ? edgeAI : mockAI;
