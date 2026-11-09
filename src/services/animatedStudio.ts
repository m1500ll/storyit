import { supabase } from '@/lib/supabase';
import { InsufficientCreditsError } from './errors';
import { store } from './store';
import { ANIMATED_SHORT_COST } from './credits';

export type AnimatedStatus = 'brief' | 'queued' | 'writing' | 'voicing' | 'rendering' | 'done' | 'failed';
export type DecorKey = 'river_town' | 'town_square' | 'stadium' | 'castle' | 'city' | 'lab' | 'harbour' | 'farm' | 'desert' | 'space';
export interface ChoiceOption { title: string; detail: string; emoji: string; decor?: DecorKey }
export interface Choices { step: 'format' | 'story' | 'decor' | 'other'; question: string; options: ChoiceOption[] }
export interface Brief { title: string; hook: string; format: string; decor: string; language: string; facts: { fact: string; source: string }[] }
/** a chat line; the studio's lines may carry clickable cards (choices) or the agreed recap (brief) */
export interface ChatLine { role: 'user' | 'assistant'; text: string; choices?: Choices; brief?: Brief }
export interface AnimatedProject {
  id: string; title: string | null; status: AnimatedStatus; progress: number; language: string;
  transcript?: ChatLine[]; video_path: string | null; error: string | null; credits_charged?: number;
  created_at: string; updated_at: string;
}

const DEMO = "L'Animated Studio a besoin du serveur Storyit (mode démo).";

async function call<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error(DEMO);
  const { data, error } = await supabase.functions.invoke<T>('animated-studio', { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const payload = ctx && typeof ctx.json === 'function' ? ((await ctx.json().catch(() => ({}))) as { error?: string; code?: string }) : {};
    if (payload.code === 'insufficient_credits') throw new InsufficientCreditsError(ANIMATED_SHORT_COST, 0);
    throw new Error(payload.error ?? error.message);
  }
  return data as T;
}

/** style of the big hook title at the start of the video (render-engine Overlay) */
export type TitleStyle = 'choc' | 'bandeau' | 'cinema';

export const animatedStudio = {
  available: Boolean(supabase),
  async list(): Promise<AnimatedProject[]> {
    if (!supabase) return [];
    return (await call<{ projects: AnimatedProject[] }>({ action: 'list' })).projects;
  },
  async get(id: string): Promise<AnimatedProject | null> {
    if (!supabase) return null;
    return (await call<{ project: AnimatedProject }>({ action: 'get', project_id: id })).project;
  },
  /** One turn of the brief chat (free). Creates the project on the first message. */
  async chat(message: string, projectId?: string, language = 'fr'): Promise<{ project_id: string; transcript: ChatLine[] }> {
    const r = await call<{ project_id: string; transcript: ChatLine[] }>({ action: 'chat', project_id: projectId, message, language });
    store.notify();
    return r;
  },
  /** Charges ANIMATED_SHORT_COST credits once and queues the render (refunded by the worker if it fails). */
  async generate(projectId: string, language: string, voiceId?: string, titleStyle?: TitleStyle): Promise<void> {
    await call({ action: 'generate', project_id: projectId, language, voice_id: voiceId, title_style: titleStyle });
    store.notify();
  },
  /** Short-lived URL of the finished MP4 (private bucket). With `download`, the file is served as an attachment under
   *  that name: the `download` attribute of a link is ignored across origins, so the browser would only play it. */
  async videoUrl(path: string, download?: string): Promise<string | null> {
    if (!supabase) return null;
    // new shorts live once in the library (<uid>/<id>.mp4); older ones and fallbacks in renders (<uid>/animated/<id>.mp4)
    const bucket = path.includes('/animated/') ? 'renders' : 'library';
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600, download ? { download } : undefined);
    return data?.signedUrl ?? null;
  },
  /** Live progress from the render worker (Realtime on the project's row). Returns an unsubscribe function. */
  watch(id: string, onChange: () => void): () => void {
    if (!supabase) return () => undefined;
    const db = supabase;
    const ch = db.channel(`animated:${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'animated_projects', filter: `id=eq.${id}` }, () => { store.notify(); onChange(); })
      .subscribe();
    return () => { void db.removeChannel(ch); };
  },
  async remove(id: string) {
    if (!supabase) return;
    await supabase.from('animated_projects' as never).delete().eq('id', id);
    store.notify();
  },
};
