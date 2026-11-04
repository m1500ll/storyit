-- Prompt Studio: guided 5-phase prompt generation (concepts → script → image JSON → video JSON → thumbnail & SEO).
-- The master prompt lives only in the `prompts` Edge Function; this table stores each customer's project.
create table if not exists prompt_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references profiles on delete cascade,
  title text not null default 'Nouveau projet',
  idea text,
  phase smallint not null default 1 check (phase between 1 and 5),   -- highest phase reached
  data jsonb not null default '{}'::jsonb,                         -- { concepts, chosen, script, images, videos, pack }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists prompt_projects_user on prompt_projects (user_id, updated_at desc);
alter table prompt_projects enable row level security;
drop policy if exists "own prompt projects read" on prompt_projects;
create policy "own prompt projects read" on prompt_projects for select using (user_id = auth.uid());
drop policy if exists "own prompt projects delete" on prompt_projects;
create policy "own prompt projects delete" on prompt_projects for delete using (user_id = auth.uid());
-- Inserts/updates go through the `prompts` function (service role), which checks ownership and charges credits.
