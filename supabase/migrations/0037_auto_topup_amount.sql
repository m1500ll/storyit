-- Automatic top-up: the customer picks any amount of credits (5 000 to 200 000), not just the two packs.
alter table public.profiles add column if not exists auto_topup_credits integer not null default 10000;
update public.profiles set auto_topup_credits = 50000 where auto_topup_pack = 'pack_500';

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
  insert into auto_topups (user_id, pack, credits) values (new.user_id, 'custom', pr.auto_topup_credits) returning id into tid;
  perform net.http_post(
    url := 'https://hubkgvfiiszthzqyfguf.supabase.co/functions/v1/auto-topup',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publisher_cron_token'),
                                  'Content-Type', 'application/json'),
    body := jsonb_build_object('topup_id', tid),
    timeout_milliseconds := 30000);
  return new;
end $$;
