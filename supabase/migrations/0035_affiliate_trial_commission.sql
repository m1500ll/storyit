-- Partner commission with the $1 trial:
--   * the trial payment ($1) earns the partner's rate on $1 only (status 'trial');
--   * the first full subscription payment then adds the partner's rate on that payment (status 'paid').
-- A trial started within the 7-day click window keeps its partner when the full payment comes later.
alter table public.affiliate_conversions drop constraint if exists affiliate_conversions_status_check;
alter table public.affiliate_conversions add constraint affiliate_conversions_status_check check (status in ('signed_up', 'trial', 'paid'));

drop function if exists public.record_affiliate_payment(uuid, text, integer, text, text);
create or replace function public.record_affiliate_payment(p_user uuid, p_invoice text, p_amount integer, p_currency text, p_product text, p_trial boolean default false)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare pr profiles; rate numeric; c integer; cur affiliate_conversions;
begin
  select * into pr from profiles where id = p_user;
  if pr.affiliate_id is null or p_amount <= 0 then return 0; end if;
  select * into cur from affiliate_conversions where user_id = p_user;
  if cur.status = 'paid' then return 0; end if;                        -- only the first full payment counts
  if p_trial and cur.status = 'trial' then return 0; end if;           -- one trial commission
  -- the click window applies when the customer first pays (the trial, or a direct subscription)
  if cur.status is distinct from 'trial' and (pr.affiliate_clicked_at is null or pr.affiliate_clicked_at < now() - interval '7 days') then return 0; end if;
  select commission_rate into rate from affiliates where id = coalesce(case when cur.status = 'trial' then cur.affiliate_id end, pr.affiliate_id) and active;
  if rate is null then return 0; end if;
  c := round(p_amount * rate);
  if cur.status = 'trial' then
    -- full payment after the trial: add it to the $1 already counted
    update affiliate_conversions set status = 'paid', product = p_product, amount_cents = coalesce(amount_cents, 0) + p_amount,
      commission_cents = coalesce(commission_cents, 0) + c, currency = p_currency, stripe_invoice_id = p_invoice, paid_at = now()
    where user_id = p_user;
  else
    insert into affiliate_conversions (affiliate_id, user_id, status, product, amount_cents, commission_cents, currency, stripe_invoice_id, paid_at)
      values (pr.affiliate_id, p_user, case when p_trial then 'trial' else 'paid' end, p_product, p_amount, c, p_currency, p_invoice, now())
    on conflict (user_id) do update set affiliate_id = excluded.affiliate_id, status = excluded.status, product = excluded.product,
      amount_cents = excluded.amount_cents, commission_cents = excluded.commission_cents, currency = excluded.currency,
      stripe_invoice_id = excluded.stripe_invoice_id, paid_at = excluded.paid_at
    where affiliate_conversions.status = 'signed_up';
  end if;
  return c;
end $$;

revoke all on function public.record_affiliate_payment(uuid, text, integer, text, text, boolean) from public, anon, authenticated;
