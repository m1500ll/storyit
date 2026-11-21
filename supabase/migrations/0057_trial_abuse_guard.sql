-- Free trial abuse guard (Nov 21 2026: one person opened 6 trials in 1 h 40 from the same phone, with throwaway
-- e-mails and invalid cards). See supabase/functions/billing (checkout) and whop-webhook (trial start).

-- 1. the trial is for mainstream mailboxes only (throwaway domains are endless; a blocklist can't keep up)
create or replace function trial_email_ok(p_email text) returns boolean language sql immutable as $$
  select split_part(lower(coalesce(p_email, '')), '@', 2) = any (array[
    'gmail.com','googlemail.com','outlook.com','outlook.fr','hotmail.com','hotmail.fr','hotmail.be','hotmail.co.uk','live.com','live.fr','live.be',
    'msn.com','yahoo.com','yahoo.fr','yahoo.co.uk','ymail.com','icloud.com','me.com','mac.com','aol.com','aol.fr','proton.me','protonmail.com',
    'gmx.com','gmx.fr','gmx.de','gmx.net','web.de','laposte.net','orange.fr','wanadoo.fr','free.fr','sfr.fr','neuf.fr','bbox.fr','numericable.fr',
    'skynet.be','telenet.be','bluewin.ch','libero.it','yandex.com','yandex.ru','mail.ru','zoho.com','qq.com','163.com'
  ])
$$;

-- more throwaway domains seen on Nov 21 (also blocks the welcome bonus)
create or replace function is_disposable_email(p_email text) returns boolean language sql immutable as $$
  select split_part(lower(p_email), '@', 2) = any (array[
    'yopmail.com','yopmail.fr','yopmail.net','mailinator.com','mailinator.net','guerrillamail.com','guerrillamail.net','guerrillamail.org',
    'sharklasers.com','grr.la','10minutemail.com','10minutemail.net','temp-mail.org','temp-mail.io','tempmail.com','tempmail.net','tempmail.dev',
    'tempmailo.com','tempail.com','tempr.email','throwawaymail.com','trashmail.com','trashmail.de','getnada.com','nada.email','maildrop.cc',
    'dispostable.com','fakeinbox.com','mintemail.com','emailondeck.com','mohmal.com','moakt.com','mailnesia.com','inboxkitten.com',
    'burnermail.io','spamgourmet.com','mailcatch.com','jetable.org','mail-temporaire.fr','mytemp.email','tmpmail.org','tmpmail.net',
    'minuteinbox.com','emailfake.com','fakemail.net','crazymailing.com','mail.tm','mailto.plus','byom.de','dropmail.me','10mail.org',
    'luxusmail.org','spambox.us','tempinbox.com','33mail.com','anonaddy.me','emltmp.com','cpmail.life','kzccv.com',
    'kranove.com','dvdee.com','bonuscable.com'
  ])
$$;

-- 2. every trial attempt, with the network address and card it came from (one trial per device / network / card)
create table if not exists trial_claims (
  id bigserial primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  source text not null check (source in ('checkout', 'whop')),
  ip text, card text,
  created_at timestamptz not null default now()
);
create index if not exists trial_claims_ip_idx on trial_claims (ip, created_at);
create index if not exists trial_claims_card_idx on trial_claims (card, created_at);
alter table trial_claims enable row level security;
revoke all on trial_claims from anon, authenticated;
