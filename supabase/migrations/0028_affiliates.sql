-- Affiliate (influencer) programme. Each partner has a public promo code (storyit.fun/?via=CODE) and a secret token for
-- their live dashboard (storyit.fun/partner/<secret>). A click is recorded with an anonymous visitor id; a visitor who
-- then signs up (or is signed in) is attached to the partner; when that customer pays their FIRST subscription invoice
-- within 7 days of their last click, the partner earns `commission_rate` of the amount paid, once per customer.
-- Partners and owners never see customers' e-mails. Writes go through the `affiliate` Edge Function or the
-- stripe-webhook (service role); admin actions require profiles.is_admin.
alter table profiles add column if not exists is_admin boolean not null default false;
alter table profiles add column if not exists affiliate_id uuid;
alter table profiles add column if not exists affiliate_clicked_at timestamptz;

create table if not exists affiliates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique check (code ~ '^[a-z0-9-]{2,24}$'),
  secret text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  commission_rate numeric not null default 0.20 check (commission_rate >= 0 and commission_rate <= 1),
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);
alter table profiles drop constraint if exists profiles_affiliate_fk;
alter table profiles add constraint profiles_affiliate_fk foreign key (affiliate_id) references affiliates on delete set null;

create table if not exists affiliate_clicks (
  id bigserial primary key,
  affiliate_id uuid not null references affiliates on delete cascade,
  visitor text not null,
  created_at timestamptz not null default now()
);
create index if not exists affiliate_clicks_idx on affiliate_clicks (affiliate_id, created_at desc);
create index if not exists affiliate_clicks_visitor_idx on affiliate_clicks (visitor, created_at desc);

create table if not exists affiliate_conversions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references affiliates on delete cascade,
  user_id uuid not null unique references profiles on delete cascade,
  signed_up_at timestamptz not null default now(),
  status text not null default 'signed_up' check (status in ('signed_up', 'paid')),
  product text,
  amount_cents integer,
  commission_cents integer,
  currency text,
  stripe_invoice_id text unique,
  paid_at timestamptz
);
create index if not exists affiliate_conversions_idx on affiliate_conversions (affiliate_id, signed_up_at desc);

create table if not exists affiliate_payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references affiliates on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  note text,
  paid_at timestamptz not null default now()
);

alter table affiliates enable row level security;
alter table affiliate_clicks enable row level security;
alter table affiliate_conversions enable row level security;
alter table affiliate_payouts enable row level security; -- no policies: service role only

-- webhook (service role): the customer's first paid subscription invoice. Credits the partner once, only within 7 days
-- of the customer's last click. Returns the commission in cents (0 when nothing is credited). Idempotent.
create or replace function record_affiliate_payment(p_user uuid, p_invoice text, p_amount integer, p_currency text, p_product text)
returns integer language plpgsql security definer set search_path = public as $$
declare pr profiles; rate numeric; c integer;
begin
  select * into pr from profiles where id = p_user;
  if pr.affiliate_id is null or p_amount <= 0 then return 0; end if;
  if pr.affiliate_clicked_at is null or pr.affiliate_clicked_at < now() - interval '7 days' then return 0; end if;
  if exists (select 1 from affiliate_conversions where user_id = p_user and status = 'paid') then return 0; end if;
  select commission_rate into rate from affiliates where id = pr.affiliate_id and active;
  if rate is null then return 0; end if;
  c := round(p_amount * rate);
  insert into affiliate_conversions (affiliate_id, user_id, status, product, amount_cents, commission_cents, currency, stripe_invoice_id, paid_at)
    values (pr.affiliate_id, p_user, 'paid', p_product, p_amount, c, p_currency, p_invoice, now())
  on conflict (user_id) do update set affiliate_id = excluded.affiliate_id, status = 'paid', product = excluded.product,
    amount_cents = excluded.amount_cents, commission_cents = excluded.commission_cents, currency = excluded.currency,
    stripe_invoice_id = excluded.stripe_invoice_id, paid_at = excluded.paid_at
  where affiliate_conversions.status <> 'paid';
  return c;
end $$;
revoke all on function record_affiliate_payment(uuid, text, integer, text, text) from public, anon, authenticated;
grant execute on function record_affiliate_payment(uuid, text, integer, text, text) to service_role;
