-- The owner's "new sign-up" email now goes out only once the address is confirmed (e-mail confirmation is on since
-- Nov 17 2026), so fake addresses never trigger it. Google sign-ups arrive already confirmed and notify at once.
-- Replaces the trigger on profiles from 0014. A failure here never blocks the sign-up or the confirmation.
create or replace function notify_confirmed_signup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform net.http_post(
      url := 'https://hubkgvfiiszthzqyfguf.supabase.co/functions/v1/notify-signup',
      headers := jsonb_build_object('Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publisher_cron_token')),
      body := jsonb_build_object('email', new.email, 'name', new.raw_user_meta_data->>'full_name', 'created_at', new.created_at,
        'total', (select count(*) from auth.users where email_confirmed_at is not null)),
      timeout_milliseconds := 10000);
  exception when others then null;
  end;
  return new;
end $$;
revoke all on function notify_confirmed_signup() from public, anon, authenticated;

drop trigger if exists on_profile_created_notify on profiles;

drop trigger if exists on_user_created_confirmed_notify on auth.users;
create trigger on_user_created_confirmed_notify after insert on auth.users
  for each row when (new.email_confirmed_at is not null) execute function notify_confirmed_signup();

drop trigger if exists on_user_email_confirmed_notify on auth.users;
create trigger on_user_email_confirmed_notify after update of email_confirmed_at on auth.users
  for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null) execute function notify_confirmed_signup();
