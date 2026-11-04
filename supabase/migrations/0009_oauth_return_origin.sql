-- OAuth: remember which Storyit site (production domain, Vercel deployment, local dev) started the connection,
-- so the user lands back where they were. Validated against an allowlist by the `social` function.
alter table oauth_states add column if not exists return_origin text;
