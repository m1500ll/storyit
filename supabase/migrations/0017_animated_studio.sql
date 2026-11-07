-- Animated Studio: one row per animated short. The customer chats with Claude (brief), then "generate" charges the
-- credits once and queues the job; the render worker (render-engine/worker, GPU on demand) writes the VideoSpec with
-- Claude, records the ElevenLabs narration, mixes the sound, renders the 3D video and uploads it to `renders`.
-- Clients can only read their own rows; every write goes through the `animated-studio` Edge Function or the worker
-- (service role).
create table if not exists animated_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  language text not null default 'fr',
  voice_id text,
  status text not null default 'brief'
    check (status in ('brief', 'queued', 'writing', 'voicing', 'rendering', 'done', 'failed')),
  -- Claude Messages API history of the brief chat (assistant turns kept whole: thinking + tool blocks)
  messages jsonb not null default '[]'::jsonb,
  -- plain-text transcript shown in the UI (role, text)
  transcript jsonb not null default '[]'::jsonb,
  spec jsonb,
  words jsonb,
  progress integer not null default 0 check (progress between 0 and 100),
  video_path text,
  error text,
  credits_charged integer not null default 0,
  worker_id text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists animated_projects_user_idx on animated_projects (user_id, created_at desc);
create index if not exists animated_projects_queue_idx on animated_projects (status, created_at) where status = 'queued';

alter table animated_projects enable row level security;
create policy "own animated projects read" on animated_projects for select using (user_id = auth.uid());
create policy "own animated projects delete" on animated_projects for delete using (user_id = auth.uid());

create or replace function touch_animated_projects() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists animated_projects_touch on animated_projects;
create trigger animated_projects_touch before update on animated_projects for each row execute function touch_animated_projects();

-- the worker claims the oldest queued job atomically (no two workers render the same short)
create or replace function claim_animated_job(p_worker text) returns animated_projects
language plpgsql security definer set search_path = public as $$
declare j animated_projects;
begin
  select * into j from animated_projects where status = 'queued' order by created_at limit 1 for update skip locked;
  if not found then return null; end if;
  update animated_projects set status = 'writing', worker_id = p_worker, started_at = now(), progress = 2, error = null
    where id = j.id returning * into j;
  return j;
end $$;
revoke all on function claim_animated_job(text) from public, anon, authenticated;

-- live progress in the UI
alter publication supabase_realtime add table animated_projects;
