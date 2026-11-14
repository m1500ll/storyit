-- Music imported by a customer in the video wizard ("Importer ma musique"): private, one folder per user. The video
-- worker reads it through a short signed link made when the video is ordered. The customer is responsible for its rights.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('music', 'music', false, 15728640, array['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/ogg'])
on conflict (id) do nothing;
drop policy if exists "music own read" on storage.objects;
create policy "music own read" on storage.objects for select
  using (bucket_id = 'music' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "music own upload" on storage.objects;
create policy "music own upload" on storage.objects for insert
  with check (bucket_id = 'music' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "music own delete" on storage.objects;
create policy "music own delete" on storage.objects for delete
  using (bucket_id = 'music' and (storage.foldername(name))[1] = auth.uid()::text);
