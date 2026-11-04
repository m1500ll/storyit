-- Indexes for foreign keys used in joins, RLS checks and cascading deletes (none existed).
create index if not exists characters_story_id_idx on characters (story_id);
create index if not exists credit_transactions_story_id_idx on credit_transactions (story_id);
create index if not exists publish_packs_user_id_idx on publish_packs (user_id);
create index if not exists thumbnails_user_id_idx on thumbnails (user_id);
create index if not exists social_accounts_group_id_idx on social_accounts (group_id);
create index if not exists oauth_states_user_id_idx on oauth_states (user_id);
create index if not exists media_assets_story_id_idx on media_assets (story_id);
create index if not exists campaigns_user_id_idx on campaigns (user_id);
create index if not exists campaign_targets_account_id_idx on campaign_targets (account_id);
create index if not exists scheduled_publications_campaign_id_idx on scheduled_publications (campaign_id);
create index if not exists scheduled_publications_account_id_idx on scheduled_publications (account_id);
create index if not exists publication_events_user_id_idx on publication_events (user_id);
