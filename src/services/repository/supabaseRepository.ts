import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { StoryWithScenes } from '@/types/domain';
import { store } from '../store';
import { InsufficientCreditsError } from '../errors';
import type { Repository } from './types';

const STORY_SELECT = '*, scenes(*), characters(*)';

function unwrap<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/** Like unwrap, but for queries that must return data (insert…select, list). */
function required<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  const data = unwrap(res);
  if (data == null) throw new Error('Unexpected empty response from Supabase');
  return data;
}

const sortScenes = (s: StoryWithScenes): StoryWithScenes => ({ ...s, scenes: [...s.scenes].sort((a, b) => a.position - b.position) });

export function createSupabaseRepository(db: SupabaseClient<Database>): Repository {
  const uid = async () => {
    const { data } = await db.auth.getUser();
    if (!data.user) throw new Error('Not signed in');
    return data.user.id;
  };

  return {
    async getProfile() {
      const id = await uid();
      return unwrap(await db.from('profiles').select('*').eq('id', id).maybeSingle());
    },

    async listTransactions() {
      return required(await db.from('credit_transactions').select('*').order('created_at', { ascending: false }).limit(50));
    },

    async consumeCredits(amount, storyId, description) {
      const { data, error } = await db.rpc('consume_credits', { p_amount: amount, p_story_id: storyId, p_description: description });
      if (error) {
        if (error.message.includes('insufficient_credits')) {
          const profile = await this.getProfile();
          throw new InsufficientCreditsError(amount, profile?.credit_balance ?? 0);
        }
        throw new Error(error.message);
      }
      store.notify();
      return data;
    },

    async listStories() {
      const rows = required(await db.from('stories').select(STORY_SELECT).order('created_at', { ascending: false }));
      return (rows as unknown as StoryWithScenes[]).map(sortScenes);
    },

    async getStory(id) {
      const row = unwrap(await db.from('stories').select(STORY_SELECT).eq('id', id).maybeSingle());
      return row ? sortScenes(row as unknown as StoryWithScenes) : null;
    },

    async createStory(idea, concept, drafts) {
      const user_id = await uid();
      const story = required(await db.from('stories').insert({
        user_id, idea, title: concept.title, logline: concept.logline, status: 'scenes_ready',
      }).select().single());

      const characters = required(await db.from('characters').insert(
        concept.characters.map((c) => ({ ...c, story_id: story.id, voice_style: null, reference_image_url: null })),
      ).select());

      unwrap(await db.from('scenes').insert(
        drafts.map((d) => ({ ...d, story_id: story.id, character_ids: characters.map((c) => c.id) })),
      ));

      store.notify();
      const full = await this.getStory(story.id);
      if (!full) throw new Error('Story was created but could not be read back');
      return full;
    },

    async setStoryStatus(id, status) {
      unwrap(await db.from('stories').update({ status }).eq('id', id));
      store.notify();
    },

    // Approval revocation is enforced by the `scenes_revoke_approval` DB trigger.
    async updateScene(_storyId, sceneId, patch) {
      unwrap(await db.from('scenes').update(patch).eq('id', sceneId));
      store.notify();
    },

    async setSceneStatus(sceneId, status) {
      unwrap(await db.from('scenes').update({ status, error_message: null }).eq('id', sceneId));
      store.notify();
    },

    async approveStory(id, hash) {
      unwrap(await db.from('stories').update({ approved_hash: hash, approved_at: new Date().toISOString(), status: 'approved' }).eq('id', id));
      store.notify();
    },
  };
}

/** Pushes DB changes (e.g. from a render worker or another tab) into the UI. */
export function subscribeToRealtime(db: SupabaseClient<Database>) {
  const channel = db.channel('storyit-changes');
  for (const table of ['stories', 'scenes', 'profiles', 'credit_transactions'] as const) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => store.notify());
  }
  channel.subscribe();
  return () => void db.removeChannel(channel);
}
