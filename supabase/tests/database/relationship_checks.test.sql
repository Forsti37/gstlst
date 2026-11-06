-- Members can't probe other people's friendships or blocks. Rolled back after each run.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-e000-000000000001', 'a@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-e000-000000000002', 'b@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-e000-000000000003', 'c@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-e000-000000000004', 'd@test.invalid', 'authenticated', 'authenticated');
insert into public.profiles (id, username, display_name, birth_year) values
  ('00000000-0000-4000-e000-000000000001', 'test_rel_a', 'A', 1995),
  ('00000000-0000-4000-e000-000000000002', 'test_rel_b', 'B', 1995),
  ('00000000-0000-4000-e000-000000000003', 'test_rel_c', 'C', 1995),
  ('00000000-0000-4000-e000-000000000004', 'test_rel_d', 'D', 1995);
insert into public.friendships (user_a, user_b, status, requested_by) values
  ('00000000-0000-4000-e000-000000000001', '00000000-0000-4000-e000-000000000002', 'accepted', '00000000-0000-4000-e000-000000000001');
insert into public.blocks (blocker_id, blocked_id) values
  ('00000000-0000-4000-e000-000000000003', '00000000-0000-4000-e000-000000000004');

set local role authenticated;

-- A bystander learns nothing.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-e000-000000000003"}', true);
select is(public.are_friends('00000000-0000-4000-e000-000000000001', '00000000-0000-4000-e000-000000000002'), false, 'A bystander cannot see a friendship');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-e000-000000000001"}', true);
select is(public.is_blocked_between('00000000-0000-4000-e000-000000000003', '00000000-0000-4000-e000-000000000004'), false, 'A bystander cannot see a block');

-- Those involved do.
select is(public.are_friends('00000000-0000-4000-e000-000000000001', '00000000-0000-4000-e000-000000000002'), true, 'A friend sees their own friendship');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-e000-000000000004"}', true);
select is(public.is_blocked_between('00000000-0000-4000-e000-000000000003', '00000000-0000-4000-e000-000000000004'), true, 'A blocked user sees their own block');

-- Policies keep working for the people involved.
select is((select count(*)::int from public.profiles where username = 'test_rel_c'), 0, 'A blocked user does not see the blocker');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-e000-000000000003"}', true);
select is((select count(*)::int from public.profiles where username = 'test_rel_d'), 0, 'A blocker does not see the blocked user');
select is((select count(*)::int from public.profiles where username = 'test_rel_a'), 1, 'Strangers stay visible');
reset role;

-- Without a signed-in user, as with the service role, the check still works.
select set_config('request.jwt.claims', '', true);
select is(public.are_friends('00000000-0000-4000-e000-000000000001', '00000000-0000-4000-e000-000000000002'), true, 'The owner can still check');

select * from finish();
rollback;
