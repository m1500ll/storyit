import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { StoryWithScenes } from '@/types/domain';
import { store } from '../store';
import { InsufficientCreditsError } from '../errors';
import type { RenderProgress, Repository } from './types';
import type { PublishPack, Thumbnail } from '@/lib/publishPack';

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

const SIGNED_TTL = 60 * 60; // 1h

/** Replaces private storage paths with short-lived signed URLs the browser can load. */
async function withMediaUrls(db: SupabaseClient<Database>, stories: StoryWithScenes[]): Promise<StoryWithScenes[]> {
  const paths = stories.flatMap((st) => st.scenes.flatMap((s) => [s.image_path, s.video_path, s.audio_path])).filter((p): p is string => Boolean(p));
  if (paths.length === 0) return stories;
  const { data } = await db.storage.from('renders').createSignedUrls(paths, SIGNED_TTL);
  const url = new Map((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
  const get = (p: string | null) => (p ? url.get(p) ?? null : null);
  return stories.map((st) => ({
    ...st,
    scenes: st.scenes.map((s) => ({ ...s, image_url: get(s.image_path), video_url: get(s.video_path), audio_url: get(s.audio_path) })),
  }));
}

async function invokeRender(db: SupabaseClient<Database>, body: Record<string, unknown>, fn = 'render'): Promise<RenderProgress> {
  const { data, error } = await db.functions.invoke<RenderProgress>(fn, { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const msg = ctx && typeof ctx.json === 'function' ? ((await ctx.json().catch(() => ({}))) as { error?: string }).error : undefined;
    if (msg && /not enough story credits/i.test(msg)) throw new InsufficientCreditsError(0, 0);
    throw new Error(msg ?? error.message);
  }
  store.notify();
  return data!;
}

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
      return withMediaUrls(db, (rows as unknown as StoryWithScenes[]).map(sortScenes));
    },

    async getStory(id) {
      const row = unwrap(await db.from('stories').select(STORY_SELECT).eq('id', id).maybeSingle());
      return row ? (await withMediaUrls(db, [sortScenes(row as unknown as StoryWithScenes)]))[0]! : null;
    },

    async createStory(idea, concept, drafts) {
      const user_id = await uid();
      const story = required(await db.from('stories').insert({
        user_id, idea, title: concept.title, logline: concept.logline, status: 'scenes_ready',
      }).select().single());

      const characters = required(await db.from('characters').insert(
        concept.characters.map((c) => ({ ...c, story_id: story.id, voice_style: c.voice_style ?? null, reference_image_url: null })),
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

    startRender: (storyId) => invokeRender(db, { action: 'start', story_id: storyId }),
    tickRender: (storyId) => invokeRender(db, { action: 'tick', story_id: storyId }),
    retryScene: (storyId, sceneId, fromStart) => invokeRender(db, { action: 'retry', story_id: storyId, scene_id: sceneId, from_start: fromStart }),

    async getPublishPack(storyId) {
      const pack = unwrap(await db.from('publish_packs').select('*').eq('story_id', storyId).maybeSingle()) as unknown as PublishPack | null;
      const rows = (required(await db.from("thumbnails").select("*").eq("story_id", storyId).order("created_at", { ascending: false })) as unknown as Thumbnail[]);
      const paths = rows.map((t) => t.image_path).filter((p): p is string => Boolean(p));
      const { data } = paths.length ? await db.storage.from('renders').createSignedUrls(paths, SIGNED_TTL) : { data: [] };
      const url = new Map((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
      return { pack, thumbnails: rows.map((t) => ({ ...t, image_url: t.image_path ? url.get(t.image_path) ?? null : null })) };
    },

    async generatePublishPack(storyId) {
      await invokeRender(db, { task: 'publish_pack', story_id: storyId }, 'gemini');
    },

    async generateThumbnail(storyId, aspect) {
      await invokeRender(db, { action: 'thumbnail', story_id: storyId, aspect_ratio: aspect });
    },

    async savePublishChoices(storyId, choices) {
      unwrap(await db.from('publish_packs').update(choices).eq('story_id', storyId));
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
  for (const table of ['stories', 'scenes', 'profiles', 'credit_transactions', 'publish_packs', 'thumbnails'] as const) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => store.notify());
  }
  channel.subscribe();
  return () => void db.removeChannel(channel);
}
