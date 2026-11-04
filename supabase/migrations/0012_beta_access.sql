-- The AI episode studio (concepts → storyboard → render) is in beta: only invited accounts may use it.
-- The Prompt Studio and the distribution features stay open to everyone.
alter table profiles add column if not exists beta_access boolean not null default false;
-- Customers can only update display_name (0001 grants that single column), so they cannot grant themselves beta.

create or replace function has_beta(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select beta_access from profiles where id = p_user), false)
$$;

-- Database-level gate: creating an episode requires beta access (restrictive = ANDed with the owner policy).
drop policy if exists "stories need beta" on stories;
create policy "stories need beta" on stories as restrictive for insert to authenticated
  with check (has_beta(auth.uid()));
