-- Automatic Creative Studio pipeline (the wizard's "Générer"): each step of a project (review, images, videos, pack,
-- video order) runs in its own call of the `prompts` Edge Function, queued here through pg_net so no call has to wait
-- for the next one. Called by the functions with the service role only.
create or replace function public.queue_prompt_step(p_body jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
begin
  return net.http_post(
    url := 'https://hubkgvfiiszthzqyfguf.supabase.co/functions/v1/prompts',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publisher_cron_token'),
                                  'Content-Type', 'application/json'),
    body := p_body,
    timeout_milliseconds := 300000);
end $$;

revoke all on function public.queue_prompt_step(jsonb) from public, anon, authenticated;
grant execute on function public.queue_prompt_step(jsonb) to service_role;
