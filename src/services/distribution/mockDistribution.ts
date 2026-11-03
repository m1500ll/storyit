/**
 * Demo mode (no Supabase configured): everything stays in this browser tab.
 * Honest by design: no account can really be connected, nothing is ever published, no AI text is invented.
 */
import { store } from '../store';
import type { AccountGroup, Campaign, DistributionRepository, MediaAsset, Publication, PublicationEvent, SocialAccount } from './types';

const now = () => new Date().toISOString();
const demoAccount = (i: number, platform: 'tiktok' | 'instagram', username: string): SocialAccount => ({
  id: `demo-acc-${i}`, platform, external_id: `demo-${i}`, username, display_name: username, avatar_url: null, status: 'connected',
  scopes: [], can_publish: false, publish_restriction: 'Demo account: nothing is ever posted', account_type: null, group_id: null,
  editorial: {}, last_verified_at: now(), last_error: null, created_at: now(),
});

export function createMockDistribution(): DistributionRepository {
  const db = {
    accounts: [demoAccount(1, 'tiktok', 'demo_fruitdrama_fr'), demoAccount(2, 'instagram', 'demo.fruitdrama')],
    groups: [] as AccountGroup[],
    media: [] as MediaAsset[],
    pubs: [] as Publication[],
    events: [] as PublicationEvent[],
    campaigns: [] as Campaign[],
  };
  const keys = new Set<string>();
  const changed = <T>(v: T) => { store.notify(); return v; };
  const log = (p: Publication, type: string, detail: Record<string, unknown> = {}) =>
    db.events.push({ id: db.events.length + 1, publication_id: p.id, type, detail, created_at: now() });

  return {
    integrationStatus: async () => ({ tiktok: false, instagram: false, encryption: false, ai: false, live: false }),
    planLimits: async () => null,

    listAccounts: async () => db.accounts.filter((a) => a.status !== 'disconnected'),
    startConnect: async () => { throw new Error('Demo mode: connecting a real account needs the live Storyit backend.'); },
    verifyAccount: async () => { throw new Error('Demo accounts cannot be verified.'); },
    async disconnectAccount(id) {
      const a = db.accounts.find((x) => x.id === id);
      if (a) a.status = 'disconnected';
      db.pubs.filter((p) => p.account_id === id && ['draft', 'scheduled'].includes(p.status)).forEach((p) => { p.status = 'cancelled'; p.last_error = 'Account disconnected'; });
      changed(undefined);
    },
    async updateAccount(id, patch) { Object.assign(db.accounts.find((a) => a.id === id) ?? {}, patch); changed(undefined); },
    listGroups: async () => db.groups,
    async createGroup(name) {
      if (db.groups.some((g) => g.name === name.trim())) throw new Error('A group with this name already exists.');
      const g = { id: crypto.randomUUID(), name: name.trim() };
      db.groups.push(g);
      return changed(g);
    },
    async deleteGroup(id) { db.groups = db.groups.filter((g) => g.id !== id); db.accounts.forEach((a) => a.group_id === id && (a.group_id = null)); changed(undefined); },

    listMedia: async () => db.media,
    async uploadMedia(file, meta, onProgress) {
      for (const p of [25, 60, 100]) { onProgress(p); await new Promise((r) => setTimeout(r, 80)); }
      const m: MediaAsset = {
        id: crypto.randomUUID(), title: meta.title, notes: meta.notes ?? null, tags: meta.tags, storage_path: `demo/${file.name}`, mime: file.type,
        size_bytes: file.size, duration_seconds: meta.duration ?? null, width: meta.width ?? null, height: meta.height ?? null, status: 'available',
        created_at: now(), preview_url: typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null,
      };
      db.media.unshift(m);
      return changed(m);
    },
    async updateMedia(id, patch) { Object.assign(db.media.find((m) => m.id === id) ?? {}, patch); changed(undefined); },

    async listPublications(f = {}) {
      return db.pubs.filter((p) => (!f.from || p.scheduled_at >= f.from) && (!f.to || p.scheduled_at < f.to)
        && (!f.mediaId || p.media_id === f.mediaId) && (!f.accountId || p.account_id === f.accountId))
        .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
    },
    async schedulePublications(rows) {
      let created = 0;
      let duplicates = 0;
      for (const r of rows) {
        const clash = db.pubs.some((p) => p.media_id === r.media_id && p.account_id === r.account_id && !['failed', 'cancelled'].includes(p.status));
        if (clash || keys.has(r.idempotency_key)) { duplicates++; continue; }
        const p = {
          id: crypto.randomUUID(), campaign_id: r.campaign_id ?? null, media_id: r.media_id, account_id: r.account_id, platform: r.platform,
          scheduled_at: r.scheduled_at, status: 'scheduled', caption: null, hook: null, title: null, hashtags: [], metadata_source: 'none',
          caption_edited: false, metadata_approved: false, metadata_warnings: [], attempts: 0, max_attempts: 3, external_id: null,
          external_post_id: null, external_url: null, last_error: null, last_checked_at: null, published_at: null, created_at: now(), updated_at: now(),
        } as Publication;
        db.pubs.push(p);
        keys.add(r.idempotency_key);
        log(p, 'created', { status: 'scheduled' });
        created++;
      }
      return changed({ created, duplicates });
    },
    async updatePublication(id, patch) {
      const p = db.pubs.find((x) => x.id === id);
      if (!p) throw new Error('Publication not found');
      if (!['draft', 'scheduled', 'failed', 'needs_attention'].includes(p.status)) throw new Error(`Publication already started (${p.status}), it can no longer be changed`);
      if (patch.status && patch.status !== p.status) log(p, 'status', { from: p.status, to: patch.status });
      Object.assign(p, patch, { updated_at: now() });
      changed(undefined);
    },
    generateCaptions: async (ids) => ids.map((id) => ({ id, ok: false, error: 'AI captions are not available in demo mode: write the caption manually.' })),
    listEvents: async (id) => db.events.filter((e) => e.publication_id === id),

    listCampaigns: async () => db.campaigns,
    async createCampaign(c) {
      const row: Campaign = { id: crypto.randomUUID(), name: c.name, mode: c.mode, status: 'active', timezone: c.timezone, config: c.config, planned_until: null,
        alert: c.mode === 'rotation' ? 'Demo mode: the server-side planner does not run, so no publication will be created.' : null,
        created_at: now(), targets: c.targets.map((t) => ({ account_id: t.account_id, bucket: t.bucket ?? null })) };
      db.campaigns.unshift(row);
      return changed(row);
    },
    async setCampaignStatus(id, status) { Object.assign(db.campaigns.find((c) => c.id === id) ?? {}, { status }); changed(undefined); },
  };
}
