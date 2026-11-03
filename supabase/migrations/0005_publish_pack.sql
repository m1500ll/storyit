-- Phase 5: thumbnail + social media SEO pack. Run after 0004.
-- One pack per story (regenerating a section updates it in place); thumbnails keep every variant.

create table if not exists publish_packs (
  story_id uuid primary key references stories on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  -- { titles: [{angle, text}] x5, caption, hashtags: {tiktok, instagram, youtube},
  --   platforms: {tiktok: {...}, instagram: {...}, youtube: {...}}, thumbnail: {thumbnail_type, aspect_ratio, ...} }
  content jsonb not null default '{}'::jsonb,
  status text not null default 'empty' check (status in ('empty', 'generating', 'ready', 'error')),
  error_message text,
  selected_title text,
  edited_caption text,
  selected_thumbnail_id uuid,
  approved_hash text,          -- scenes fingerprint the pack was generated for (stale if the story changes)
  updated_at timestamptz not null default now()
);

create table if not exists thumbnails (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references stories on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  aspect_ratio text not null check (aspect_ratio in ('9:16', '16:9')),
  prompt jsonb not null,
  image_path text,
  status text not null default 'generating' check (status in ('generating', 'ready', 'error')),
  error_message text,
  created_at timestamptz not null default now()
);
create index if not exists thumbnails_story_idx on thumbnails (story_id, created_at desc);

alter table publish_packs enable row level security;
alter table thumbnails enable row level security;

-- Owners can read their own rows; writes that cost credits go through Edge Functions.
drop policy if exists "own packs" on publish_packs;
create policy "own packs" on publish_packs for select using (user_id = auth.uid());
drop policy if exists "own packs choices" on publish_packs;
-- Users may only change their choices (title, caption, thumbnail) — the guard trigger below enforces that.
create policy "own packs choices" on publish_packs for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own thumbnails" on thumbnails;
create policy "own thumbnails" on thumbnails for select using (user_id = auth.uid());

-- Browsers may only edit the user choices; generated content is written by the service role.
create or replace function publish_packs_guard() returns trigger
language plpgsql as $$
begin
  if auth.role() = 'authenticated' then
    if new.content is distinct from old.content or new.status is distinct from old.status
       or new.approved_hash is distinct from old.approved_hash or new.story_id <> old.story_id or new.user_id <> old.user_id then
      raise exception 'only title, caption and thumbnail choices can be edited';
    end if;
    if new.selected_thumbnail_id is not null and not exists (
      select 1 from thumbnails t where t.id = new.selected_thumbnail_id and t.story_id = new.story_id and t.status = 'ready'
    ) then
      raise exception 'unknown thumbnail';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists publish_packs_guard on publish_packs;
create trigger publish_packs_guard before update on publish_packs for each row execute function publish_packs_guard();

do $$ begin
  alter publication supabase_realtime add table publish_packs, thumbnails;
exception when duplicate_object then null; end $$;
