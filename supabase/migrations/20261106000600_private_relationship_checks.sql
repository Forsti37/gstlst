-- Policies have to be able to call these, which also makes them callable through the API.
-- Members may only ask about their own relationships, not about who else is friends or has
-- blocked whom. Without a signed-in user (owner, service role), there is nothing to limit.

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select ((select auth.uid()) is null or (select auth.uid()) in (a, b))
    and exists (
      select 1 from public.friendships
      where user_a = least(a, b) and user_b = greatest(a, b) and status = 'accepted'
    );
$$;

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select ((select auth.uid()) is null or (select auth.uid()) in (a, b))
    and exists (
      select 1 from public.blocks
      where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
    );
$$;
