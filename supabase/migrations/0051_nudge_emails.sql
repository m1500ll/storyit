-- Automatic reminders for free accounts that stopped before their first video (supabase/functions/mailing, `nudges`):
-- an hourly call; the function decides who gets what, logs each e-mail in email_sends (never twice) and sends only
-- while the NUDGES_LIVE secret is "on".
create or replace function public.send_nudges()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://hubkgvfiiszthzqyfguf.supabase.co/functions/v1/mailing',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publisher_cron_token'),
                                  'Content-Type', 'application/json'),
    body := jsonb_build_object('nudges', jsonb_build_object()),
    timeout_milliseconds := 60000);
end $$;

revoke all on function public.send_nudges() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule('storyit-nudges') from cron.job where jobname = 'storyit-nudges';
    perform cron.schedule('storyit-nudges', '41 * * * *', 'select public.send_nudges()');
  end if;
end $$;
