-- $1 trial e-mails: the welcome e-mail is sent by stripe-webhook when the trial starts; the reminder goes out about a day
-- before the trial ends (hourly check), once, and never when the trial already turned into a paid plan.
alter table public.profiles add column if not exists trial_reminder_sent_at timestamptz;

create or replace function public.send_trial_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in select id from profiles
           where trial_ends_at between now() + interval '18 hours' and now() + interval '30 hours'
             and trial_reminder_sent_at is null
  loop
    update profiles set trial_reminder_sent_at = now() where id = r.id;
    perform net.http_post(
      url := 'https://hubkgvfiiszthzqyfguf.supabase.co/functions/v1/mailing',
      headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publisher_cron_token'),
                                    'Content-Type', 'application/json'),
      body := jsonb_build_object('trial_reminder', r.id),
      timeout_milliseconds := 30000);
  end loop;
end $$;

revoke all on function public.send_trial_reminders() from public, anon, authenticated;

-- pg_cron exists on Supabase only (the local test database has no cron schema)
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule('storyit-trial-reminders') from cron.job where jobname = 'storyit-trial-reminders';
    perform cron.schedule('storyit-trial-reminders', '17 * * * *', 'select public.send_trial_reminders()');
  end if;
end $$;
