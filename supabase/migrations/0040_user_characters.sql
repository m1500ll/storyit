-- Characters created by customers ("Mes personnages"): a universe + one sentence (and optionally a photo) becomes a full
-- look and a reference sheet, drawn by the `characters` Edge Function and reused in every Creative Studio video.
-- The function charges the creation (CHARACTER_COST credits) and refunds it if the drawing fails. Writes: service role only.
create table if not exists public.user_characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  universe text not null,
  description text not null,
  name text not null default '',
  role text not null default '',
  personality text not null default '',
  voice text not null default '',
  look text not null default '',
  sheet_path text,
  status text not null default 'generating' check (status in ('generating', 'ready', 'failed')),
  error text,
  credits_charged integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists user_characters_user_idx on public.user_characters (user_id, created_at desc);
alter table public.user_characters enable row level security;
drop policy if exists "own characters read" on public.user_characters;
create policy "own characters read" on public.user_characters for select using (user_id = auth.uid());

-- reference sheets: private, one folder per user (read through short signed links made by the function)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('characters', 'characters', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists "characters own read" on storage.objects;
create policy "characters own read" on storage.objects for select
  using (bucket_id = 'characters' and (storage.foldername(name))[1] = auth.uid()::text);
