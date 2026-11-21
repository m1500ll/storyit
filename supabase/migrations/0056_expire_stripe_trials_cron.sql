-- The Stripe accounts are closed (Nov 2026): a Stripe trial can no longer turn into a paid plan, and Stripe may not
-- send the cancellation. Two hours after a Stripe trial ends, the account goes back to the free plan (its credits stay).
-- Whop / Dodo / Paddle trials are handled by their own webhooks.
select cron.unschedule('storyit-expire-stripe-trials') where exists (select 1 from cron.job where jobname = 'storyit-expire-stripe-trials');
select cron.schedule('storyit-expire-stripe-trials', '23 * * * *', $$
  update profiles set plan = 'free', trial_ends_at = null
  where coalesce(billing_provider, 'stripe') = 'stripe' and plan <> 'free' and trial_ends_at is not null
    and trial_ends_at < now() - interval '2 hours'
$$);
