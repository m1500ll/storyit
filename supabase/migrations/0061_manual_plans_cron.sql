-- A plan sold by hand (one-off payment, no subscription behind it): billing_provider 'manual', ends at plan_renews_at.
-- The hourly job returns it to the free plan once that date has passed (its credits stay).
alter table profiles drop constraint if exists profiles_billing_provider_check;
alter table profiles add constraint profiles_billing_provider_check check (billing_provider in ('stripe', 'whop', 'paddle', 'dodo', 'manual'));
select cron.unschedule('storyit-expire-manual-plans') where exists (select 1 from cron.job where jobname = 'storyit-expire-manual-plans');
select cron.schedule('storyit-expire-manual-plans', '27 * * * *', $$
  update profiles set plan = 'free', plan_renews_at = null
  where billing_provider = 'manual' and plan <> 'free' and plan_renews_at is not null and plan_renews_at < now()
$$);
