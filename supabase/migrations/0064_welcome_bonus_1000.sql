-- Welcome bonus lowered from 3,000 to 1,000 credits (stories are free; the trial sets the balance to 3,500, never additive).
create or replace function public.grant_welcome_bonus(p_user uuid, p_email text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  k text := email_key(p_email);
  bal integer;
begin
  update profiles set email_key = k where id = p_user and email_key is distinct from k;
  if p_email is null or is_disposable_email(p_email) then return; end if;
  if exists (select 1 from profiles where id = p_user and welcome_granted) then return; end if;
  if exists (select 1 from profiles where email_key = k and welcome_granted and id <> p_user) then return; end if;
  update profiles set credit_balance = credit_balance + 1000, welcome_granted = true where id = p_user and not welcome_granted
    returning credit_balance into bal;
  if bal is null then return; end if;
  insert into credit_transactions (user_id, type, amount, balance_after, description)
  values (p_user, 'bonus', 1000, bal, 'Welcome bonus — free Story Credits');
end $function$;
