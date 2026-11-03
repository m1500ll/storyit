-- ROLLBACK of 0007 + 0006 (distribution). NOT a migration: run by hand in the SQL Editor only if needed.
-- It removes the distribution feature and ALL its data (accounts, tokens, library rows, campaigns, publications).
-- Library video FILES are not deleted by this script: empty the `library` bucket in Storage first if you also want them gone.

-- 1. Stop the worker (safe to run alone at any time; this is the "off switch").
select cron.unschedule('storyit-publisher') where exists (select 1 from cron.job where jobname = 'storyit-publisher');

-- 2. Remove the schema added by 0006 (order matters because of foreign keys).
begin;
do $$ declare t text; begin
  foreach t in array array['social_accounts','media_assets','campaigns','scheduled_publications'] loop
    begin execute format('alter publication supabase_realtime drop table %I', t); exception when others then null; end;
  end loop;
end $$;
drop table if exists publication_events, scheduled_publications, campaign_targets, campaigns, media_assets,
  oauth_states, social_account_tokens, social_accounts, social_account_groups, plan_limits cascade;
drop function if exists claim_publications(text, integer), log_publication_event(), publications_guard(),
  media_assets_guard(), social_accounts_guard(), plan_limit(uuid, text);
drop policy if exists "library own read" on storage.objects;
drop policy if exists "library own upload" on storage.objects;
drop policy if exists "library own delete" on storage.objects;
commit;
-- 3. (optional, after emptying it) delete from storage.buckets where id = 'library';
