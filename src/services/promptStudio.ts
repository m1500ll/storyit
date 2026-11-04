import { supabase } from '@/lib/supabase';
import { InsufficientCreditsError } from './errors';
import { store } from './store';
import type { PhaseKey } from '@shared/promptStudio.ts';
import { dedupe } from '@/lib/dedupe';

export type { PhaseKey };
export interface Concept { title: string; synopsis: string; characters: { name: string; fruit: string; role: string; look: string }[]; locations: string[]; themes: string[] }
export interface Line { character: string; voice_accent_tone: string; line: string }
export interface Script { characters: { name: string; fruit: string; archetype: string; look: string }[]; locations: string[]; scenes: { scene_number: number; location: string; emotional_beat: string; action: string; dialogue: Line[] }[] }
export interface ImagePrompt { scene_number: number; aspect_ratio: '9:16'; location_environment: string; style: string; prompt: string }
export interface VideoPrompt { scene_number: number; aspect_ratio: '9:16'; camera_motion: string; character_action: string; dialogue: Line[]; prompt: string }
export interface Pack { thumbnail: { aspect_ratio: '9:16'; style: string; prompt: string }; titles: string[]; caption: string; hashtags: string[] }
export interface PromptProject {
  id: string; title: string; idea: string | null; phase: number; created_at: string; updated_at: string;
  data: { concepts?: Concept[]; chosen?: number; script?: Script; images?: ImagePrompt[]; videos?: VideoPrompt[]; pack?: Pack; image_files?: Record<string, string> };
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
    if (msg && /not enough story credits/i.test(msg)) throw new InsufficientCreditsError(1, 0);
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
  async generate(input: { phase: PhaseKey; project_id?: string; idea?: string; choice?: number; feedback?: string }): Promise<PromptProject> {
    const { project } = await call<{ project: PromptProject }>({ action: 'phase', ...input });
    store.notify();
    return project;
  },
  /** One scene image, generated on the user's own Gemini key (Google bills the user). */
  async generateImage(projectId: string, scene: number): Promise<PromptProject> {
    const { project } = await call<{ project: PromptProject }>({ action: 'image', project_id: projectId, scene });
    store.notify();
    return project;
  },
  /** Short-lived URLs for the project's private scene images. */
  async imageUrls(files: Record<string, string> | undefined): Promise<Record<string, string>> {
    const entries = Object.entries(files ?? {});
    if (!supabase || entries.length === 0) return {};
    const { data } = await supabase.storage.from('renders').createSignedUrls(entries.map(([, p]) => p), 3600);
    const byPath = new Map((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
    return Object.fromEntries(entries.map(([n, p]) => [n, byPath.get(p) ?? '']).filter(([, u]) => u));
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
