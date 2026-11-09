// Video translation (dubbing): the browser uploads the video to the library bucket (<uid>/dubs/...), the `dubbing`
// Edge Function charges the credits and queues the job, the render worker produces it (render-engine/dub/dub.py).
import { InsufficientCreditsError } from './errors';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { store } from './store';

export type DubLanguage = 'fr' | 'en' | 'es';
export type DubStatus = 'queued' | 'working' | 'done' | 'failed';
export interface DubJob {
  id: string; title: string | null; target_language: DubLanguage; status: DubStatus; step: string | null; progress: number;
  error: string | null; video_path: string | null; seconds: number; credits_charged: number; created_at: string; finished_at: string | null;
}

const DEMO = 'La traduction de vidéos a besoin du serveur Storyit (mode démo).';

async function call<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error(DEMO);
  const { data, error } = await supabase.functions.invoke<T>('dubbing', { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const payload = ctx && typeof ctx.json === 'function' ? ((await ctx.json().catch(() => ({}))) as { error?: string; code?: string; needed?: number }) : {};
    if (payload.code === 'insufficient_credits') throw new InsufficientCreditsError(payload.needed ?? 0, 0);
    throw new Error(payload.error ?? error.message);
  }
  return data as T;
}

export const dubbing = {
  available: isSupabaseConfigured,
  async list(): Promise<DubJob[]> {
    if (!supabase) return [];
    return (await call<{ jobs: DubJob[] }>({ action: 'list' })).jobs;
  },
  /** uploads the video (private library folder), with upload progress */
  async upload(file: File, onProgress: (pct: number) => void): Promise<string> {
    if (!supabase) throw new Error(DEMO);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Veuillez vous reconnecter.');
    const ext = (file.name.split('.').pop() ?? 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
    const path = `${auth.user.id}/dubs/${crypto.randomUUID()}.${ext}`;
    onProgress(5);
    const { error } = await supabase.storage.from('library').upload(path, file, { contentType: file.type || 'video/mp4', upsert: false });
    if (error) throw new Error(/size/i.test(error.message) ? 'La vidéo est trop lourde (250 Mo maximum).' : "L'envoi de la vidéo a échoué. Réessayez.");
    onProgress(100);
    return path;
  },
  async create(input: { sourcePath: string; language: DubLanguage; voiceId?: string; replaceCaptions: boolean; seconds: number; title: string }) {
    const r = await call<{ id: string; credits: number }>({ action: 'create', source_path: input.sourcePath, language: input.language, voice_id: input.voiceId,
      replace_captions: input.replaceCaptions, seconds: input.seconds, title: input.title });
    store.notify();
    return r;
  },
  async url(id: string, download?: string): Promise<string | null> {
    return (await call<{ url: string | null }>({ action: 'url', id, download })).url;
  },
  async remove(id: string) {
    await call({ action: 'delete', id });
    store.notify();
  },
  /** live progress (Realtime on the caller's rows); returns an unsubscribe function */
  watch(onChange: () => void): () => void {
    if (!supabase) return () => undefined;
    const db = supabase;
    const ch = db.channel('dub_jobs').on('postgres_changes', { event: '*', schema: 'public', table: 'dub_jobs' }, () => onChange()).subscribe();
    return () => { void db.removeChannel(ch); };
  },
};
