-- Starter plan: $9/month, 12,000 credits (3 videos of 30 s), a small entry offer.
alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles add constraint profiles_plan_check check (plan = any (array['free', 'starter', 'creator', 'pro', 'studio']));
insert into public.plan_limits (plan, max_social_accounts, max_media_assets, max_pending_publications, max_upload_mb)
values ('starter', 2, 100, 200, 50)
on conflict (plan) do update set max_social_accounts = excluded.max_social_accounts, max_media_assets = excluded.max_media_assets,
  max_pending_publications = excluded.max_pending_publications, max_upload_mb = excluded.max_upload_mb;
