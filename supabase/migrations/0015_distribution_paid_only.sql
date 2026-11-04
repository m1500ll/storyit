-- Distribution (video library, scheduled posts, connected accounts) is for paying plans only.
-- The free plan keeps the Prompt Studio. Enforced by the existing guards (0006) and the social OAuth callback.
update plan_limits set max_social_accounts = 0, max_media_assets = 0, max_pending_publications = 0 where plan = 'free';
