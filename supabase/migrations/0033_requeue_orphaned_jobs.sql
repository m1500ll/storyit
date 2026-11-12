-- A render machine that dies mid-job (preemption, crash) left its job "in progress" forever: the claim functions
-- only re-queue stale jobs when a worker runs, and the Modal poller only starts a worker for *queued* jobs.
-- Every 10 minutes, put stale jobs back in the queue (same thresholds as the claim functions) so the poller restarts them.
create or replace function public.requeue_orphaned_jobs()
returns void
language sql
security definer
set search_path = public
as $$
  update animated_projects set status = 'queued', worker_id = null
    where status in ('writing', 'voicing', 'rendering') and started_at < now() - interval '150 minutes';
  update dub_jobs set status = 'queued', worker_id = null
    where status = 'working' and started_at < now() - interval '60 minutes';
  -- prompt videos: claim_prompt_video counts attempts, and a second attempt refunds the customer instead of retrying
  update prompt_videos set status = 'queued', worker_id = null
    where status = 'working' and started_at < now() - interval '60 minutes';
$$;

revoke all on function public.requeue_orphaned_jobs() from public, anon, authenticated;

select cron.unschedule('storyit-requeue-orphans') where exists (select 1 from cron.job where jobname = 'storyit-requeue-orphans');
select cron.schedule('storyit-requeue-orphans', '*/10 * * * *', 'select public.requeue_orphaned_jobs()');
