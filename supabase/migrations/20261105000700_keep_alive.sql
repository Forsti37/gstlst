-- Touches the database for the keep-alive workflow, which only has the publishable key.
-- All tables are closed to anon, and this returns no data.
create function public.keep_alive()
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from pg_catalog.pg_class limit 1);
$$;

revoke execute on function public.keep_alive() from public;
grant execute on function public.keep_alive() to anon, service_role;
