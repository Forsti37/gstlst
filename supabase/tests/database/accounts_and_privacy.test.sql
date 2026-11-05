-- Sign-up, privacy levels, friends and GDPR functions. Rolled back after each run.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(31);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-b000-000000000001', 'admin@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-b000-000000000002', 'open@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-b000-000000000003', 'friend@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-b000-000000000004', 'secret@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-b000-000000000005', 'newbie@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-b000-000000000006', 'kid@test.invalid', 'authenticated', 'authenticated');

insert into public.profiles (id, username, display_name, birth_year, role, privacy) values
  ('00000000-0000-4000-b000-000000000001', 'test_admin2', 'Admin', 1990, 'admin', '{}'),
  ('00000000-0000-4000-b000-000000000002', 'test_open', 'Open', 1995, 'user', '{"profile":"public","checkins":"public","badges":"private"}'),
  ('00000000-0000-4000-b000-000000000003', 'test_friend', 'Friend', 1995, 'user', '{}'),
  ('00000000-0000-4000-b000-000000000004', 'test_secret', 'Secret', 1995, 'user', '{"profile":"private","checkins":"public"}');

insert into public.friendships (user_a, user_b, status, requested_by) values
  ('00000000-0000-4000-b000-000000000003', '00000000-0000-4000-b000-000000000004', 'accepted', '00000000-0000-4000-b000-000000000003');

insert into public.invite_codes (code, max_uses, used_count, expires_at) values
  ('test-valid', 1, 0, null),
  ('test-used', 1, 1, null),
  ('test-expired', 5, 0, now() - interval '1 day');

insert into public.venues (id, name, city, country_code, status) values
  ('10000000-0000-4000-b000-000000000001', 'Test Venue B', 'Testcity', 'AT', 'approved');
insert into public.events (id, name, date_start, venue_id, status) values
  ('20000000-0000-4000-b000-000000000001', 'Test One', '2025-02-01', '10000000-0000-4000-b000-000000000001', 'approved'),
  ('20000000-0000-4000-b000-000000000002', 'Test Two', '2025-02-02', '10000000-0000-4000-b000-000000000001', 'approved');
insert into public.event_checkins (id, user_id, event_id, visibility, client_uuid) values
  -- Secret follows their settings on one, and overrides them to public on the other.
  ('50000000-0000-4000-b000-000000000001', '00000000-0000-4000-b000-000000000004', '20000000-0000-4000-b000-000000000001', null, gen_random_uuid()),
  ('50000000-0000-4000-b000-000000000002', '00000000-0000-4000-b000-000000000004', '20000000-0000-4000-b000-000000000002', 'public', gen_random_uuid()),
  -- Open follows their settings, which are public.
  ('50000000-0000-4000-b000-000000000003', '00000000-0000-4000-b000-000000000002', '20000000-0000-4000-b000-000000000001', null, gen_random_uuid());

with badge as (
  insert into public.badge_definitions (name, description, category, rule)
  values ('Test Badge', 'Test', 'Test', '{}') returning id
)
insert into public.user_badges (user_id, badge_id)
select '00000000-0000-4000-b000-000000000002', id from badge;

select is(
  public.is_valid_privacy('{"profile":"public","stats":"private"}'), true, 'Valid privacy settings pass'
);
select is(public.is_valid_privacy('{"profile":"everyone"}'), false, 'Unknown privacy levels are rejected');
select is(public.is_valid_privacy('{"salary":"public"}'), false, 'Unknown privacy areas are rejected');

-- Signed in with Google, but without a profile -----------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-b000-000000000005"}', true);

select is((select count(*)::int from public.events where name like 'Test %'), 0, 'Without a profile, approved events stay hidden');
select is((select count(*)::int from public.genres), 0, 'Without a profile, even genres stay hidden');
select is((select count(*)::int from public.search_profiles('test_open')), 0, 'Without a profile, search returns nothing');
select is((select count(*)::int from public.get_profile_by_username('test_open')), 0, 'Without a profile, links resolve to nothing');
select is((select count(*)::int from public.get_own_profile()), 0, 'get_own_profile is empty before sign-up');

select throws_ok(
  $$ select public.complete_signup('nope', 'test_new', 'New', 1995, 'de', true) $$,
  'P0001', 'invalid_invite', 'An unknown invite is rejected'
);
select throws_ok(
  $$ select public.complete_signup('test-used', 'test_new', 'New', 1995, 'de', true) $$,
  'P0001', 'invalid_invite', 'A used-up invite is rejected'
);
select throws_ok(
  $$ select public.complete_signup('test-expired', 'test_new', 'New', 1995, 'de', true) $$,
  'P0001', 'invalid_invite', 'An expired invite is rejected'
);
select throws_ok(
  $$ select public.complete_signup('test-valid', 'test_new', 'New', extract(year from now())::int - 15, 'de', true) $$,
  'P0001', 'too_young', 'Under 16 is stopped'
);
select throws_ok(
  $$ select public.complete_signup('test-valid', 'test_new', 'New', 1995, 'de', false) $$,
  'P0001', 'terms_not_accepted', 'The terms must be accepted'
);
select throws_ok(
  $$ select public.complete_signup('test-valid', 'test_open', 'New', 1995, 'de', true) $$,
  'P0001', 'username_taken', 'Taken usernames are rejected'
);
select throws_ok(
  $$ select public.complete_signup('test-valid', 'Not Valid!', 'New', 1995, 'de', true) $$,
  'P0001', 'invalid_username', 'Invalid usernames are rejected'
);
select lives_ok(
  $$ select public.complete_signup('test-valid', 'test_new', 'New', 1995, 'de', true) $$,
  'A valid invite creates the profile'
);
select is((select username from public.get_own_profile()), 'test_new', 'get_own_profile returns the new profile');
select is((select count(*)::int from public.genres where name = 'Electronic'), 1, 'After sign-up, reference data is readable');
reset role;

select is((select used_count from public.invite_codes where code = 'test-valid'), 1, 'The invite counts as used');

-- Privacy levels, seen by the new user, a stranger to everyone -------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-b000-000000000005"}', true);

select is(
  (select count(*)::int from public.profiles where username = 'test_secret'), 0,
  'A private profile is not listed'
);
select is((select count(*)::int from public.search_profiles('test_secret')), 0, 'A private profile is not searchable');
select is((select count(*)::int from public.get_profile_by_username('test_secret')), 1, 'A private profile can be opened by its link');
select is((select count(*)::int from public.event_checkins where user_id = '00000000-0000-4000-b000-000000000002'), 1, 'A check-in follows public settings');
select is((select count(*)::int from public.event_checkins where user_id = '00000000-0000-4000-b000-000000000004'), 1, 'Of a private profile, only the check-in set to public shows');
select is((select count(*)::int from public.user_badges where user_id = '00000000-0000-4000-b000-000000000002'), 0, 'Badges set to private stay hidden');
select throws_ok($$ update public.profiles set username = 'renamed' where id = (select auth.uid()) $$, '42501', null, 'Usernames are permanent');
select throws_ok($$ select privacy from public.profiles $$, '42501', null, 'Other users'' settings are not readable');
select throws_ok($$ select public.admin_create_invite(1, null) $$, '42501', null, 'Only admins create invites');
reset role;

-- Friends of a private profile see only what is set to public --------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-b000-000000000003"}', true);
select is(
  (select count(*)::int from public.event_checkins where user_id = '00000000-0000-4000-b000-000000000004'), 1,
  'A friend of a private profile also sees only the check-in set to public'
);
reset role;

-- GDPR ---------------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-b000-000000000004"}', true);
select is(
  jsonb_array_length(public.export_my_data() -> 'event_checkins'), 2, 'The export holds the user''s check-ins'
);
select lives_ok($$ select public.delete_own_account() $$, 'A user can delete their account');
reset role;

select * from finish();
rollback;
