-- An upsert through the API would ask for update rights on every column, including the target.
-- This changes only the kind, and runs with the caller's rights, so that RLS still applies.
create function public.set_reaction(target public.reaction_target, target_id uuid, kind public.reaction_kind)
returns void
language sql
set search_path = ''
as $$
  insert into public.reactions (user_id, target_type, target_id, kind)
  values ((select auth.uid()), target, set_reaction.target_id, set_reaction.kind)
  on conflict (user_id, target_type, target_id) do update set kind = excluded.kind;
$$;

revoke execute on function public.set_reaction(public.reaction_target, uuid, public.reaction_kind) from public, anon;
grant execute on function public.set_reaction(public.reaction_target, uuid, public.reaction_kind) to authenticated, service_role;
