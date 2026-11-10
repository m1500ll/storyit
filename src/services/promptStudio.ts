import { supabase } from '@/lib/supabase';
import { InsufficientCreditsError } from './errors';
import { store } from './store';
import type { PhaseKey, StyleKey } from '@shared/promptStudio.ts';
import { PROMPT_PROJECT_COST } from '@/services/credits';
import { dedupe } from '@/lib/dedupe';

export type { PhaseKey, StyleKey };
export interface Concept { title: string; synopsis: string; characters: { name: string; fruit: string; role: string; look: string }[]; locations: string[]; themes: string[] }
export interface Line { character: string; voice_accent_tone: string; line: string }
export interface Script { characters: { name: string; fruit: string; archetype: string; look: string }[]; locations: string[]; scenes: { scene_number: number; location: string; emotional_beat: string; action: string; dialogue: Line[] }[] }
export interface ImagePrompt { scene_number: number; aspect_ratio: '9:16'; location_environment: string; style: string; prompt: string }
export interface VideoPrompt { scene_number: number; aspect_ratio: '9:16'; camera_motion: string; character_action: string; dialogue: Line[]; prompt: string }
export interface Pack { thumbnail: { aspect_ratio: '9:16'; style: string; prompt: string }; titles: string[]; caption: string; hashtags: string[] }
/** V4 studio (mini-drama): the shapes the `prompts` Edge Function stores (see supabase/functions/_shared/promptStudio.ts). */
export interface V4Line { character: string; start: number; end: number; text: string }
export interface V4Character { name: string; phonetic: string; head: string; face: string; hands_neck: string; outfit: string; accessory: string; voice: string; role: string }
export interface V4Clip { seconds: number; location: string; characters: string[]; summary: string; open_question: string; new_thing: string; mini_hook: string; lines: V4Line[] }
export interface V4Script {
  title: string; paradox: string; synopsis: string; characters: V4Character[]; locations: string[];
  hook_candidates: { mechanic: string; line: string }[]; hook: { image: string; why: string }; backup_hooks: { image: string; line: string }[];
  clips: V4Clip[]; cliffhanger: string;
  engagement: { levers: string[]; references: string[]; cult_line: string; target_comment: string; scores: Record<'villain' | 'debate' | 'cult_line' | 'share' | 'part2' | 'detail', number> };
}
export interface V4Concept { title: string; paradox: string; synopsis: string; hook: string; characters: { name: string; head: string; role: string }[]; locations: string[] }
export interface V4Data {
  v4: true; style: StyleKey; story: string; part: number; previous_end: string;
  concepts?: V4Concept[]; chosen?: number; script?: V4Script;
  images?: { sheet: { name: string; description: string }[]; clips: { setting: string; continuity: string; characters: { name: string; action: string }[] }[] };
  videos?: { clips: { head_lock: { name: string; head: string }[]; look_lock: string; shots: { start: number; end: number; text: string }[]; sound: string }[] };
  pack?: { cover: { setting: string; glow: string; characters: { name: string; pose: string }[] }; caption: string; pinned_comment: string; hashtags: string[] };
  fixes?: Record<string, { problem: string; explanation: string; at: string }>;
}

export interface PromptProject {
  id: string; title: string; idea: string | null; phase: number; created_at: string; updated_at: string;
  data: { v4?: boolean; concepts?: Concept[]; chosen?: number; script?: Script; images?: ImagePrompt[]; videos?: VideoPrompt[]; pack?: Pack; image_files?: Record<string, string> } & Partial<Omit<V4Data, 'concepts' | 'script' | 'images' | 'videos' | 'pack'>>;
}

const DEMO = 'Le Prompt Studio a besoin du serveur Storyit (mode démo).';

export interface KeyStatus { connected: boolean; hint: string | null; status: 'valid' | 'invalid' | 'no_billing' | null; last_error: string | null; checked_at: string | null }

function call<T>(body: Record<string, unknown>): Promise<T> {
  return dedupe(`prompts:${JSON.stringify(body)}`, () => callOnce<T>(body));
}

async function callOnce<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error(DEMO);
  const { data, error } = await supabase.functions.invoke<T>('prompts', { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const msg = ctx && typeof ctx.json === 'function' ? ((await ctx.json().catch(() => ({}))) as { error?: string }).error : undefined;
    if (msg && /not enough story credits/i.test(msg)) throw new InsufficientCreditsError(PROMPT_PROJECT_COST, 0);
    throw new Error(msg ?? error.message);
  }
  return data as T;
}

export const promptStudio = {
  available: Boolean(supabase),
  /** List view: only the columns the cards show (the heavy `data` JSON is loaded when a project opens). */
  async list(): Promise<PromptProject[]> {
    if (!supabase) return [];
    const { data, error } = await supabase.from('prompt_projects' as never).select('id, title, idea, phase, created_at, updated_at').order('updated_at', { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as PromptProject[];
  },
  async get(id: string): Promise<PromptProject | null> {
    if (!supabase) return null;
    const { data } = await supabase.from('prompt_projects' as never).select('*').eq('id', id).maybeSingle();
    return (data as unknown as PromptProject) ?? null;
  },
  /** Generates one phase server-side (the master prompt never reaches the browser). 1 credit, charged on success only. */
  async generate(input: { phase: PhaseKey; project_id?: string; idea?: string; choice?: number; feedback?: string; style?: StyleKey; story?: string; part?: number; previous_end?: string }): Promise<PromptProject> {
    const { project } = await call<{ project: PromptProject }>({ action: 'phase', ...input });
    store.notify();
    return project;
  },
  /** Dépannage: the corrected prompts of ONE clip (included in the project). */
  async fix(input: { project_id: string; scene: number; problem: string; note?: string }): Promise<PromptProject> {
    const { project } = await call<{ project: PromptProject }>({ action: 'fix', ...input });
    store.notify();
    return project;
  },
  keyStatus: () => (supabase ? call<KeyStatus>({ action: 'key_status' }) : Promise.resolve<KeyStatus>({ connected: false, hint: null, status: null, last_error: null, checked_at: null })),
  async saveKey(key: string) { const r = await call<KeyStatus>({ action: 'key_save', key }); store.notify(); return r; },
  async deleteKey() { await call({ action: 'key_delete' }); store.notify(); },
  async remove(id: string) {
    if (!supabase) return;
    await supabase.from('prompt_projects' as never).delete().eq('id', id);
    store.notify();
  },
};
