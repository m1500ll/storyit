-- Announcement e-mails (Edge Function `mailing`): an opt-out flag per account (one-click link in every e-mail) and a
-- log of what each account received, so a campaign never goes twice to the same person.
alter table profiles add column if not exists marketing_opt_out boolean not null default false;
alter table profiles add column if not exists marketing_opt_out_at timestamptz;
create table if not exists email_sends (
  user_id uuid not null references profiles on delete cascade,
  campaign text not null,
  sent_at timestamptz not null default now(),
  resend_id text,
  primary key (user_id, campaign)
);
alter table email_sends enable row level security; -- service role only
