-- Run after 0001_init.sql.
-- 1) Every new auth user gets a profile with 30 free Story Credits (+ a ledger entry).
-- 2) Tables are published to Supabase Realtime so the UI updates live.

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name, plan, credit_balance)
  values (new.id, split_part(new.email, '@', 1), 'free', 30)
  on conflict (id) do nothing;

  insert into credit_transactions (user_id, type, amount, balance_after, description)
  values (new.id, 'bonus', 30, 30, 'Welcome bonus — free Story Credits');
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Backfill users who signed up before this migration.
insert into profiles (id, display_name, plan, credit_balance)
select id, split_part(email, '@', 1), 'free', 30 from auth.users
on conflict (id) do nothing;

-- Keep updated_at fresh on stories.
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists stories_touch on stories;
create trigger stories_touch before update on stories for each row execute function touch_updated_at();

-- Realtime
alter publication supabase_realtime add table stories, scenes, profiles, credit_transactions;
