-- Free-credit abuse: accounts made with fake or throwaway e-mails to collect the welcome credits again and again.
-- The 3 000 welcome credits are now granted only once the e-mail is confirmed (Google sign-ins are confirmed at once),
-- never to a disposable address, and once per real mailbox (gmail dots and +tags count as the same address).
alter table public.profiles add column if not exists email_key text;
alter table public.profiles add column if not exists welcome_granted boolean not null default false;
create index if not exists profiles_email_key_idx on public.profiles (email_key);

-- accounts that already got their bonus keep it and count as "already granted"
update public.profiles p set welcome_granted = true
where exists (select 1 from credit_transactions t where t.user_id = p.id and t.type = 'bonus' and t.description = 'Welcome bonus — free Story Credits');

/** the mailbox behind an address: lower case, gmail/googlemail dots and +tags removed (same inbox) */
create or replace function public.email_key(p_email text) returns text
language sql immutable as $$
  select case
    when split_part(lower(p_email), '@', 2) in ('gmail.com', 'googlemail.com')
      then replace(split_part(split_part(lower(p_email), '@', 1), '+', 1), '.', '') || '@gmail.com'
    else split_part(split_part(lower(p_email), '@', 1), '+', 1) || '@' || split_part(lower(p_email), '@', 2)
  end
$$;

create or replace function public.is_disposable_email(p_email text) returns boolean
language sql immutable as $$
  select split_part(lower(p_email), '@', 2) = any (array[
    'yopmail.com','yopmail.fr','yopmail.net','mailinator.com','mailinator.net','guerrillamail.com','guerrillamail.net','guerrillamail.org',
    'sharklasers.com','grr.la','10minutemail.com','10minutemail.net','temp-mail.org','temp-mail.io','tempmail.com','tempmail.net','tempmail.dev',
    'tempmailo.com','tempail.com','tempr.email','throwawaymail.com','trashmail.com','trashmail.de','getnada.com','nada.email','maildrop.cc',
    'dispostable.com','fakeinbox.com','mintemail.com','emailondeck.com','mohmal.com','moakt.com','mailnesia.com','inboxkitten.com',
    'burnermail.io','spamgourmet.com','mailcatch.com','jetable.org','mail-temporaire.fr','mytemp.email','tmpmail.org','tmpmail.net',
    'minuteinbox.com','emailfake.com','fakemail.net','crazymailing.com','mail.tm','mailto.plus','byom.de','dropmail.me','10mail.org',
    'luxusmail.org','spambox.us','tempinbox.com','33mail.com','anonaddy.me','emltmp.com','cpmail.life','kzccv.com'
  ])
$$;

/** grants the welcome credits once the address is confirmed, real, and new (called on sign-up and on confirmation) */
create or replace function public.grant_welcome_bonus(p_user uuid, p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare
  k text := email_key(p_email);
  bal integer;
begin
  update profiles set email_key = k where id = p_user and email_key is distinct from k;
  if p_email is null or is_disposable_email(p_email) then return; end if;
  if exists (select 1 from profiles where id = p_user and welcome_granted) then return; end if;
  if exists (select 1 from profiles where email_key = k and welcome_granted and id <> p_user) then return; end if;
  update profiles set credit_balance = credit_balance + 3000, welcome_granted = true where id = p_user and not welcome_granted
    returning credit_balance into bal;
  if bal is null then return; end if;
  insert into credit_transactions (user_id, type, amount, balance_after, description)
  values (p_user, 'bonus', 3000, bal, 'Welcome bonus — free Story Credits');
end $$;
revoke all on function public.grant_welcome_bonus(uuid, text) from public, anon, authenticated;

alter table profiles alter column credit_balance set default 0;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
begin
  insert into profiles (id, display_name, plan, credit_balance, email_key)
  values (new.id, split_part(new.email, '@', 1), 'free', 0, email_key(new.email))
  on conflict (id) do nothing;
  -- Google (and any already-confirmed sign-up) gets the bonus now; e-mail sign-ups when they confirm (trigger below)
  if new.email_confirmed_at is not null then perform grant_welcome_bonus(new.id, new.email); end if;
  return new;
end $function$;

create or replace function public.handle_user_confirmed() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then perform grant_welcome_bonus(new.id, new.email); end if;
  return new;
end $function$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users
  for each row execute function public.handle_user_confirmed();
