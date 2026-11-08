-- $1 three-day trial (billing + stripe-webhook): one per account. Set when the trial's first invoice is paid.
alter table profiles add column if not exists trial_used boolean not null default false;
