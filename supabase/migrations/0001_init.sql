-- Storyit.io — initial schema. Mirrors src/types/database.ts.

create type story_status as enum ('draft','concept_selected','scenes_ready','generating','in_review','approved','published');
create type scene_status as enum ('pending','queued','generating','generated','failed');
create type credit_tx_type as enum ('purchase','subscription_grant','consumption','refund','bonus');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  plan text not null default 'free' check (plan in ('free','creator','studio')),
  credit_balance integer not null default 30 check (credit_balance >= 0),
  created_at timestamptz not null default now()
);

create table stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  series_id uuid,
  title text not null,
  idea text not null,
  logline text,
  genre text not null default 'Fruit Drama',
  aspect_ratio text not null default '9:16' check (aspect_ratio in ('9:16','1:1','16:9')),
  status story_status not null default 'draft',
  episode_number integer not null default 1,
  approved_at timestamptz,
  approved_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table characters (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references stories on delete cascade,
  name text not null,
  species text not null,
  personality text not null,
  visual_description text not null,
  voice_style text,
  reference_image_url text,
  created_at timestamptz not null default now()
);

create table scenes (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references stories on delete cascade,
  position smallint not null check (position between 1 and 30),
  title text not null,
  narration text not null,
  dialogue text,
  image_prompt text not null,
  video_prompt text not null,
  duration_seconds smallint not null default 4,
  status scene_status not null default 'pending',
  image_url text,
  video_url text,
  character_ids uuid[] not null default '{}',
  error_message text,
  updated_at timestamptz not null default now(),
  unique (story_id, position)
);

create table credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  type credit_tx_type not null,
  amount integer not null,
  balance_after integer not null,
  story_id uuid references stories on delete set null,
  description text not null,
  created_at timestamptz not null default now()
);

create index on stories (user_id, created_at desc);
create index on scenes (story_id, position);
create index on credit_transactions (user_id, created_at desc);

-- Editing scene content revokes any approval on the parent story.
create function revoke_approval_on_scene_edit() returns trigger language plpgsql as $$
begin
  if (new.narration, new.dialogue, new.image_prompt, new.video_prompt)
     is distinct from (old.narration, old.dialogue, old.image_prompt, old.video_prompt) then
    update stories set approved_at = null, approved_hash = null,
      status = case when status = 'approved' then 'in_review'::story_status else status end,
      updated_at = now()
    where id = new.story_id and approved_at is not null;
  end if;
  new.updated_at = now();
  return new;
end $$;
create trigger scenes_revoke_approval before update on scenes for each row execute function revoke_approval_on_scene_edit();

-- Atomic credit debit; the only way clients can spend credits.
create function consume_credits(p_amount integer, p_story_id uuid, p_description text) returns integer
language plpgsql security definer set search_path = public as $$
declare new_balance integer;
begin
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;
  update profiles set credit_balance = credit_balance - p_amount
    where id = auth.uid() and credit_balance >= p_amount
    returning credit_balance into new_balance;
  if new_balance is null then raise exception 'insufficient_credits'; end if;
  insert into credit_transactions (user_id, type, amount, balance_after, story_id, description)
    values (auth.uid(), 'consumption', -p_amount, new_balance, p_story_id, p_description);
  return new_balance;
end $$;

-- Row Level Security
alter table profiles enable row level security;
alter table stories enable row level security;
alter table characters enable row level security;
alter table scenes enable row level security;
alter table credit_transactions enable row level security;

create policy "own profile read" on profiles for select using (id = auth.uid());
-- Only display_name is client-editable; balance/plan changes go through security-definer functions.
create policy "own profile update" on profiles for update using (id = auth.uid());
revoke update on profiles from authenticated;
grant update (display_name) on profiles to authenticated;

create policy "own stories" on stories for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own characters" on characters for all
  using (exists (select 1 from stories s where s.id = story_id and s.user_id = auth.uid()))
  with check (exists (select 1 from stories s where s.id = story_id and s.user_id = auth.uid()));
create policy "own scenes" on scenes for all
  using (exists (select 1 from stories s where s.id = story_id and s.user_id = auth.uid()))
  with check (exists (select 1 from stories s where s.id = story_id and s.user_id = auth.uid()));
create policy "own transactions read" on credit_transactions for select using (user_id = auth.uid());
