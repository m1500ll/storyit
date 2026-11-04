import { supabase } from '@/lib/supabase';
import { InsufficientCreditsError } from './errors';
import { store } from './store';
import type { PhaseKey } from '@shared/promptStudio.ts';

export type { PhaseKey };
export interface Concept { title: string; synopsis: string; characters: { name: string; fruit: string; role: string; look: string }[]; locations: string[]; themes: string[] }
export interface Line { character: string; voice_accent_tone: string; line: string }
export interface Script { characters: { name: string; fruit: string; archetype: string; look: string }[]; locations: string[]; scenes: { scene_number: number; location: string; emotional_beat: string; action: string; dialogue: Line[] }[] }
export interface ImagePrompt { scene_number: number; aspect_ratio: '9:16'; location_environment: string; style: string; prompt: string }
export interface VideoPrompt { scene_number: number; aspect_ratio: '9:16'; camera_motion: string; character_action: string; dialogue: Line[]; prompt: string }
export interface Pack { thumbnail: { aspect_ratio: '9:16'; style: string; prompt: string }; titles: string[]; caption: string; hashtags: string[] }
export interface PromptProject {
  id: string; title: string; idea: string | null; phase: number; created_at: string; updated_at: string;
  data: { concepts?: Concept[]; chosen?: number; script?: Script; images?: ImagePrompt[]; videos?: VideoPrompt[]; pack?: Pack };
}

const DEMO = 'Le Prompt Studio a besoin du serveur Storyit (mode démo).';

export const promptStudio = {
  available: Boolean(supabase),
  async list(): Promise<PromptProject[]> {
    if (!supabase) return [];
    const { data, error } = await supabase.from('prompt_projects' as never).select('*').order('updated_at', { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as PromptProject[];
  },
  async get(id: string): Promise<PromptProject | null> {
    if (!supabase) return null;
    const { data } = await supabase.from('prompt_projects' as never).select('*').eq('id', id).maybeSingle();
    return (data as unknown as PromptProject) ?? null;
  },
  /** Generates one phase server-side (the master prompt never reaches the browser). 1 credit, charged on success only. */
  async generate(input: { phase: PhaseKey; project_id?: string; idea?: string; choice?: number; feedback?: string }): Promise<PromptProject> {
    if (!supabase) throw new Error(DEMO);
    const { data, error } = await supabase.functions.invoke<{ project: PromptProject }>('prompts', { body: input });
    if (error) {
      const ctx = (error as { context?: Response }).context;
      const msg = ctx && typeof ctx.json === 'function' ? ((await ctx.json().catch(() => ({}))) as { error?: string }).error : undefined;
      if (msg && /not enough story credits/i.test(msg)) throw new InsufficientCreditsError(1, 0);
      throw new Error(msg ?? error.message);
    }
    store.notify();
    return data!.project;
  },
  async remove(id: string) {
    if (!supabase) return;
    await supabase.from('prompt_projects' as never).delete().eq('id', id);
    store.notify();
  },
};
