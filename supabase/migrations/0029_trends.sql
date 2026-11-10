-- Daily trend reports ("veille"): the owner pastes the report in the Trends admin page; the `trends` Edge Function splits it
-- into concepts (hook, outline, ending, cover, caption, line to repeat, comment game) and the day's insights.
-- Signed-in customers read them (Prompt Studio "Idées du moment"); only the service role writes.
create table if not exists trend_reports (
  day date primary key,
  insights text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists trend_concepts (
  id uuid primary key default gen_random_uuid(),
  day date not null references trend_reports on delete cascade,
  number integer not null,
  title text not null,
  kind text not null default 'variant' check (kind in ('hit', 'variant')),
  fr_status text check (fr_status in ('green', 'orange', 'red')),
  header text, stats text, cast_text text, hook text, outline text, ending text,
  cover text, caption text, repeat_line text, screen_line text, source_url text,
  created_at timestamptz not null default now(),
  unique (day, number)
);
create index if not exists trend_concepts_day_idx on trend_concepts (day desc, number);
alter table trend_reports enable row level security;
alter table trend_concepts enable row level security;
drop policy if exists "signed in read reports" on trend_reports;
create policy "signed in read reports" on trend_reports for select to authenticated using (true);
drop policy if exists "signed in read concepts" on trend_concepts;
create policy "signed in read concepts" on trend_concepts for select to authenticated using (true);
