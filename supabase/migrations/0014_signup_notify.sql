-- Emails the owner on every new account (via the notify-signup Edge Function).
-- Reuses the Vault secret `publisher_cron_token`. A failure here never blocks the sign-up.
create or replace function notify_new_signup() returns trigger
language plpgsql security definer set search_path = public as $$
declare u record;
begin
  begin
    select email, created_at, raw_user_meta_data->>'full_name' as name into u from auth.users where id = new.id;
    perform net.http_post(
      url := 'https://hubkgvfiiszthzqyfguf.supabase.co/functions/v1/notify-signup',
      headers := jsonb_build_object('Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publisher_cron_token')),
      body := jsonb_build_object('email', u.email, 'name', u.name, 'created_at', u.created_at, 'total', (select count(*) from profiles)),
      timeout_milliseconds := 10000);
  exception when others then null;
  end;
  return new;
end $$;
revoke all on function notify_new_signup() from public, anon, authenticated;

drop trigger if exists on_profile_created_notify on profiles;
create trigger on_profile_created_notify after insert on profiles
  for each row execute function notify_new_signup();
