-- The $1 trial now turns into the chosen plan as soon as 1,500 trial credits or fewer remain (was: fewer than 1,000).
create or replace function public.trial_convert_on_low_credits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ends timestamptz;
begin
  -- switch once 1 500 trial credits or fewer remain
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
