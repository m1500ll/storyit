-- Hard daily ceiling on what Storyit spends on Google AI (estimated, in USD), checked BEFORE every paid call.
-- If a bug, a retry loop or abuse starts burning credits, generation stops for the day instead of draining the account.
create table if not exists ai_spend (
  day date not null,
  kind text not null,
  calls integer not null default 0,
  usd numeric(10, 4) not null default 0,
  primary key (day, kind)
);
alter table ai_spend enable row level security; -- no policy: service role only

create or replace function reserve_ai_spend(p_kind text, p_usd numeric, p_cap numeric) returns boolean
language plpgsql security definer set search_path = public as $$
declare spent numeric;
begin
  perform pg_advisory_xact_lock(hashtext('ai_spend'));
  select coalesce(sum(usd), 0) into spent from ai_spend where day = current_date;
  if spent + p_usd > p_cap then return false; end if;
  insert into ai_spend (day, kind, calls, usd) values (current_date, p_kind, 1, p_usd)
    on conflict (day, kind) do update set calls = ai_spend.calls + 1, usd = ai_spend.usd + excluded.usd;
  return true;
end $$;
revoke all on function reserve_ai_spend(text, numeric, numeric) from public, anon, authenticated;
