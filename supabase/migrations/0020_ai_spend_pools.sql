-- AI spending ceilings per provider: Claude (kinds claude_*) and Google (every other kind) each have their own daily
-- cap, so a busy Animated Studio never blocks the Prompt Studio and the reverse. A reservation whose provider call
-- failed is released (it spent nothing).
create or replace function reserve_ai_spend_pool(p_kind text, p_usd numeric, p_cap numeric) returns boolean
language plpgsql security definer set search_path = public as $$
declare spent numeric; claude boolean := p_kind like 'claude\_%';
begin
  perform pg_advisory_xact_lock(hashtext('ai_spend'));
  select coalesce(sum(usd), 0) into spent from ai_spend
    where day = current_date and ((kind like 'claude\_%') = claude);
  if spent + p_usd > p_cap then return false; end if;
  insert into ai_spend (day, kind, calls, usd) values (current_date, p_kind, 1, p_usd)
    on conflict (day, kind) do update set calls = ai_spend.calls + 1, usd = ai_spend.usd + excluded.usd;
  return true;
end $$;
revoke all on function reserve_ai_spend_pool(text, numeric, numeric) from public, anon, authenticated;
grant execute on function reserve_ai_spend_pool(text, numeric, numeric) to service_role;

create or replace function release_ai_spend(p_kind text, p_usd numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  update ai_spend set calls = greatest(0, calls - 1), usd = greatest(0, usd - p_usd)
    where day = current_date and kind = p_kind;
end $$;
revoke all on function release_ai_spend(text, numeric) from public, anon, authenticated;
grant execute on function release_ai_spend(text, numeric) to service_role;
