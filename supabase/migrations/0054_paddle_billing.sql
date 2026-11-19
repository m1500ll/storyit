-- Paddle as merchant of record (supabase/functions/_shared/paddle.ts, billing, paddle-webhook).
alter table profiles drop constraint if exists profiles_billing_provider_check;
alter table profiles add constraint profiles_billing_provider_check check (billing_provider in ('stripe', 'whop', 'paddle'));
alter table profiles add column if not exists paddle_customer_id text;
alter table profiles add column if not exists paddle_subscription_id text;
alter table profiles add column if not exists paddle_product text;
create index if not exists profiles_paddle_subscription_idx on profiles (paddle_subscription_id);

-- each Paddle notification is processed once (Paddle delivers at least once)
create table if not exists paddle_events (id text primary key, type text, received_at timestamptz not null default now());
alter table paddle_events enable row level security;
revoke all on paddle_events from anon, authenticated;
