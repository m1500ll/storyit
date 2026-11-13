-- "Low credits" e-mail: a subscriber whose balance drops below 5 000 credits gets one e-mail (mailing function),
-- once per dip: it is re-armed when the balance goes back to 5 000 or more. Not during the $1 trial, and not when
-- the automatic top-up is on (the credits come by themselves).
alter table public.profiles add column if not exists low_credits_mailed_at timestamptz;

create or replace function public.low_credits_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pr profiles;
begin
  select * into pr from profiles where id = new.user_id;
  if new.amount > 0 then
    if new.balance_after >= 5000 and pr.low_credits_mailed_at is not null then
      update profiles set low_credits_mailed_at = null where id = new.user_id;
    end if;
    return new;
  end if;
  if new.type <> 'consumption' or new.balance_after >= 5000 then return new; end if;
  if pr.plan = 'free' or pr.auto_topup_enabled or pr.trial_ends_at is not null or pr.low_credits_mailed_at is not null then return new; end if;
  update profiles set low_credits_mailed_at = now() where id = new.user_id;
  perform net.http_post(
    url := 'https://hubkgvfiiszthzqyfguf.supabase.co/functions/v1/mailing',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publisher_cron_token'),
                                  'Content-Type', 'application/json'),
    body := jsonb_build_object('low_credits', new.user_id),
    timeout_milliseconds := 30000);
  return new;
end $$;

drop trigger if exists low_credits_email on public.credit_transactions;
create trigger low_credits_email after insert on public.credit_transactions
  for each row execute function public.low_credits_email();
