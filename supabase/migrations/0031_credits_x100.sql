-- Credits ×100 (display choice: bigger numbers, same value). Every balance, every past transaction and every amount
-- charged to a job in progress (refunded on failure) is multiplied by 100, the welcome bonus goes from 30 to 3000.
-- The prices in the code (Edge Functions, src/services/credits.ts) were multiplied by 100 in the same release.
-- Run once. A guard row in app_flags makes a second run a no-op.
create table if not exists app_flags (key text primary key, done_at timestamptz not null default now());
alter table app_flags enable row level security;

do $$
begin
  if exists (select 1 from app_flags where key = 'credits_x100') then
    raise notice 'credits already multiplied by 100';
    return;
  end if;
  update profiles set credit_balance = credit_balance * 100;
  update credit_transactions set amount = amount * 100, balance_after = balance_after * 100;
  update animated_projects set credits_charged = credits_charged * 100 where credits_charged > 0;
  update dub_jobs set credits_charged = credits_charged * 100 where credits_charged > 0;
  update prompt_videos set credits_charged = credits_charged * 100 where credits_charged > 0;
  insert into app_flags (key) values ('credits_x100');
end $$;

alter table profiles alter column credit_balance set default 3000;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
begin
  insert into profiles (id, display_name, plan, credit_balance)
  values (new.id, split_part(new.email, '@', 1), 'free', 3000)
  on conflict (id) do nothing;

  insert into credit_transactions (user_id, type, amount, balance_after, description)
  values (new.id, 'bonus', 3000, 3000, 'Welcome bonus — free Story Credits');
  return new;
end $function$;
