-- Trial guard, second round (Nov 22 2026: the same person came back with a new IPv6 address from the same mobile
-- operator, a proton.me address and a disposable virtual card).

-- 1. privacy-first mailboxes leave the trial list (they can still buy directly)
create or replace function trial_email_ok(p_email text) returns boolean language sql immutable as $$
  select split_part(lower(coalesce(p_email, '')), '@', 2) = any (array[
    'gmail.com','googlemail.com','outlook.com','outlook.fr','hotmail.com','hotmail.fr','hotmail.be','hotmail.co.uk','live.com','live.fr','live.be',
    'msn.com','yahoo.com','yahoo.fr','yahoo.co.uk','ymail.com','icloud.com','me.com','mac.com','aol.com','aol.fr',
    'gmx.com','gmx.fr','gmx.de','gmx.net','web.de','laposte.net','orange.fr','wanadoo.fr','free.fr','sfr.fr','neuf.fr','bbox.fr','numericable.fr',
    'skynet.be','telenet.be','bluewin.ch','libero.it','yandex.com','yandex.ru','mail.ru','zoho.com','qq.com','163.com'
  ])
$$;

-- 2. the browser of each trial attempt (with the network prefix it is compared on)
alter table trial_claims add column if not exists ua text;

-- 3. the old Stripe "switch to paid when trial credits run low" trigger only applies to Stripe trials: it was clearing
--    the end date of Whop trials (so no reminder e-mail and a wrong dashboard)
create or replace function trial_convert_on_low_credits() returns trigger
language plpgsql security definer set search_path = public as $$
declare ends timestamptz; prov text;
begin
  if new.type <> 'consumption' or new.balance_after > 1500 then return new; end if;
  select trial_ends_at, billing_provider into ends, prov from profiles where id = new.user_id;
  if ends is null or ends < now() then return new; end if;
  if prov is not null and prov <> 'stripe' then return new; end if;
  update profiles set trial_ends_at = null where id = new.user_id;
  perform net.http_post(
    url := 'https://hubkgvfiiszthzqyfguf.supabase.co/functions/v1/trial-convert',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publisher_cron_token'),
                                  'Content-Type', 'application/json'),
    body := jsonb_build_object('user_id', new.user_id),
    timeout_milliseconds := 30000);
  return new;
end $$;

-- 4. Whop trials whose end date was cleared get it back (start of the trial + 3 days)
update profiles p set trial_ends_at = c.created_at + interval '3 days'
from (select user_id, min(created_at) created_at from trial_claims where source = 'whop' group by user_id) c
where p.id = c.user_id and p.billing_provider = 'whop' and p.plan <> 'free' and p.trial_ends_at is null and c.created_at > now() - interval '3 days';
