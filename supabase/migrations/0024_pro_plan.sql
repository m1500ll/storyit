-- Pro plan ($49/month, 1,200 credits): between Creator and Studio. Everything in Creator with higher limits.
alter table profiles drop constraint if exists profiles_plan_check;
alter table profiles add constraint profiles_plan_check check (plan in ('free', 'creator', 'pro', 'studio'));
insert into plan_limits (plan, max_social_accounts, max_media_assets, max_pending_publications)
  values ('pro', 30, 2000, 10000)
on conflict (plan) do nothing;
