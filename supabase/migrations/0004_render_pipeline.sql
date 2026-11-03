-- Video render pipeline. Run after 0003.
-- Each scene advances: image -> video_submit -> video_wait -> audio -> done (or failed).

alter table scenes add column if not exists stage text not null default 'pending'
  check (stage in ('pending','image','video_submit','video_wait','audio','done','failed'));
alter table scenes add column if not exists image_path text;
alter table scenes add column if not exists video_path text;
alter table scenes add column if not exists audio_path text;
alter table scenes add column if not exists operation text;        -- Veo long-running operation name
alter table scenes add column if not exists attempts smallint not null default 0;
alter table scenes add column if not exists claimed_at timestamptz; -- worker lock (stale after 3 min)

alter table stories add column if not exists render_started_at timestamptz;

-- Private bucket; files live under <user_id>/<story_id>/...
insert into storage.buckets (id, name, public)
values ('renders', 'renders', false)
on conflict (id) do nothing;

drop policy if exists "read own renders" on storage.objects;
create policy "read own renders" on storage.objects for select
  using (bucket_id = 'renders' and (storage.foldername(name))[1] = auth.uid()::text);
-- Writes are done by the `render` Edge Function with the service role only.
