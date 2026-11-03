-- Billing (Stripe). Run after 0002.

alter table profiles add column if not exists stripe_customer_id text unique;
alter table profiles add column if not exists plan_renews_at timestamptz;

-- Idempotency: each Stripe event is applied at most once.
create table if not exists stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);
alter table stripe_events enable row level security; -- no policies: service role only

-- Credit grants. Callable ONLY by the service role (Stripe webhook), never by browsers.
create or replace function grant_credits(
  p_user_id uuid, p_amount integer, p_type credit_tx_type, p_description text,
  p_plan text default null, p_reset boolean default false
) returns integer
language plpgsql security definer set search_path = public as $$
declare new_balance integer;
begin
  if p_amount < 0 then raise exception 'amount must be >= 0'; end if;
  update profiles set
    -- Subscription renewals reset to the plan allowance (no rollover); top-ups add.
    credit_balance = case when p_reset then greatest(credit_balance, p_amount) else credit_balance + p_amount end,
    plan = coalesce(p_plan, plan)
  where id = p_user_id
  returning credit_balance into new_balance;
  if new_balance is null then raise exception 'profile not found'; end if;
  insert into credit_transactions (user_id, type, amount, balance_after, description)
    values (p_user_id, p_type, p_amount, new_balance, p_description);
  return new_balance;
end $$;

revoke execute on function grant_credits(uuid, integer, credit_tx_type, text, text, boolean) from public, anon, authenticated;
grant execute on function grant_credits(uuid, integer, credit_tx_type, text, text, boolean) to service_role;
