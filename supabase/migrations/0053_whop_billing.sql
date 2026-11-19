-- Whop as a second payment provider (supabase/functions/_shared/whop.ts, billing, whop-webhook).
alter table profiles add column if not exists billing_provider text check (billing_provider in ('stripe', 'whop'));
alter table profiles add column if not exists whop_membership_id text;
alter table profiles add column if not exists whop_product text;
alter table profiles add column if not exists whop_manage_url text;
create index if not exists profiles_whop_membership_idx on profiles (whop_membership_id);

-- server-only settings found or created by the setup (Whop account, product, webhook signing secret): RLS on, no policy
create table if not exists integration_settings (key text primary key, value text not null, updated_at timestamptz not null default now());
alter table integration_settings enable row level security;
revoke all on integration_settings from anon, authenticated;

-- each Whop webhook delivery is processed once (Whop delivers at least once)
create table if not exists whop_events (id text primary key, type text, received_at timestamptz not null default now());
alter table whop_events enable row level security;
revoke all on whop_events from anon, authenticated;
