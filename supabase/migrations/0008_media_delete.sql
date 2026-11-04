-- Let customers remove their own failed or interrupted uploads (never a video that was published or scheduled:
-- scheduled_publications.media_id is ON DELETE RESTRICT, so the delete fails if any publication references it).
drop policy if exists "own delete failed uploads" on media_assets;
create policy "own delete failed uploads" on media_assets for delete
  using (user_id = auth.uid() and status in ('error', 'uploading'));
