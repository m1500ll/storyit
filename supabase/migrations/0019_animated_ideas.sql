-- Story ideas the Animated Studio has already proposed (all customers). The brief chat sends the most recent ones
-- to Claude as "already taken" so two customers who pick the same theme get different options.
-- Service role only (RLS on, no policy): titles never leave the Edge Function.
create table if not exists animated_ideas (
  id bigserial primary key,
  theme text,
  step text not null default 'story',
  title text not null,
  created_at timestamptz not null default now()
);
create index if not exists animated_ideas_recent_idx on animated_ideas (created_at desc);
alter table animated_ideas enable row level security;
