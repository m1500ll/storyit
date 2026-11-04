import type { SupabaseClient } from '@supabase/supabase-js';
import { store } from '../store';
import type { Campaign, DistributionRepository, MediaAsset, Publication, SocialAccount } from './types';

const SIGNED_TTL = 15 * 60; // previews only; never permanent links

async function fnError(error: unknown) {
  const ctx = (error as { context?: Response }).context;
  const msg = ctx && typeof ctx.json === 'function' ? ((await ctx.json().catch(() => ({}))) as { error?: string }).error : undefined;
  return new Error(msg ?? (error instanceof Error ? error.message : 'Request failed'));
}
function check<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new Error(friendly(res.error.message));
  return (res.data ?? []) as NonNullable<T>;
}
/** Database guard messages → plain language. */
const friendly = (m: string) =>
  m.includes('publications_one_per_destination') ? 'This video is already scheduled or published on this account.'
    : m.startsWith('plan_limit: ') ? m.slice(12)
    : m.startsWith('tiktok_settings_required: ') ? 'TikTok: ' + m.slice(26)
    : m.startsWith('caption_required: ') ? m.slice(18)
    : m;

export function createSupabaseDistribution(db: SupabaseClient): DistributionRepository {
  const any = db as SupabaseClient<any>;
  const uid = async () => {
    const { data } = await db.auth.getUser();
    if (!data.user) throw new Error('Not signed in');
    return data.user.id;
  };
  const invoke = async <T>(fn: string, body: Record<string, unknown>): Promise<T> => {
    const { data, error } = await db.functions.invoke<T>(fn, { body });
    if (error) throw await fnError(error);
    return data as T;
  };
  const done = <T>(v: T) => { store.notify(); return v; };

  return {
    async integrationStatus() {
      try {
        const s = await invoke<{ open?: boolean; tiktok: boolean; instagram: boolean; encryption: boolean; ai: boolean }>('social', { action: 'status' });
        return { ...s, live: true };
      } catch {
        return { tiktok: false, instagram: false, encryption: false, ai: false, live: true };
      }
    },
    async planLimits() {
      const { data: profile } = await any.from('profiles').select('plan').eq('id', await uid()).maybeSingle();
      if (!profile) return null;
      const { data } = await any.from('plan_limits').select('*').eq('plan', profile.plan).maybeSingle();
      return data ?? null;
    },

    listAccounts: async () => check(await any.from('social_accounts').select('*').neq('status', 'disconnected').order('platform').order('created_at')) as SocialAccount[],
    startConnect: async (platform) => (await invoke<{ url: string }>('social', { action: 'start', platform, return_origin: window.location.origin })).url,
    verifyAccount: async (id) => done(void (await invoke('social', { action: 'verify', account_id: id }))),
    disconnectAccount: async (id) => done(void (await invoke('social', { action: 'disconnect', account_id: id }))),
    updateAccount: async (id, patch) => done(void check(await any.from('social_accounts').update(patch).eq('id', id))),
    listGroups: async () => check(await any.from('social_account_groups').select('id, name').order('name')),
    createGroup: async (name) => done(check(await any.from('social_account_groups').insert({ name: name.trim(), user_id: await uid() }).select('id, name').single())),
    deleteGroup: async (id) => done(void check(await any.from('social_account_groups').delete().eq('id', id))),

    async listMedia() {
      const rows = check(await any.from('media_assets').select('*').order('created_at', { ascending: false })) as MediaAsset[];
      const paths = rows.filter((r) => r.status === 'available').map((r) => r.storage_path);
      const { data } = paths.length ? await db.storage.from('library').createSignedUrls(paths, SIGNED_TTL) : { data: [] };
      const url = new Map((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
      return rows.map((r) => ({ ...r, preview_url: url.get(r.storage_path) ?? null }));
    },
    async uploadMedia(file, meta, onProgress) {
      const user = await uid();
      const ext = file.type === 'video/quicktime' ? 'mov' : file.type === 'video/webm' ? 'webm' : 'mp4';
      const id = crypto.randomUUID();
      const path = `${user}/${id}.${ext}`;
      // Row first: the database checks the plan limit and the file size before any byte is uploaded.
      const row = check(await any.from('media_assets').insert({
        id, user_id: user, title: meta.title, notes: meta.notes ?? null, tags: meta.tags, storage_path: path, mime: file.type, size_bytes: file.size,
        duration_seconds: meta.duration ?? null, width: meta.width ?? null, height: meta.height ?? null, status: 'uploading',
      }).select().single()) as MediaAsset;
      try {
        const { data: signed, error } = await db.storage.from('library').createSignedUploadUrl(path);
        if (error || !signed) throw new Error(error?.message ?? 'Could not prepare the upload');
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', signed.signedUrl);
          xhr.setRequestHeader('Content-Type', file.type);
          xhr.setRequestHeader('x-upsert', 'false');
          xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
          xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
          xhr.onerror = () => reject(new Error('Network error during upload'));
          xhr.send(file);
        });
        check(await any.from('media_assets').update({ status: 'available' }).eq('id', id));
        return done({ ...row, status: 'available' as const });
      } catch (e) {
        await any.from('media_assets').update({ status: 'error', notes: `Upload failed: ${e instanceof Error ? e.message : e}` }).eq('id', id);
        store.notify();
        throw e;
      }
    },
    async deleteFailedMedia(id) {
      const row = check(await any.from('media_assets').select('storage_path, status').eq('id', id).maybeSingle()) as { storage_path: string; status: string };
      if (!row?.storage_path) throw new Error('Video not found');
      if (!['error', 'uploading'].includes(row.status)) throw new Error('Only failed uploads can be removed. Archive the video instead.');
      await db.storage.from('library').remove([row.storage_path]).catch(() => undefined);
      check(await any.from('media_assets').delete().eq('id', id));
      store.notify();
    },
    updateMedia: async (id, patch) => done(void check(await any.from('media_assets').update(patch).eq('id', id))),

    async listPublications(f = {}) {
      let q = any.from('scheduled_publications').select('*').order('scheduled_at');
      if (f.from) q = q.gte('scheduled_at', f.from);
      if (f.to) q = q.lt('scheduled_at', f.to);
      if (f.mediaId) q = q.eq('media_id', f.mediaId);
      if (f.accountId) q = q.eq('account_id', f.accountId);
      return check(await q.limit(2000)) as Publication[];
    },
    async schedulePublications(rows) {
      const user = await uid();
      let created = 0;
      let duplicates = 0;
      for (const r of rows) {
        const { error } = await any.from('scheduled_publications').insert({ ...r, user_id: user, status: 'scheduled' });
        if (!error) created++;
        else if (error.code === '23505') duplicates++;
        else throw new Error(friendly(error.message));
      }
      return done({ created, duplicates });
    },
    creatorInfo: async (accountId) => invoke('social', { action: 'creator_info', account_id: accountId }),
    updatePublication: async (id, patch) => done(void check(await any.from('scheduled_publications').update(patch).eq('id', id))),
    generateCaptions: async (ids, force) => done((await invoke<{ results: { id: string; ok: boolean; error?: string; skipped?: string }[] }>('captions', { publication_ids: ids, force })).results),
    listEvents: async (id) => check(await any.from('publication_events').select('*').eq('publication_id', id).order('id')),

    async listCampaigns() {
      return check(await any.from('campaigns').select('*, targets:campaign_targets(account_id, bucket)').order('created_at', { ascending: false })) as Campaign[];
    },
    async createCampaign(c) {
      const user = await uid();
      const row = check(await any.from('campaigns').insert({ user_id: user, name: c.name, mode: c.mode, timezone: c.timezone, config: c.config, status: 'active' }).select().single());
      check(await any.from('campaign_targets').insert(c.targets.map((t) => ({ campaign_id: row.id, account_id: t.account_id, bucket: t.bucket ?? null }))));
      return done({ ...row, targets: c.targets.map((t) => ({ account_id: t.account_id, bucket: t.bucket ?? null })) } as Campaign);
    },
    setCampaignStatus: async (id, status) => done(void check(await any.from('campaigns').update({ status }).eq('id', id))),
  };
}
