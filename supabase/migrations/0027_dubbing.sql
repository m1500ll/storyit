-- Video translation (dubbing): a customer uploads a vertical video (library bucket, <uid>/dubs/...), picks a target
-- language and a voice; the render worker separates the voice from the music (Demucs), transcribes, translates
-- (fitting each sentence in its original time slot), records the new voice (ElevenLabs), keeps the original music,
-- optionally replaces burned-in captions, and adds the result to the customer's library.
-- Clients only read their own rows; every write goes through the `dubbing` Edge Function or the worker (service role).
create table if not exists dub_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  title text,
  source_path text not null,
  target_language text not null check (target_language in ('fr', 'en', 'es', 'de', 'it', 'pt')),
  voice_id text,
  replace_captions boolean not null default true,
  seconds numeric not null,
  status text not null default 'queued' check (status in ('queued', 'working', 'done', 'failed')),
  step text,
  progress integer not null default 0,
  error text,
  error_detail text,
  video_path text,
  credits_charged integer not null default 0,
  worker_id text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists dub_jobs_user_idx on dub_jobs (user_id, created_at desc);
alter table dub_jobs enable row level security;
drop policy if exists "own dub jobs" on dub_jobs;
create policy "own dub jobs" on dub_jobs for select using (user_id = auth.uid());

-- worker: the oldest queued translation (a job left behind by a dead worker goes back to the queue after 60 minutes)
create or replace function claim_dub_job(p_worker text) returns dub_jobs
language plpgsql security definer set search_path = public as $$
declare j dub_jobs;
begin
  update dub_jobs set status = 'queued', worker_id = null
    where status = 'working' and started_at < now() - interval '60 minutes';
  select * into j from dub_jobs where status = 'queued' order by created_at limit 1 for update skip locked;
  if not found then return null; end if;
  update dub_jobs set status = 'working', step = 'start', worker_id = p_worker, started_at = now(), progress = 2, error = null
    where id = j.id returning * into j;
  return j;
end $$;
revoke all on function claim_dub_job(text) from public, anon, authenticated;
grant execute on function claim_dub_job(text) to service_role;

-- live progress in the browser
alter publication supabase_realtime add table dub_jobs;
