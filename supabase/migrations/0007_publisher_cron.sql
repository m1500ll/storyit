-- Runs the `publisher` Edge Function every minute (server-side; no browser needed). Run after 0006.
-- Before running: Supabase Dashboard → Project Settings → Vault → add a secret named `publisher_service_key`
-- whose value is the project's service_role key. (It stays encrypted in the Vault; never paste it in code.)
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('storyit-publisher') where exists (select 1 from cron.job where jobname = 'storyit-publisher');
select cron.schedule('storyit-publisher', '* * * * *', $$
  select net.http_post(
    url := 'https://hubkgvfiiszthzqyfguf.supabase.co/functions/v1/publisher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publisher_service_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000);
$$);
