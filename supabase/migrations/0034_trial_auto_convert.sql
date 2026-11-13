-- $1 trial (3 days, 5 000 credits) that turns into the chosen plan early once the trial credits are used up.
-- stripe-webhook sets trial_ends_at when the trial starts and clears it on the first real payment.
alter table public.profiles add column if not exists trial_ends_at timestamptz;

create or replace function public.trial_convert_on_low_credits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ends timestamptz;
begin
  if new.type <> 'consumption' or new.balance_after > 1500 then return new; end if;
  select trial_ends_at into ends from profiles where id = new.user_id;
  if ends is null or ends < now() then return new; end if;
  -- once only: the next real invoice clears it anyway
  update profiles set trial_ends_at = null where id = new.user_id;
  perform net.http_post(
    url := 'https://hubkgvfiiszthzqyfguf.supabase.co/functions/v1/trial-convert',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publisher_cron_token'),
                                  'Content-Type', 'application/json'),
    body := jsonb_build_object('user_id', new.user_id),
    timeout_milliseconds := 30000);
  return new;
end $$;

drop trigger if exists trial_convert_on_low_credits on public.credit_transactions;
create trigger trial_convert_on_low_credits after insert on public.credit_transactions
  for each row execute function public.trial_convert_on_low_credits();
