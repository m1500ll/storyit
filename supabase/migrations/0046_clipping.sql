-- AI clipping (ported from Clipit): a long video stays in the customer's browser; only its audio track is sent to the
-- AI (clips-analyze Edge Function), which finds the best moments. Credits are charged by the function, after success.

do $$ begin
  create type clip_project_status as enum ('uploading','analyzing','ready','failed');
exception when duplicate_object then null; end $$;

create table if not exists clip_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  title text not null,
  source_name text not null,
  source_size bigint not null default 0,
  duration_seconds numeric(8,2) not null check (duration_seconds > 0),
  clip_length text not null default 'medium' check (clip_length in ('short','medium','long')),
  status clip_project_status not null default 'uploading',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists clips (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references clip_projects on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  position smallint not null,
  start_s numeric(8,2) not null,
  end_s numeric(8,2) not null check (end_s > start_s),
  title text not null,
  hook text not null default '',
  reason text not null default '',
  score smallint not null default 50 check (score between 0 and 100),
  captions jsonb not null default '[]',
  caption_style text not null default 'bold' check (caption_style in ('bold','pop','clean')),
  layout text not null default 'fill' check (layout in ('fill','fit')),
  show_title boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clip_projects_user_idx on clip_projects (user_id, created_at desc);
create index if not exists clips_project_idx on clips (project_id, position);

drop trigger if exists clip_projects_touch on clip_projects;
create trigger clip_projects_touch before update on clip_projects for each row execute function touch_updated_at();
drop trigger if exists clips_touch on clips;
create trigger clips_touch before update on clips for each row execute function touch_updated_at();

-- ---------- Credits ----------
alter table credit_transactions add column if not exists clip_project_id uuid references clip_projects on delete set null;

-- Debit after a successful analysis; called only by the clips-analyze function (service role).
create or replace function charge_credits(p_user_id uuid, p_amount integer, p_clip_project_id uuid, p_description text) returns integer
language plpgsql security definer set search_path = public as $$
declare new_balance integer;
begin
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;
  update profiles set credit_balance = credit_balance - p_amount
    where id = p_user_id and credit_balance >= p_amount
    returning credit_balance into new_balance;
  if new_balance is null then raise exception 'insufficient_credits'; end if;
  insert into credit_transactions (user_id, type, amount, balance_after, clip_project_id, description)
    values (p_user_id, 'consumption', -p_amount, new_balance, p_clip_project_id, p_description);
  return new_balance;
end $$;
revoke execute on function charge_credits(uuid, integer, uuid, text) from public, anon, authenticated;
grant execute on function charge_credits(uuid, integer, uuid, text) to service_role;

-- ---------- Row Level Security ----------
alter table clip_projects enable row level security;
alter table clips enable row level security;

drop policy if exists "own clip projects read" on clip_projects;
create policy "own clip projects read" on clip_projects for select using (user_id = auth.uid());
drop policy if exists "own clip projects insert" on clip_projects;
create policy "own clip projects insert" on clip_projects for insert with check (user_id = auth.uid() and status = 'uploading');
drop policy if exists "own clip projects update" on clip_projects;
create policy "own clip projects update" on clip_projects for update using (user_id = auth.uid());
drop policy if exists "own clip projects delete" on clip_projects;
create policy "own clip projects delete" on clip_projects for delete using (user_id = auth.uid());
revoke update on clip_projects from authenticated;
grant update (title) on clip_projects to authenticated;

-- clips are inserted by the server only (after the AI step); users read, edit and delete their own
drop policy if exists "own clips read" on clips;
create policy "own clips read" on clips for select using (user_id = auth.uid());
drop policy if exists "own clips update" on clips;
create policy "own clips update" on clips for update using (user_id = auth.uid());
drop policy if exists "own clips delete" on clips;
create policy "own clips delete" on clips for delete using (user_id = auth.uid());
revoke update on clips from authenticated;
grant update (start_s, end_s, title, captions, caption_style, layout, show_title) on clips to authenticated;

-- ---------- Storage: the temporary audio track (deleted by the function after the analysis) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('clip-audio', 'clip-audio', false, 15728640, array['audio/mpeg'])
on conflict (id) do nothing;

drop policy if exists "clip audio upload" on storage.objects;
create policy "clip audio upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'clip-audio' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "clip audio replace" on storage.objects;
create policy "clip audio replace" on storage.objects for update to authenticated
  using (bucket_id = 'clip-audio' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "clip audio read" on storage.objects;
create policy "clip audio read" on storage.objects for select to authenticated
  using (bucket_id = 'clip-audio' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "clip audio delete" on storage.objects;
create policy "clip audio delete" on storage.objects for delete to authenticated
  using (bucket_id = 'clip-audio' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Realtime ----------
do $$ begin
  alter publication supabase_realtime add table clip_projects, clips;
exception when duplicate_object then null; end $$;
