-- Prompt Studio → finished video: the customer picks a quality, the `prompt-videos` Edge Function charges the credits,
-- freezes every prompt of the project in `plan` (character sheet, one image and one Grok prompt per clip, cover) and
-- queues the job. The render worker (render-engine/promptvideo/run.py) draws the images (OpenAI), animates each clip
-- (xAI Grok Imagine), assembles the clips into one vertical video and adds it to the customer's library.
-- Any failure refunds the credits. Clients only read their own rows; writes go through the Edge Function or the worker.
create table if not exists prompt_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  project_id uuid references prompt_projects on delete set null,
  title text,
  quality text not null check (quality in ('eco', 'standard', 'premium')),
  seconds numeric not null,
  plan jsonb not null,
  status text not null default 'queued' check (status in ('queued', 'working', 'done', 'failed')),
  step text,
  progress integer not null default 0,
  error text,
  error_detail text,
  video_path text,
  cover_path text,
  asset_id uuid,
  credits_charged integer not null default 0,
  attempts integer not null default 0,
  worker_id text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists prompt_videos_user_idx on prompt_videos (user_id, created_at desc);
create index if not exists prompt_videos_project_idx on prompt_videos (project_id, created_at desc);
alter table prompt_videos enable row level security;
drop policy if exists "own prompt videos" on prompt_videos;
create policy "own prompt videos" on prompt_videos for select using (user_id = auth.uid());

-- worker: the oldest queued video. A job left behind by a dead worker goes back to the queue once (after 60 minutes);
-- the worker fails and refunds a job that comes back a second time, so paid generations are never repeated endlessly.
create or replace function claim_prompt_video(p_worker text) returns prompt_videos
language plpgsql security definer set search_path = public as $$
declare j prompt_videos;
begin
  update prompt_videos set status = 'queued', worker_id = null
    where status = 'working' and started_at < now() - interval '60 minutes';
  select * into j from prompt_videos where status = 'queued' order by created_at limit 1 for update skip locked;
  if not found then return null; end if;
  update prompt_videos set status = 'working', step = 'start', worker_id = p_worker, started_at = now(), progress = 2,
    error = null, attempts = attempts + 1
    where id = j.id returning * into j;
  return j;
end $$;
revoke all on function claim_prompt_video(text) from public, anon, authenticated;
grant execute on function claim_prompt_video(text) to service_role;

-- live progress in the browser
alter publication supabase_realtime add table prompt_videos;
