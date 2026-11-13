-- Automatic top-up: a subscriber can opt in to have a credit pack bought with their saved card when their balance
-- drops below a threshold. The `auto-topup` Edge Function charges the card (off-session) and grants the credits.
alter table public.profiles add column if not exists auto_topup_enabled boolean not null default false;
alter table public.profiles add column if not exists auto_topup_threshold integer not null default 3000;
alter table public.profiles add column if not exists auto_topup_pack text not null default 'pack_100';
alter table public.profiles add column if not exists auto_topup_failed_at timestamptz;
alter table public.profiles add column if not exists auto_topup_error text;

create table if not exists public.auto_topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  pack text not null,
  credits integer,
  amount_cents integer,
  currency text,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'skipped')),
  payment_intent text,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists auto_topups_user_created on public.auto_topups (user_id, created_at desc);
alter table public.auto_topups enable row level security;
drop policy if exists "auto_topups_own" on public.auto_topups;
create policy "auto_topups_own" on public.auto_topups for select using (auth.uid() = user_id);

-- after each spend: below the customer's threshold, ask the Edge Function for one top-up
-- (never more than one every 10 minutes; the function also caps them at 3 a day)
create or replace function public.auto_topup_on_low_credits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pr profiles;
  tid uuid;
begin
  if new.type <> 'consumption' then return new; end if;
  select * into pr from profiles where id = new.user_id;
  if not pr.auto_topup_enabled or new.balance_after >= pr.auto_topup_threshold then return new; end if;
  if exists (select 1 from auto_topups where user_id = new.user_id and created_at > now() - interval '10 minutes') then return new; end if;
  insert into auto_topups (user_id, pack) values (new.user_id, pr.auto_topup_pack) returning id into tid;
  perform net.http_post(
    url := 'https://hubkgvfiiszthzqyfguf.supabase.co/functions/v1/auto-topup',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publisher_cron_token'),
                                  'Content-Type', 'application/json'),
    body := jsonb_build_object('topup_id', tid),
    timeout_milliseconds := 30000);
  return new;
end $$;

drop trigger if exists auto_topup_on_low_credits on public.credit_transactions;
create trigger auto_topup_on_low_credits after insert on public.credit_transactions
  for each row execute function public.auto_topup_on_low_credits();
