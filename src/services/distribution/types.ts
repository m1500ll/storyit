import type { PubStatus, RotationConfig } from '@shared/distribution.ts';
import type { Editorial } from '@shared/captions.ts';
import type { CreatorInfo, TikTokOptions } from '@shared/platformSpecs.ts';
export type { CreatorInfo, TikTokOptions };

export type Platform = 'tiktok' | 'instagram';
export type { Editorial, PubStatus, RotationConfig };

export interface SocialAccount {
  id: string; platform: Platform; external_id: string; username: string | null; display_name: string | null; avatar_url: string | null;
  status: 'connected' | 'expired' | 'revoked' | 'error' | 'disconnected'; scopes: string[]; can_publish: boolean; publish_restriction: string | null;
  account_type: string | null; group_id: string | null; editorial: Editorial & { privacy_level?: string }; last_verified_at: string | null; last_error: string | null; created_at: string;
}
export interface AccountGroup { id: string; name: string }
export interface MediaAsset {
  id: string; title: string; notes: string | null; tags: string[]; storage_path: string; mime: string; size_bytes: number;
  duration_seconds: number | null; width: number | null; height: number | null; status: 'uploading' | 'available' | 'archived' | 'error'; created_at: string;
  preview_url?: string | null;
}
export interface Publication {
  id: string; campaign_id: string | null; media_id: string; account_id: string; platform: Platform; scheduled_at: string; status: PubStatus;
  caption: string | null; hook: string | null; title: string | null; hashtags: string[]; metadata_source: 'none' | 'ai' | 'manual';
  caption_edited: boolean; metadata_approved: boolean; metadata_warnings: string[]; platform_options: TikTokOptions; attempts: number; max_attempts: number;
  external_id: string | null; external_post_id: string | null; external_url: string | null; last_error: string | null;
  last_checked_at: string | null; published_at: string | null; created_at: string; updated_at: string;
}
export interface Campaign {
  id: string; name: string; mode: 'simultaneous' | 'rotation'; status: 'draft' | 'active' | 'paused' | 'completed'; timezone: string;
  config: Partial<RotationConfig> & { auto_approve?: boolean }; planned_until: string | null; alert: string | null; created_at: string; targets: { account_id: string; bucket: string | null }[];
}
export interface PublicationEvent { id: number; publication_id: string; type: string; detail: Record<string, unknown>; created_at: string }
export interface IntegrationStatus { open?: boolean; tiktok: boolean; instagram: boolean; encryption: boolean; ai: boolean; live: boolean }
export interface PlanLimits { plan: string; max_social_accounts: number | null; max_media_assets: number | null; max_pending_publications: number | null; max_upload_mb: number }

/** Video lifecycle derived from its real publications (never a stored "published everywhere" flag). */
export type VideoState = 'available' | 'scheduled' | 'publishing' | 'partially_published' | 'published' | 'error' | 'archived';

export interface DistributionRepository {
  integrationStatus(): Promise<IntegrationStatus>;
  planLimits(): Promise<PlanLimits | null>;
  // accounts
  listAccounts(): Promise<SocialAccount[]>;
  startConnect(platform: Platform): Promise<string>;
  verifyAccount(id: string): Promise<void>;
  disconnectAccount(id: string): Promise<void>;
  updateAccount(id: string, patch: { group_id?: string | null; editorial?: SocialAccount['editorial'] }): Promise<void>;
  listGroups(): Promise<AccountGroup[]>;
  createGroup(name: string): Promise<AccountGroup>;
  deleteGroup(id: string): Promise<void>;
  // library
  listMedia(): Promise<MediaAsset[]>;
  uploadMedia(file: File, meta: { title: string; notes?: string; tags: string[]; duration?: number | null; width?: number | null; height?: number | null }, onProgress: (pct: number) => void): Promise<MediaAsset>;
  /** Removes a failed or interrupted upload (row + file). */
  deleteFailedMedia(id: string): Promise<void>;
  updateMedia(id: string, patch: Partial<Pick<MediaAsset, 'title' | 'notes' | 'tags' | 'status'>>): Promise<void>;
  // publications
  listPublications(filter?: { from?: string; to?: string; mediaId?: string; accountId?: string }): Promise<Publication[]>;
  schedulePublications(rows: { media_id: string; account_id: string; platform: Platform; scheduled_at: string; idempotency_key: string; campaign_id?: string | null }[]): Promise<{ created: number; duplicates: number }>;
  /** Live TikTok creator info (nickname, allowed visibility, interaction settings, max duration). */
  creatorInfo(accountId: string): Promise<CreatorInfo>;
  updatePublication(id: string, patch: Partial<Pick<Publication, 'caption' | 'hook' | 'title' | 'hashtags' | 'scheduled_at' | 'metadata_approved' | 'caption_edited' | 'metadata_source' | 'platform_options'>> & { status?: 'scheduled' | 'cancelled' | 'draft' }): Promise<void>;
  generateCaptions(ids: string[], force?: boolean): Promise<{ id: string; ok: boolean; error?: string; skipped?: string }[]>;
  listEvents(publicationId: string): Promise<PublicationEvent[]>;
  // campaigns
  listCampaigns(): Promise<Campaign[]>;
  createCampaign(c: { name: string; mode: Campaign['mode']; timezone: string; config: Campaign['config']; targets: { account_id: string; bucket?: string | null }[] }): Promise<Campaign>;
  setCampaignStatus(id: string, status: 'active' | 'paused'): Promise<void>;
}
