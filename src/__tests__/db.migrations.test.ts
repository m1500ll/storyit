/**
 * Database tests: replays every migration (0001 → 0006) on a real PostgreSQL (PGlite) with a minimal
 * Supabase-like environment (auth.uid(), roles, storage), then checks constraints, RLS and guards
 * with two separate customers. No network, no production database.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

const SUPABASE_STUB = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create schema storage;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'service_role') $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
create publication supabase_realtime;
-- Like Supabase: new objects in public are granted to API roles by default (migrations then revoke what must stay private).
grant usage on schema public, auth, storage to authenticated, anon, service_role;
alter default privileges in schema public grant all on tables to authenticated, service_role;
alter default privileges in schema public grant all on sequences to authenticated, service_role;
alter default privileges in schema public grant execute on functions to public;
grant all on all tables in schema storage to authenticated;
`;

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
let db: PGlite;

/** Runs `sql` as a signed-in customer (RLS + guards apply). */
async function as(user: string, sql: string, params: unknown[] = []) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role authenticated; select set_config('request.jwt.claim.sub', '${user}', true), set_config('request.jwt.claim.role', 'authenticated', true);`);
    return tx.query<Record<string, any>>(sql, params);
  });
}
const service = (sql: string, params: unknown[] = []) => db.query<Record<string, any>>(sql, params);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const dir = join(__dirname, '../../supabase/migrations');
  // 0007 only schedules the worker with pg_cron/pg_net (Supabase infrastructure, not available in PGlite).
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql') && !f.includes('_cron')).sort()) await db.exec(readFileSync(join(dir, f), 'utf8'));
  await service(`insert into auth.users (id, email) values ($1, 'a@x.test'), ($2, 'b@x.test')`, [A, B]);
  // Accounts are created by the OAuth callback (service role): 3 TikTok + 3 Instagram for A, 1 for B.
  for (const [i, p] of ['tiktok', 'tiktok', 'tiktok', 'instagram', 'instagram', 'instagram'].entries()) {
    await service(`insert into social_accounts (id, user_id, platform, external_id, username, can_publish) values ($1, $2, $3, $4, $5, true)`,
      [`10000000-0000-4000-8000-00000000000${i}`, A, p, `ext-${i}`, `${p}_${i}`]);
  }
  await service(`insert into social_accounts (id, user_id, platform, external_id, can_publish) values ('20000000-0000-4000-8000-000000000000', $1, 'tiktok', 'ext-b', true)`, [B]);
}, 60_000);

const ACC = (i: number) => `10000000-0000-4000-8000-00000000000${i}`;
async function video(user: string, title = 'Vidéo') {
  const id = crypto.randomUUID();
  await as(user, `insert into media_assets (id, user_id, title, storage_path, mime, size_bytes, status) values ($1, $2, $3, $4, 'video/mp4', 1000, 'available')`,
    [id, user, title, `${user}/${id}.mp4`]);
  return id;
}
const publish = (user: string, media: string, account: string, platform: string, key = crypto.randomUUID()) =>
  as(user, `insert into scheduled_publications (user_id, media_id, account_id, platform, scheduled_at, idempotency_key) values ($1, $2, $3, $4, now(), $5) returning id`,
    [user, media, account, platform, key]);

describe('migrations & constraints (PostgreSQL)', () => {
  it('applies all migrations on a fresh database', async () => {
    const { rows } = await service(`select count(*)::int n from information_schema.tables where table_schema = 'public' and table_name in
      ('social_accounts','social_account_tokens','media_assets','campaigns','campaign_targets','scheduled_publications','publication_events','plan_limits')`);
    expect(rows[0]!.n).toBe(8);
  });

  it('one video, six destinations: six independent publications', async () => {
    const v = await video(A);
    for (let i = 0; i < 6; i++) await publish(A, v, ACC(i), i < 3 ? 'tiktok' : 'instagram');
    const { rows } = await as(A, `select count(*)::int n from scheduled_publications where media_id = $1`, [v]);
    expect(rows[0]!.n).toBe(6);
  });

  it('blocks a second active publication of the same video on the same account', async () => {
    const v = await video(A);
    await publish(A, v, ACC(0), 'tiktok');
    await expect(publish(A, v, ACC(0), 'tiktok')).rejects.toThrow(/publications_one_per_destination/);
    await publish(A, v, ACC(1), 'tiktok'); // another account is fine
  });

  it('allows a new attempt only after the previous one failed or was cancelled', async () => {
    const v = await video(A);
    const { rows } = await publish(A, v, ACC(2), 'tiktok');
    await service(`update scheduled_publications set status = 'failed' where id = $1`, [rows[0]!.id]);
    await expect(publish(A, v, ACC(2), 'tiktok')).resolves.toBeTruthy();
  });

  it('isolates customers: B sees nothing of A and cannot target A’s accounts or videos', async () => {
    const v = await video(A);
    expect((await as(B, `select * from media_assets`)).rows).toEqual([]);
    expect((await as(B, `select * from social_accounts where user_id = $1`, [A])).rows).toEqual([]);
    expect((await as(B, `select * from scheduled_publications`)).rows).toEqual([]);
    await expect(publish(B, v, '20000000-0000-4000-8000-000000000000', 'tiktok')).rejects.toThrow(/video, account or campaign not found/);
    await expect(as(B, `insert into media_assets (user_id, title, storage_path, mime, size_bytes) values ($1, 't', $2, 'video/mp4', 1)`, [A, `${A}/x.mp4`])).rejects.toThrow();
  });

  it('tokens are invisible to customers', async () => {
    await service(`insert into social_account_tokens (account_id, access_token) values ($1, 'v1:secret')`, [ACC(0)]);
    expect((await as(A, `select * from social_account_tokens`)).rows).toEqual([]);
  });

  it('customers cannot fake a publication result or change the account owner', async () => {
    const v = await video(A);
    const { rows } = await publish(A, v, ACC(3), 'instagram');
    await expect(as(A, `update scheduled_publications set status = 'published' where id = $1`, [rows[0]!.id])).rejects.toThrow(/invalid status change/);
    await expect(as(A, `update scheduled_publications set external_post_id = 'x' where id = $1`, [rows[0]!.id])).rejects.toThrow(/server-managed/);
    await expect(as(A, `update social_accounts set user_id = $1 where id = $2`, [B, ACC(0)])).rejects.toThrow();
    await expect(as(A, `update social_accounts set can_publish = false, publish_restriction = null where id = $1`, [ACC(0)])).rejects.toThrow(/only the group and editorial/);
    await as(A, `update social_accounts set editorial = '{"tone":"drôle"}' where id = $1`, [ACC(0)]);
  });

  it('a started publication can no longer be edited; needs_attention can only be cancelled', async () => {
    const v = await video(A);
    const { rows } = await publish(A, v, ACC(4), 'instagram');
    await service(`update scheduled_publications set status = 'submitted' where id = $1`, [rows[0]!.id]);
    await expect(as(A, `update scheduled_publications set caption = 'x' where id = $1`, [rows[0]!.id])).rejects.toThrow(/already started/);
    await service(`update scheduled_publications set status = 'needs_attention' where id = $1`, [rows[0]!.id]);
    await expect(as(A, `update scheduled_publications set status = 'scheduled' where id = $1`, [rows[0]!.id])).rejects.toThrow();
    await as(A, `update scheduled_publications set status = 'cancelled' where id = $1`, [rows[0]!.id]);
  });

  it('only approved, due publications are claimed, and two workers never claim the same one', async () => {
    const v = await video(A);
    const { rows } = await publish(A, v, ACC(5), 'instagram');
    const id = rows[0]!.id;
    expect((await service(`select * from claim_publications('w1', 50)`)).rows.map((r) => r.id)).not.toContain(id); // not approved yet
    await as(A, `update scheduled_publications set caption = 'Hello', metadata_approved = true where id = $1`, [id]); // Instagram: no TikTok settings needed
    const [w1, w2] = await Promise.all([service(`select id from claim_publications('w1', 50)`), service(`select id from claim_publications('w2', 50)`)]);
    const all = [...w1.rows, ...w2.rows].map((r) => r.id).filter((x) => x === id);
    expect(all).toHaveLength(1);
    expect((await service(`select status, locked_by from scheduled_publications where id = $1`, [id])).rows[0]).toMatchObject({ status: 'processing' });
    expect((await service(`select id from claim_publications('w3', 50)`)).rows.map((r) => r.id)).not.toContain(id);
  });

  it('a paused campaign publishes nothing until it is resumed', async () => {
    const v = await video(A);
    const c = (await as(A, `insert into campaigns (user_id, name, mode, status) values ($1, 'Fruit FR', 'simultaneous', 'paused') returning id`, [A])).rows[0]!.id;
    const id = (await as(A, `insert into scheduled_publications (user_id, campaign_id, media_id, account_id, platform, scheduled_at, idempotency_key, caption, metadata_approved, platform_options)
      values ($1, $2, $3, $4, 'tiktok', now(), $5, 'Hi', true, '{"privacy_level":"SELF_ONLY","consented_at":"x"}') returning id`, [A, c, v, ACC(0), crypto.randomUUID()])).rows[0]!.id;
    expect((await service(`select id from claim_publications('w', 50)`)).rows.map((r) => r.id)).not.toContain(id);
    await as(A, `update campaigns set status = 'active' where id = $1`, [c]);
    expect((await service(`select id from claim_publications('w', 50)`)).rows.map((r) => r.id)).toContain(id);
  });

  it('TikTok posts cannot be approved without the user-confirmed visibility and declaration', async () => {
    const v = await video(A);
    const id = (await publish(A, v, ACC(2), 'tiktok')).rows[0]!.id;
    await expect(as(A, `update scheduled_publications set caption = 'Hi', metadata_approved = true where id = $1`, [id])).rejects.toThrow(/tiktok_settings_required/);
    await as(A, `update scheduled_publications set caption = 'Hi', metadata_approved = true, platform_options = '{"privacy_level":"SELF_ONLY","consented_at":"2026-11-04T10:00:00Z"}' where id = $1`, [id]);
    await expect(as(A, `update scheduled_publications set caption = '', hashtags = '{}', metadata_approved = true where id = $1`, [id])).rejects.toThrow(/caption_required/);
  });

  it('a publication cannot be attached to another customer’s campaign', async () => {
    const c = (await as(B, `insert into campaigns (user_id, name, mode) values ($1, 'B', 'simultaneous') returning id`, [B])).rows[0]!.id;
    const v = await video(A);
    await expect(as(A, `insert into scheduled_publications (user_id, campaign_id, media_id, account_id, platform, scheduled_at, idempotency_key) values ($1, $2, $3, $4, 'tiktok', now(), $5)`,
      [A, c, v, ACC(0), crypto.randomUUID()])).rejects.toThrow(/campaign not found/);
  });

  it('customers cannot read other customers’ plan through plan_limit()', async () => {
    await expect(as(A, `select plan_limit($1, 'max_media_assets')`, [B])).rejects.toThrow(/permission denied/);
  });

  it('customers cannot call the worker claim function', async () => {
    await expect(as(A, `select * from claim_publications('evil', 10)`)).rejects.toThrow(/permission denied/);
  });

  it('logs every status change in the history', async () => {
    const v = await video(A);
    const { rows } = await publish(A, v, ACC(1), 'tiktok');
    await as(A, `update scheduled_publications set status = 'cancelled' where id = $1`, [rows[0]!.id]);
    const ev = (await as(A, `select type, detail from publication_events where publication_id = $1 order by id`, [rows[0]!.id])).rows;
    expect(ev.map((e) => e.type)).toEqual(['created', 'status']);
    expect(ev[1]!.detail).toMatchObject({ from: 'scheduled', to: 'cancelled' });
  });

  it('enforces plan limits server-side', async () => {
    await service(`update plan_limits set max_media_assets = (select count(*) from media_assets where user_id = $1 and status <> 'archived') where plan = 'free'`, [A]);
    await expect(video(A)).rejects.toThrow(/plan_limit/);
    await service(`update plan_limits set max_media_assets = 20 where plan = 'free'`);
  });

  it('customers can delete their failed uploads only', async () => {
    const bad = (await as(A, `insert into media_assets (user_id, title, storage_path, mime, size_bytes, status) values ($1, 'x', $2, 'video/mp4', 1, 'error') returning id`, [A, `${A}/bad.mp4`])).rows[0]!.id;
    const good = await video(A);
    expect((await as(A, `delete from media_assets where id = $1 returning id`, [good])).rows).toEqual([]);
    expect((await as(B, `delete from media_assets where id = $1 returning id`, [bad])).rows).toEqual([]);
    expect((await as(A, `delete from media_assets where id = $1 returning id`, [bad])).rows).toHaveLength(1);
  });

  it('Gemini keys are never readable or writable by customers, not even their own', async () => {
    await service(`insert into user_ai_keys (user_id, key_enc, key_hint) values ($1, 'v1:enc', 'abcd')`, [A]);
    await expect(as(A, `select * from user_ai_keys`)).rejects.toThrow(/permission denied/);
    await expect(as(A, `update user_ai_keys set key_hint = 'x'`)).rejects.toThrow(/permission denied/);
    await expect(as(B, `insert into user_ai_keys (user_id, key_enc, key_hint) values ($1, 'x', 'x')`, [B])).rejects.toThrow(/permission denied/);
  });

  it('prompt projects are private to their owner', async () => {
    const id = (await service(`insert into prompt_projects (user_id, title, data) values ($1, 'Fraise', '{}') returning id`, [A])).rows[0]!.id;
    expect((await as(A, `select id from prompt_projects where id = $1`, [id])).rows).toHaveLength(1);
    expect((await as(B, `select id from prompt_projects where id = $1`, [id])).rows).toEqual([]);
    expect((await as(B, `delete from prompt_projects where id = $1 returning id`, [id])).rows).toEqual([]);
  });

  it('rejects uploads outside the customer folder', async () => {
    await expect(as(A, `insert into media_assets (user_id, title, storage_path, mime, size_bytes) values ($1, 't', $2, 'video/mp4', 1)`, [A, `${B}/x.mp4`])).rejects.toThrow(/invalid storage path/);
  });

  it('the rollback script removes everything 0006 added and leaves the earlier schema intact', async () => {
    const sql = readFileSync(join(__dirname, '../../docs/rollback_0006_0007.sql'), 'utf8')
      .replace(/select cron\.unschedule[^;]*;/, ''); // pg_cron is not available in PGlite
    await db.exec(sql);
    const { rows } = await service(`select count(*)::int n from information_schema.tables where table_schema = 'public' and table_name in ('social_accounts','scheduled_publications','media_assets')`);
    expect(rows[0]!.n).toBe(0);
    expect((await service(`select count(*)::int n from stories`)).rows[0]!.n).toBeGreaterThanOrEqual(0);
  });
});
