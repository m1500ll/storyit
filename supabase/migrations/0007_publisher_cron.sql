-- Runs the `publisher` Edge Function every minute (server-side; no browser needed). Run after 0006.
-- Before running: create a random token, store it (1) as the Edge Function secret PUBLISHER_CRON_TOKEN and
-- (2) in the database Vault under the name `publisher_cron_token` (same value). It stays encrypted; never paste it in code.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('storyit-publisher') where exists (select 1 from cron.job where jobname = 'storyit-publisher');
select cron.schedule('storyit-publisher', '* * * * *', $$
  select net.http_post(
    url := 'https://hubkgvfiiszthzqyfguf.supabase.co/functions/v1/publisher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publisher_cron_token')),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000);
$$);
