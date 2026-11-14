// Creative Studio → finished video: the `prompt-videos` Edge Function charges the credits and queues the job, the render
// worker draws the images (ChatGPT), animates them (Grok) and assembles the video (render-engine/promptvideo/run.py).
import { InsufficientCreditsError } from './errors';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { store } from './store';
import type { VideoQuality } from '@shared/promptVideo.ts';

export type { VideoQuality };
export type PromptVideoStatus = 'queued' | 'working' | 'done' | 'failed';
export interface PromptVideo {
  id: string; project_id: string | null; title: string | null; quality: VideoQuality; seconds: number; status: PromptVideoStatus;
  step: string | null; progress: number; error: string | null; video_path: string | null; asset_id: string | null;
  credits_charged: number; created_at: string; finished_at: string | null;
}

const DEMO = 'La génération vidéo a besoin du serveur Storyit (mode démo).';

async function call<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error(DEMO);
  const { data, error } = await supabase.functions.invoke<T>('prompt-videos', { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const payload = ctx && typeof ctx.json === 'function' ? ((await ctx.json().catch(() => ({}))) as { error?: string; code?: string; needed?: number }) : {};
    if (payload.code === 'insufficient_credits') throw new InsufficientCreditsError(payload.needed ?? 0, 0);
    throw new Error(payload.error ?? error.message);
  }
  return data as T;
}

export const promptVideos = {
  available: isSupabaseConfigured,
  async list(projectId: string): Promise<PromptVideo[]> {
    if (!supabase) return [];
    return (await call<{ videos: PromptVideo[] }>({ action: 'list', project_id: projectId })).videos;
  },
  async create(projectId: string, quality: VideoQuality): Promise<PromptVideo> {
    const r = await call<{ video: PromptVideo }>({ action: 'create', project_id: projectId, quality });
    store.notify(); // the credit balance changed
    return r.video;
  },
  async url(id: string, download?: string): Promise<string | null> {
    return (await call<{ url: string | null }>({ action: 'url', id, download })).url;
  },
  /** live progress (Realtime on the caller's rows); returns an unsubscribe function */
  watch(onChange: () => void): () => void {
    if (!supabase) return () => undefined;
    const db = supabase;
    const ch = db.channel(`prompt_videos_${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prompt_videos' }, () => onChange()).subscribe();
    return () => { void db.removeChannel(ch); };
  },
};
