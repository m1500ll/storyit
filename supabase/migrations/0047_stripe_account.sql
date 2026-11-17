-- Two Stripe accounts during the move to the company account (ETO Core - F.Z.E): which one holds this customer.
-- null with a stripe_customer_id = the original account ('legacy'); new customers are created on 'new'.
alter table profiles add column if not exists stripe_account text check (stripe_account in ('legacy', 'new'));
