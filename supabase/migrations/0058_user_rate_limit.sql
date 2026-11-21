-- Per-user rate limit for AI calls that cost Storyit money but no credits (story phases, brief chat, captions):
-- one person can't burn the whole day's AI budget (the daily ceiling would then block every other customer).
create table if not exists rate_hits (key text not null, user_id uuid not null, window_start timestamptz not null, hits integer not null default 0,
  primary key (key, user_id, window_start));
alter table rate_hits enable row level security;
revoke all on rate_hits from anon, authenticated;

create or replace function hit_rate_limit(p_user uuid, p_key text, p_limit integer, p_window_seconds integer) returns boolean
language plpgsql security definer set search_path = public as $$
declare w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds); n integer;
begin
  insert into rate_hits (key, user_id, window_start, hits) values (p_key, p_user, w, 1)
    on conflict (key, user_id, window_start) do update set hits = rate_hits.hits + 1 returning hits into n;
  delete from rate_hits where window_start < now() - interval '2 days' and random() < 0.01; -- light cleanup
  return n <= p_limit;
end $$;
revoke execute on function hit_rate_limit(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function hit_rate_limit(uuid, text, integer, integer) to service_role;

-- defense in depth: anonymous visitors never write profiles (RLS already blocks it)
revoke insert, update on profiles from anon;
