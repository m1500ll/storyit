import { FRUIT_DRAMA_CONCEPTS, FRUIT_DRAMA_SCENES } from '@/data/fruitDrama';
import { supabase } from '@/lib/supabase';
import { SCENES_PER_EPISODE, type SceneDraft, type StoryConcept } from '@/types/domain';
import { delay } from './store';

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

const edgeAI: StoryAI = {
  async generateConcepts(idea) {
    const { data, error } = await supabase!.functions.invoke<{ concepts: StoryConcept[] }>('gemini', { body: { task: 'concepts', idea } });
    if (error || !data) throw error ?? new Error('Empty Gemini response');
    return data.concepts;
  },
  async generateScenes(concept, count = SCENES_PER_EPISODE) {
    const { data, error } = await supabase!.functions.invoke<{ scenes: SceneDraft[] }>('gemini', { body: { task: 'scenes', concept, count } });
    if (error || !data) throw error ?? new Error('Empty Gemini response');
    return data.scenes;
  },
};

export const storyAI: StoryAI = supabase ? edgeAI : mockAI;
