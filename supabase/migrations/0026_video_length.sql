-- Animated Studio: the customer picks the video length (30 s, 60 s or 2 min; priced 35 / 60 / 120 credits).
alter table animated_projects add column if not exists length_s integer not null default 60 check (length_s in (30, 60, 120));

-- a 2-minute video can take over an hour to render: only give a job back to the queue after 150 minutes
create or replace function claim_animated_job(p_worker text) returns animated_projects
language plpgsql security definer set search_path = public as $$
declare j animated_projects;
begin
  update animated_projects set status = 'queued', worker_id = null
    where status in ('writing', 'voicing', 'rendering') and started_at < now() - interval '150 minutes';
  select * into j from animated_projects where status = 'queued' order by created_at limit 1 for update skip locked;
  if not found then return null; end if;
  update animated_projects set status = 'writing', worker_id = p_worker, started_at = now(), progress = 2, error = null
    where id = j.id returning * into j;
  return j;
end $$;
revoke all on function claim_animated_job(text) from public, anon, authenticated;
grant execute on function claim_animated_job(text) to service_role;
