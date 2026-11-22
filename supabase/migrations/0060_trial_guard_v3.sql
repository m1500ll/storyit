-- Trial guard, third round (Nov 22 2026: a refused/failed trial attempt left no trace of its card, so the same card
-- opened a trial on a third account an hour later). Failed attempts are recorded too, with the card holder's name.
alter table trial_claims add column if not exists holder text;
alter table trial_claims drop constraint if exists trial_claims_source_check;
alter table trial_claims add constraint trial_claims_source_check check (source in ('checkout', 'whop', 'whop_failed'));
create index if not exists trial_claims_holder_idx on trial_claims (holder, created_at);
-- the accounts already caught: their card holder names
insert into trial_claims (user_id, source, card, holder, created_at)
select p.id, 'whop_failed', 'Mastercard •••• 0826', 'kereselidze nicolas', now() from profiles p join auth.users u on u.id = p.id
where u.email in ('nicolocoo46@gmail.com', 'nicolocokereselidze@gmail.com', 'nicolocoo46@icloud.com');
