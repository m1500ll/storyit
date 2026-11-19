-- Dodo Payments as merchant of record (supabase/functions/_shared/dodo.ts, billing, dodo-webhook).
alter table profiles drop constraint if exists profiles_billing_provider_check;
alter table profiles add constraint profiles_billing_provider_check check (billing_provider in ('stripe', 'whop', 'paddle', 'dodo'));
alter table profiles add column if not exists dodo_customer_id text;
alter table profiles add column if not exists dodo_subscription_id text;
alter table profiles add column if not exists dodo_product text;
create index if not exists profiles_dodo_subscription_idx on profiles (dodo_subscription_id);

create table if not exists dodo_events (id text primary key, type text, received_at timestamptz not null default now());
alter table dodo_events enable row level security;
revoke all on dodo_events from anon, authenticated;
