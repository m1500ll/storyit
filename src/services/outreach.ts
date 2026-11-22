import { supabase } from '@/lib/supabase';

/** Creator outreach (owner only), built by the `outreach` Edge Function. Messages are sent by hand from TikTok. */
export type OutreachStatus = 'to_contact' | 'contacted' | 'replied' | 'partner' | 'declined';
export interface OutreachCreator {
  id: string; handle: string; display_name: string | null; followers: number | null; niche: string | null; notes: string | null;
  status: OutreachStatus; message: string | null; follow_up_count: number; contacted_at: string | null; last_message_at: string | null; created_at: string;
}
export interface OutreachPatch { status?: OutreachStatus; notes?: string; niche?: string; display_name?: string; followers?: number | null; message?: string; sent_follow_up?: boolean }

async function call<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('La prospection a besoin du serveur Storyit.');
  const { data, error } = await supabase.functions.invoke<T>('outreach', { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const msg = ctx && typeof ctx.json === 'function' ? ((await ctx.json().catch(() => ({}))) as { error?: string }).error : undefined;
    throw new Error(msg ?? error.message);
  }
  return data as T;
}

export const outreach = {
  list: () => call<{ creators: OutreachCreator[]; partners: { code: string; name: string }[] }>({ action: 'list' }),
  add: (handles: string, niche: string) => call<{ added: number; recognised: number }>({ action: 'add', handles, niche }),
  update: (id: string, patch: OutreachPatch) => call<{ creator: OutreachCreator }>({ action: 'update', id, patch }),
  remove: (id: string) => call<{ ok: boolean }>({ action: 'remove', id }),
  draft: (id: string, kind: 'first' | 'follow_up') => call<{ message: string }>({ action: 'draft', id, kind }),
};
