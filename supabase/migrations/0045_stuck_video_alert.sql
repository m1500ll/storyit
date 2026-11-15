-- Owner alert when videos stop being made (e.g. the Modal spend limit was reached on 14/11 and two customers waited
-- 12 hours without anyone knowing). Every 10 minutes: if a Creative Studio video was ordered at least 50 minutes ago and
-- is still not finished (waiting or being made), the owner gets one e-mail (at most one every 3 hours while the problem
-- lasts). A normal video takes a few minutes. Customers are never e-mailed by this.
create table if not exists public.ops_alerts (
  kind text primary key,
  sent_at timestamptz not null
);
alter table public.ops_alerts enable row level security;  -- no policy: service role / definer functions only

create or replace function public.check_stuck_videos() returns void
language plpgsql security definer set search_path = public as $$
declare
  stuck int;
  waiting int;
  oldest timestamptz;
  html text;
begin
  select count(*), count(*) filter (where status = 'queued'), min(created_at) into stuck, waiting, oldest
    from prompt_videos where status in ('queued', 'working') and created_at < now() - interval '50 minutes';
  if stuck = 0 then return; end if;
  if exists (select 1 from ops_alerts where kind = 'stuck_videos' and sent_at > now() - interval '3 hours') then return; end if;

  html := '<p><b>Des vidéos clients ne sont pas terminées 50 minutes après la commande.</b></p><ul>'
    || '<li>' || stuck || ' vidéo(s) concernée(s), dont ' || waiting || ' jamais démarrée(s)</li>'
    || '<li>La plus ancienne a été commandée le ' || to_char(oldest at time zone 'Africa/Casablanca', 'DD/MM à HH24:MI') || '</li>'
    || '</ul><p>Si des vidéos ne démarrent jamais, la cause la plus probable est la limite de dépense Modal. Vérifie sur '
    || '<a href="https://modal.com/settings/usage">modal.com → Settings → Usage &amp; Billing</a> '
    || '(« Spend limit »), puis préviens Claude.</p><p>Prochain rappel dans 3 h si le problème continue.</p>';

  perform net.http_post(
    url := 'https://hubkgvfiiszthzqyfguf.supabase.co/functions/v1/notify-signup',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publisher_cron_token')),
    body := jsonb_build_object('alert', jsonb_build_object('subject', '⚠️ Storyit : des vidéos clients sont bloquées', 'html', html)),
    timeout_milliseconds := 10000);
  insert into ops_alerts (kind, sent_at) values ('stuck_videos', now())
    on conflict (kind) do update set sent_at = excluded.sent_at;
end $$;
revoke all on function public.check_stuck_videos() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule('storyit-stuck-videos') from cron.job where jobname = 'storyit-stuck-videos';
    perform cron.schedule('storyit-stuck-videos', '*/10 * * * *', 'select public.check_stuck_videos()');
  end if;
end $$;
