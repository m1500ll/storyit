-- Referral programme. Each account has a short referral code (storyit.fun/?ref=CODE). A visitor who signs up through
-- a link is attached to the referrer (claim_referral, once, never oneself). When the referred friend pays their first
-- subscription invoice, the stripe-webhook marks the referral qualified, gives the friend REFERRAL_FRIEND_BONUS
-- credits and the referrer free months as Stripe customer balance: 1 month for each of the first four qualified
-- friends, 6 months for the fifth, then 1 month for each one after.
alter table profiles add column if not exists referral_code text unique;
alter table profiles add column if not exists referred_by uuid references profiles on delete set null;

create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references profiles on delete cascade,
  referred_id uuid not null unique references profiles on delete cascade,
  status text not null default 'signed_up' check (status in ('signed_up', 'qualified')),
  reward_months integer not null default 0,
  friend_bonus integer not null default 0,
  created_at timestamptz not null default now(),
  qualified_at timestamptz,
  check (referrer_id <> referred_id)
);
create index if not exists referrals_referrer_idx on referrals (referrer_id, created_at desc);
alter table referrals enable row level security;
drop policy if exists "referrer reads own referrals" on referrals;
create policy "referrer reads own referrals" on referrals for select using (referrer_id = auth.uid());

-- the caller's referral code, created on first use (8 characters, no ambiguous letters)
create or replace function my_referral_code() returns text
language plpgsql security definer set search_path = public as $$
declare c text; alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; i int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select referral_code into c from profiles where id = auth.uid();
  if c is not null then return c; end if;
  loop
    c := '';
    for i in 1..8 loop c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    begin
      update profiles set referral_code = c where id = auth.uid() and referral_code is null;
      exit;
    exception when unique_violation then -- try another code
    end;
  end loop;
  select referral_code into c from profiles where id = auth.uid();
  return c;
end $$;
revoke all on function my_referral_code() from public, anon;
grant execute on function my_referral_code() to authenticated;

-- attaches the caller to the owner of p_code: once, never to oneself, only for an account created in the last 14 days
-- that has never had a paid plan. Returns 'ok' or the reason it did not attach.
create or replace function claim_referral(p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare me profiles; ref_id uuid;
begin
  if auth.uid() is null then return 'not_signed_in'; end if;
  select * into me from profiles where id = auth.uid();
  if me.id is null then return 'no_profile'; end if;
  if me.referred_by is not null then return 'already_referred'; end if;
  if me.created_at < now() - interval '14 days' then return 'too_late'; end if;
  if coalesce(me.plan, 'free') <> 'free' then return 'already_subscribed'; end if;
  select id into ref_id from profiles where referral_code = upper(trim(p_code));
  if ref_id is null then return 'unknown_code'; end if;
  if ref_id = me.id then return 'self'; end if;
  update profiles set referred_by = ref_id where id = me.id and referred_by is null;
  insert into referrals (referrer_id, referred_id) values (ref_id, me.id) on conflict (referred_id) do nothing;
  return 'ok';
end $$;
revoke all on function claim_referral(text) from public, anon;
grant execute on function claim_referral(text) to authenticated;

-- the caller's referrals with a display label for each friend (first letter of the email + domain hidden)
create or replace function my_referrals() returns table (label text, status text, reward_months int, created_at timestamptz, qualified_at timestamptz)
language sql security definer set search_path = public as $$
  select coalesce(nullif(p.display_name, ''), left(split_part(u.email, '@', 1), 2) || '•••') as label,
         r.status, r.reward_months, r.created_at, r.qualified_at
  from referrals r join profiles p on p.id = r.referred_id left join auth.users u on u.id = r.referred_id
  where r.referrer_id = auth.uid() order by r.created_at desc limit 200;
$$;
revoke all on function my_referrals() from public, anon;
grant execute on function my_referrals() to authenticated;

-- webhook (service role): qualifies the referral of p_referred on their first paid subscription invoice.
-- Returns the referrer and the months they earn (null when there is nothing to reward). Idempotent.
create or replace function qualify_referral(p_referred uuid, p_friend_bonus int) returns table (referrer_id uuid, months int, rank int)
language plpgsql security definer set search_path = public as $$
declare r referrals; n int; m int;
begin
  update referrals set status = 'qualified', qualified_at = now(), friend_bonus = p_friend_bonus
    where referred_id = p_referred and status = 'signed_up' returning * into r;
  if r.id is null then return; end if;
  select count(*) into n from referrals x where x.referrer_id = r.referrer_id and x.status = 'qualified';
  m := case when n = 5 then 6 else 1 end;
  update referrals set reward_months = m where id = r.id;
  referrer_id := r.referrer_id; months := m; rank := n;
  return next;
end $$;
revoke all on function qualify_referral(uuid, int) from public, anon, authenticated;
grant execute on function qualify_referral(uuid, int) to service_role;

-- rewards are applied by the webhook after qualification; these flags make a failed Stripe call retryable without
-- ever paying twice (the Stripe call also carries an idempotency key per referral)
alter table referrals add column if not exists reward_applied boolean not null default false;
alter table referrals add column if not exists bonus_applied boolean not null default false;
drop function if exists qualify_referral(uuid, int);
create or replace function qualify_referral(p_referred uuid, p_friend_bonus int)
returns table (referral_id uuid, referrer_id uuid, months int, rank int, reward_applied boolean, bonus_applied boolean, friend_bonus int)
language plpgsql security definer set search_path = public as $$
declare r referrals; n int;
begin
  update referrals set status = 'qualified', qualified_at = now(), friend_bonus = p_friend_bonus
    where referred_id = p_referred and status = 'signed_up' returning * into r;
  if r.id is not null then
    select count(*) into n from referrals x where x.referrer_id = r.referrer_id and x.status = 'qualified';
    update referrals set reward_months = case when n = 5 then 6 else 1 end where id = r.id;
  end if;
  return query select x.id, x.referrer_id, x.reward_months, (select count(*)::int from referrals y where y.referrer_id = x.referrer_id and y.status = 'qualified' and y.qualified_at <= x.qualified_at),
    x.reward_applied, x.bonus_applied, x.friend_bonus
    from referrals x where x.referred_id = p_referred and x.status = 'qualified' and (not x.reward_applied or not x.bonus_applied);
end $$;
revoke all on function qualify_referral(uuid, int) from public, anon, authenticated;
grant execute on function qualify_referral(uuid, int) to service_role;
