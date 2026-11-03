-- Multi-account distribution: social accounts, video library, campaigns, scheduled publications.
-- Run after 0005. Isolation unit = the user (profiles.id); a workspace table can be added later
-- without changing these relations (every row carries user_id).

-- ---------- Plan limits (server-side, configurable; NULL = unlimited) ----------
create table if not exists plan_limits (
  plan text primary key,
  max_social_accounts integer,
  max_media_assets integer,
  max_pending_publications integer,
  max_upload_mb integer not null default 250
);
insert into plan_limits (plan, max_social_accounts, max_media_assets, max_pending_publications) values
  ('free', 2, 20, 50), ('creator', 10, 500, 2000), ('studio', null, null, null)
on conflict (plan) do nothing;
alter table plan_limits enable row level security;
drop policy if exists "read limits" on plan_limits;
create policy "read limits" on plan_limits for select using (true);

create or replace function plan_limit(p_user uuid, p_field text) returns integer
language sql stable security definer set search_path = public as $$
  select (to_jsonb(l) ->> p_field)::integer from plan_limits l join profiles p on p.plan = l.plan where p.id = p_user
$$;
revoke execute on function plan_limit(uuid, text) from public, anon, authenticated;
grant execute on function plan_limit(uuid, text) to service_role;

-- ---------- Social accounts ----------
create table if not exists social_account_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references profiles on delete cascade,
  name text not null check (length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists social_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  platform text not null check (platform in ('tiktok', 'instagram')),
  external_id text not null,
  username text,
  display_name text,
  avatar_url text,
  -- connection = OAuth link; publishing rights are tracked separately below.
  status text not null default 'connected' check (status in ('connected', 'expired', 'revoked', 'error', 'disconnected')),
  scopes text[] not null default '{}',
  can_publish boolean not null default false,
  publish_restriction text,          -- e.g. 'TikTok app not audited: posts are private (SELF_ONLY)'
  account_type text,                 -- Instagram: BUSINESS / MEDIA_CREATOR
  group_id uuid references social_account_groups on delete set null,
  editorial jsonb not null default '{}'::jsonb,  -- language, tone, audience, caption style, preferred/banned hashtags, cta, length, notes
  last_verified_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  -- one Storyit owner per real social identity: another customer cannot attach the same account
  unique (platform, external_id)
);
create index if not exists social_accounts_user_idx on social_accounts (user_id);

-- Tokens: service role only (no RLS policy). Values are AES-GCM encrypted by the Edge Function.
create table if not exists social_account_tokens (
  account_id uuid primary key references social_accounts on delete cascade,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  refresh_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

-- OAuth CSRF state, single use, 10 minutes. Service role only.
create table if not exists oauth_states (
  state text primary key,
  user_id uuid not null references profiles on delete cascade,
  platform text not null,
  code_verifier text,
  created_at timestamptz not null default now()
);

-- ---------- Library ----------
create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references profiles on delete cascade,
  title text not null check (length(title) between 1 and 200),
  notes text,
  tags text[] not null default '{}',
  storage_path text not null unique,
  mime text not null check (mime in ('video/mp4', 'video/quicktime', 'video/webm')),
  size_bytes bigint not null check (size_bytes > 0),
  duration_seconds numeric,
  width integer,
  height integer,
  status text not null default 'uploading' check (status in ('uploading', 'available', 'archived', 'error')),
  story_id uuid references stories on delete set null,   -- link to an AI-produced episode (future studio)
  created_at timestamptz not null default now()
);
create index if not exists media_assets_user_idx on media_assets (user_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('library', 'library', false, 262144000, array['video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do nothing;
drop policy if exists "library own read" on storage.objects;
create policy "library own read" on storage.objects for select
  using (bucket_id = 'library' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "library own upload" on storage.objects;
create policy "library own upload" on storage.objects for insert
  with check (bucket_id = 'library' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "library own delete" on storage.objects;
create policy "library own delete" on storage.objects for delete
  using (bucket_id = 'library' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Campaigns ----------
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references profiles on delete cascade,
  name text not null check (length(name) between 1 and 100),
  mode text not null check (mode in ('simultaneous', 'rotation')),
  status text not null default 'active' check (status in ('draft', 'active', 'paused', 'completed')),
  timezone text not null default 'Europe/Paris',
  -- rotation: { strategy, videos_per_day, days[0-6], times["09:00"], tags[], order, per_account_daily_cap, repeat_policy, empty_policy, buckets }
  config jsonb not null default '{}'::jsonb,
  planned_until date,          -- rotation planner has created publications up to this local date
  alert text,                  -- e.g. 'Library empty: nothing scheduled for 2026-11-05'
  created_at timestamptz not null default now()
);

create table if not exists campaign_targets (
  campaign_id uuid not null references campaigns on delete cascade,
  account_id uuid not null references social_accounts on delete cascade,
  bucket text,                 -- custom split: accounts sharing a bucket receive the same videos
  primary key (campaign_id, account_id)
);

-- ---------- Publications (one row = one video on one account) ----------
create table if not exists scheduled_publications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references profiles on delete cascade,
  campaign_id uuid references campaigns on delete set null,
  media_id uuid not null references media_assets on delete restrict,
  account_id uuid not null references social_accounts on delete restrict,
  platform text not null check (platform in ('tiktok', 'instagram')),
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in
    ('draft', 'scheduled', 'queued', 'processing', 'submitted', 'published', 'failed', 'cancelled', 'needs_attention')),
  caption text,
  hook text,
  title text,
  hashtags text[] not null default '{}',
  metadata_source text not null default 'none' check (metadata_source in ('none', 'ai', 'manual')),
  caption_edited boolean not null default false,   -- a manual edit is never overwritten by regeneration
  metadata_approved boolean not null default false,
  metadata_warnings text[] not null default '{}',
  platform_options jsonb not null default '{}'::jsonb,   -- TikTok: privacy_level, interactions, commercial disclosure, consent (chosen by the user)
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  next_attempt_at timestamptz,
  locked_at timestamptz,
  locked_by text,
  send_started_at timestamptz,   -- set just before the upload request; a crash after this = uncertain, never auto-resend
  external_id text,          -- TikTok publish_id / Instagram container id
  external_post_id text,     -- final post id when the platform returns it
  external_url text,
  last_error text,
  last_checked_at timestamptz,
  published_at timestamptz,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Anti-duplicate: at most one non-failed, non-cancelled publication of a video per destination account.
create unique index if not exists publications_one_per_destination
  on scheduled_publications (media_id, account_id) where status not in ('failed', 'cancelled');
create unique index if not exists publications_idempotency on scheduled_publications (idempotency_key);
create index if not exists publications_due on scheduled_publications (status, coalesce(next_attempt_at, scheduled_at));
create index if not exists publications_user on scheduled_publications (user_id, scheduled_at);

create table if not exists publication_events (
  id bigint generated always as identity primary key,
  publication_id uuid not null references scheduled_publications on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  type text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists publication_events_pub on publication_events (publication_id, created_at);

-- ---------- RLS ----------
alter table social_account_groups enable row level security;
alter table social_accounts enable row level security;
alter table social_account_tokens enable row level security;
alter table oauth_states enable row level security;
alter table media_assets enable row level security;
alter table campaigns enable row level security;
alter table campaign_targets enable row level security;
alter table scheduled_publications enable row level security;
alter table publication_events enable row level security;

do $$
declare t text;
begin
  foreach t in array array['social_account_groups', 'media_assets', 'campaigns', 'scheduled_publications'] loop
    execute format('drop policy if exists "own select" on %I', t);
    execute format('create policy "own select" on %I for select using (user_id = auth.uid())', t);
    execute format('drop policy if exists "own insert" on %I', t);
    execute format('create policy "own insert" on %I for insert with check (user_id = auth.uid())', t);
    execute format('drop policy if exists "own update" on %I', t);
    execute format('create policy "own update" on %I for update using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
drop policy if exists "own delete" on social_account_groups;
create policy "own delete" on social_account_groups for delete using (user_id = auth.uid());
drop policy if exists "own delete" on campaigns;
create policy "own delete" on campaigns for delete using (user_id = auth.uid());

-- Social accounts: created/refreshed only by the `social` Edge Function; users may edit group + editorial settings.
drop policy if exists "own select" on social_accounts;
create policy "own select" on social_accounts for select using (user_id = auth.uid());
drop policy if exists "own update" on social_accounts;
create policy "own update" on social_accounts for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own targets" on campaign_targets;
create policy "own targets" on campaign_targets for all
  using (exists (select 1 from campaigns c where c.id = campaign_id and c.user_id = auth.uid()))
  with check (
    exists (select 1 from campaigns c where c.id = campaign_id and c.user_id = auth.uid())
    and exists (select 1 from social_accounts a where a.id = account_id and a.user_id = auth.uid()));

drop policy if exists "own events" on publication_events;
create policy "own events" on publication_events for select using (user_id = auth.uid());

-- ---------- Guards: what a browser may change ----------
create or replace function social_accounts_guard() returns trigger language plpgsql as $$
begin
  if auth.role() = 'authenticated' then
    if (to_jsonb(new) - 'group_id' - 'editorial') is distinct from (to_jsonb(old) - 'group_id' - 'editorial') then
      raise exception 'only the group and editorial settings of an account can be edited';
    end if;
    if new.group_id is not null and not exists (select 1 from social_account_groups g where g.id = new.group_id and g.user_id = new.user_id) then
      raise exception 'unknown group';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists social_accounts_guard on social_accounts;
create trigger social_accounts_guard before update on social_accounts for each row execute function social_accounts_guard();

create or replace function media_assets_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare lim integer; used integer;
begin
  if auth.role() = 'authenticated' then
    if new.storage_path not like new.user_id::text || '/%' then raise exception 'invalid storage path'; end if;
    if tg_op = 'INSERT' then
      lim := plan_limit(new.user_id, 'max_media_assets');
      select count(*) into used from media_assets where user_id = new.user_id and status <> 'archived';
      if lim is not null and used >= lim then raise exception 'plan_limit: video library is full for your plan (% videos)', lim; end if;
      if new.size_bytes > coalesce(plan_limit(new.user_id, 'max_upload_mb'), 250)::bigint * 1024 * 1024 then raise exception 'file too large'; end if;
    else
      if new.storage_path <> old.storage_path or new.size_bytes <> old.size_bytes or new.mime <> old.mime then
        raise exception 'file fields cannot be changed';
      end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists media_assets_guard on media_assets;
create trigger media_assets_guard before insert or update on media_assets for each row execute function media_assets_guard();

-- Browsers can create publications (draft/scheduled), edit metadata/time before processing, cancel, or
-- request a safe retry of a failed one. Everything else (processing, external ids, published) is server-only.
create or replace function publications_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare lim integer; used integer;
begin
  if auth.role() <> 'authenticated' then
    new.updated_at := now();
    return new;
  end if;
  if not exists (select 1 from media_assets m where m.id = new.media_id and m.user_id = new.user_id)
     or not exists (select 1 from social_accounts a where a.id = new.account_id and a.user_id = new.user_id and a.platform = new.platform)
     or (new.campaign_id is not null and not exists (select 1 from campaigns c where c.id = new.campaign_id and c.user_id = new.user_id)) then
    raise exception 'video, account or campaign not found';
  end if;
  -- TikTok Content Sharing Guidelines: the user must pick the visibility and accept the declaration before posting.
  if new.metadata_approved and new.platform = 'tiktok'
     and (coalesce(new.platform_options ->> 'privacy_level', '') = '' or coalesce(new.platform_options ->> 'consented_at', '') = '') then
    raise exception 'tiktok_settings_required: choose who can view the video and accept the declaration before approving';
  end if;
  if new.metadata_approved and coalesce(btrim(new.caption), '') = '' and cardinality(new.hashtags) = 0 then
    raise exception 'caption_required: write or generate a caption before approving';
  end if;
  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'scheduled') then raise exception 'new publications must be draft or scheduled'; end if;
    if new.external_id is not null or new.external_post_id is not null or new.published_at is not null or new.attempts <> 0 then
      raise exception 'server-managed fields cannot be set';
    end if;
    lim := plan_limit(new.user_id, 'max_pending_publications');
    select count(*) into used from scheduled_publications where user_id = new.user_id and status in ('draft', 'scheduled', 'queued');
    if lim is not null and used >= lim then raise exception 'plan_limit: too many pending publications for your plan (%)', lim; end if;
  else
    if (to_jsonb(new) - array['status', 'scheduled_at', 'caption', 'hook', 'title', 'hashtags', 'metadata_source', 'caption_edited',
                               'metadata_approved', 'metadata_warnings', 'platform_options', 'updated_at', 'next_attempt_at', 'last_error', 'max_attempts'])
       is distinct from (to_jsonb(old) - array['status', 'scheduled_at', 'caption', 'hook', 'title', 'hashtags', 'metadata_source', 'caption_edited',
                               'metadata_approved', 'metadata_warnings', 'platform_options', 'updated_at', 'next_attempt_at', 'last_error', 'max_attempts']) then
      raise exception 'server-managed fields cannot be changed';
    end if;
    if old.status not in ('draft', 'scheduled', 'failed', 'needs_attention') then
      raise exception 'publication already started (%), it can no longer be changed', old.status;
    end if;
    if new.status is distinct from old.status and not (
         (old.status in ('draft', 'scheduled') and new.status in ('draft', 'scheduled', 'cancelled'))
      or (old.status = 'failed' and new.status in ('scheduled', 'cancelled'))
      or (old.status = 'needs_attention' and new.status = 'cancelled')) then
      raise exception 'invalid status change % -> %', old.status, new.status;
    end if;
    if old.status = 'needs_attention' and new.status <> 'cancelled' then
      raise exception 'this publication may already be live: check the account before doing anything else';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists publications_guard on scheduled_publications;
create trigger publications_guard before insert or update on scheduled_publications for each row execute function publications_guard();

create or replace function log_publication_event() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into publication_events (publication_id, user_id, type, detail) values (new.id, new.user_id, 'created', jsonb_build_object('status', new.status, 'scheduled_at', new.scheduled_at));
  elsif new.status is distinct from old.status then
    insert into publication_events (publication_id, user_id, type, detail)
      values (new.id, new.user_id, 'status', jsonb_build_object('from', old.status, 'to', new.status, 'error', new.last_error, 'attempts', new.attempts, 'by', coalesce(auth.role(), 'server')));
  end if;
  return new;
end $$;
drop trigger if exists publications_log on scheduled_publications;
create trigger publications_log after insert or update on scheduled_publications for each row execute function log_publication_event();

-- ---------- Worker claim (service role): atomic, safe with concurrent workers ----------
create or replace function claim_publications(p_worker text, p_limit integer default 10)
returns setof scheduled_publications language plpgsql security definer set search_path = public as $$
begin
  return query
  update scheduled_publications p set status = case when p.status = 'submitted' then 'submitted' else 'processing' end,
         locked_at = now(), locked_by = p_worker
  where p.id in (
    select id from scheduled_publications
    where (status in ('scheduled', 'queued') and metadata_approved and coalesce(next_attempt_at, scheduled_at) <= now()
           and (campaign_id is null or exists (select 1 from campaigns c where c.id = campaign_id and c.status = 'active')))
       or (status = 'submitted' and coalesce(next_attempt_at, now()) <= now() and (locked_at is null or locked_at < now() - interval '2 minutes'))
       or (status = 'processing' and locked_at < now() - interval '10 minutes')  -- worker died mid-step
    order by coalesce(next_attempt_at, scheduled_at)
    limit p_limit
    for update skip locked)
  returning p.*;
end $$;
revoke execute on function claim_publications(text, integer) from public, anon, authenticated;
grant execute on function claim_publications(text, integer) to service_role;

do $$ begin
  alter publication supabase_realtime add table social_accounts, media_assets, campaigns, scheduled_publications;
exception when duplicate_object then null; end $$;
