-- Owner actions from the dashboard (admin-stats): credits added/removed, plans offered, accounts banned. Each one is
-- written here (who, what, why) as well as in the member's credit history.
alter table profiles add column if not exists banned_at timestamptz;
alter table profiles add column if not exists ban_reason text;
create table if not exists admin_actions (
  id bigserial primary key, admin_id uuid, user_id uuid not null, action text not null, detail jsonb, created_at timestamptz not null default now()
);
alter table admin_actions enable row level security;
revoke all on admin_actions from anon, authenticated;
