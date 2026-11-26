-- Why subscribers leave: the reason picked on the "before you cancel" screen and what they did next.
create table if not exists public.cancel_feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text,
  reason text not null,
  details text,
  outcome text not null check (outcome in ('cancel', 'downgrade', 'stayed')),
  created_at timestamptz not null default now()
);
create index if not exists cancel_feedback_created on public.cancel_feedback (created_at desc);
alter table public.cancel_feedback enable row level security; -- written by the billing function only (service role)
revoke all on public.cancel_feedback from anon, authenticated;
