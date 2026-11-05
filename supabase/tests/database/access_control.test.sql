-- RLS, column grants and admin functions. Everything runs in a transaction and is rolled back.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(38);

-- Fixtures: alice and bob are friends, carol has blocked alice, dave is a stranger.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-a000-000000000001', 'admin@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-000000000002', 'alice@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-000000000003', 'bob@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-000000000004', 'carol@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-000000000005', 'dave@test.invalid', 'authenticated', 'authenticated');

insert into public.profiles (id, username, display_name, birth_year, role) values
  ('00000000-0000-4000-a000-000000000001', 'test_admin', 'Admin', 1990, 'admin'),
  ('00000000-0000-4000-a000-000000000002', 'test_alice', 'Alice', 1995, 'user'),
  ('00000000-0000-4000-a000-000000000003', 'test_bob', 'Bob', 1995, 'user'),
  ('00000000-0000-4000-a000-000000000004', 'test_carol', 'Carol', 1995, 'user'),
  ('00000000-0000-4000-a000-000000000005', 'test_dave', 'Dave', 1995, 'user');

insert into public.friendships (user_a, user_b, status, requested_by) values
  ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000003', 'accepted', '00000000-0000-4000-a000-000000000002');
insert into public.blocks (blocker_id, blocked_id) values
  ('00000000-0000-4000-a000-000000000004', '00000000-0000-4000-a000-000000000002');

insert into public.venues (id, name, city, country_code, status, created_by) values
  ('10000000-0000-4000-a000-000000000001', 'Test Approved Venue', 'Testcity', 'AT', 'approved', '00000000-0000-4000-a000-000000000001'),
  ('10000000-0000-4000-a000-000000000002', 'Test Pending Venue', 'Testcity', 'AT', 'pending', '00000000-0000-4000-a000-000000000002');

insert into public.events (id, name, date_start, venue_id, status, lifecycle, created_by) values
  ('20000000-0000-4000-a000-000000000001', 'Test Event', '2025-01-01', '10000000-0000-4000-a000-000000000001', 'approved', 'scheduled', '00000000-0000-4000-a000-000000000001'),
  ('20000000-0000-4000-a000-000000000002', 'Test Cancelled', '2025-01-02', '10000000-0000-4000-a000-000000000001', 'approved', 'cancelled', '00000000-0000-4000-a000-000000000001'),
  ('20000000-0000-4000-a000-000000000003', 'Test Second', '2025-01-03', '10000000-0000-4000-a000-000000000001', 'approved', 'scheduled', '00000000-0000-4000-a000-000000000001'),
  ('20000000-0000-4000-a000-000000000004', 'Test Third', '2025-01-04', '10000000-0000-4000-a000-000000000001', 'approved', 'scheduled', '00000000-0000-4000-a000-000000000001');

insert into public.sets (id, event_id, status) values
  ('30000000-0000-4000-a000-000000000001', '20000000-0000-4000-a000-000000000001', 'approved'),
  ('30000000-0000-4000-a000-000000000002', '20000000-0000-4000-a000-000000000002', 'approved');

insert into public.artists (id, name, slug, status) values
  ('40000000-0000-4000-a000-000000000001', 'Testartist Kept', 'test-kept', 'approved'),
  ('40000000-0000-4000-a000-000000000002', 'Testartist Dupe', 'test-dupe', 'approved'),
  ('40000000-0000-4000-a000-000000000003', 'Testartist Hidden', 'test-hidden', 'pending');
insert into public.set_artists (set_id, artist_id) values
  ('30000000-0000-4000-a000-000000000001', '40000000-0000-4000-a000-000000000002');

-- Alice's check-ins: one per visibility.
insert into public.event_checkins (id, user_id, event_id, visibility, client_uuid) values
  ('50000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000002', '20000000-0000-4000-a000-000000000001', 'public', gen_random_uuid()),
  ('50000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000002', '20000000-0000-4000-a000-000000000003', 'friends', gen_random_uuid()),
  ('50000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000002', '20000000-0000-4000-a000-000000000004', 'private', gen_random_uuid());

insert into public.private_checkin_data (event_checkin_id, ticket_price) values
  ('50000000-0000-4000-a000-000000000001', 25);

insert into public.media (id, owner_id, event_checkin_id, storage_path, moderation_status) values
  ('60000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000002', '50000000-0000-4000-a000-000000000001', 'test/pending.webp', 'pending'),
  ('60000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000002', '50000000-0000-4000-a000-000000000001', 'test/approved.webp', 'approved');

-- Normalization and constraints, as the table owner ------------------------------------

select is(public.normalize_name('A.M.C.'), 'amc', 'normalize_name removes punctuation');
select is(public.normalize_name('Camo & Krooked'), 'camo and krooked', 'normalize_name unifies "&"');
select is(public.normalize_name('Brückenträume'), 'bruckentraume', 'normalize_name removes accents');

select throws_ok(
  $$ insert into public.profiles (id, username, display_name, birth_year) values ('00000000-0000-4000-a000-000000000005', 'too_young', 'Kid', extract(year from now())::int - 10) $$,
  '23514', null, 'Under 16 is rejected'
);
select throws_ok(
  $$ insert into public.set_checkins (event_checkin_id, set_id) values ('50000000-0000-4000-a000-000000000001', '30000000-0000-4000-a000-000000000001') $$,
  '23514', null, 'A set check-in needs a rating unless it was imported'
);
select lives_ok(
  $$ insert into public.set_checkins (event_checkin_id, set_id, imported) values ('50000000-0000-4000-a000-000000000002', '30000000-0000-4000-a000-000000000001', true) $$,
  'An imported set check-in may have no rating'
);
select throws_ok(
  $$ update public.event_checkins set rating = 3.3 where id = '50000000-0000-4000-a000-000000000001' $$,
  '23514', null, 'Ratings only come in 0.5 steps'
);

-- Anonymous users get nothing ----------------------------------------------------------

set local role anon;
select throws_ok($$ select * from public.events $$, '42501', null, 'anon cannot read events');
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anon cannot read profiles');
reset role;

-- Bob: friend of Alice -----------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000003"}', true);

select is((select count(*)::int from public.venues where name like 'Test %'), 1, 'Bob sees the approved venue only');
select is((select count(*)::int from public.artists where slug = 'test-hidden'), 0, 'Bob does not see a pending artist');
select is((select count(*)::int from public.search_entities('artist', 'Testartist Hidden') where name = 'Testartist Hidden'), 0, 'Search hides pending artists of others');
select is((select count(*)::int from public.search_entities('artist', 'Testartist Kept') where name = 'Testartist Kept'), 1, 'Search finds approved artists');
select is((select count(*)::int from public.events where name = 'Test Cancelled'), 0, 'Cancelled events are hidden');
select is((select count(*)::int from public.sets where id = '30000000-0000-4000-a000-000000000002'), 0, 'Sets of cancelled events are hidden');
select is(
  (select count(*)::int from public.event_checkins where user_id = '00000000-0000-4000-a000-000000000002'),
  2, 'A friend sees public and friends check-ins, not private ones'
);
select is((select count(*)::int from public.private_checkin_data), 0, 'A friend cannot read private spending');
select is((select count(*)::int from public.media where storage_path like 'test/%'), 1, 'Others only see approved photos');
select throws_ok($$ select birth_year from public.profiles $$, '42501', null, 'Birth years are not readable');

select throws_ok(
  $$ insert into public.venues (name, city, country_code, status, created_by) values ('Test Sneaky', 'Testcity', 'AT', 'approved', '00000000-0000-4000-a000-000000000003') $$,
  '42501', null, 'Users cannot create approved master data'
);
select lives_ok(
  $$ insert into public.venues (name, city, country_code, created_by) values ('Test Bob Venue', 'Testcity', 'AT', '00000000-0000-4000-a000-000000000003') $$,
  'Users can create pending master data'
);
select throws_ok($$ update public.profiles set role = 'admin' $$, '42501', null, 'Users cannot change their role');
select throws_ok(
  $$ update public.event_checkins set verified_gps = true $$,
  '42501', null, 'Users cannot verify check-ins themselves'
);
select throws_ok(
  $$ insert into public.set_checkins (event_checkin_id, set_id, rating, imported) values ('50000000-0000-4000-a000-000000000001', '30000000-0000-4000-a000-000000000001', 3, true) $$,
  '42501', null, 'Users cannot mark set check-ins as imported'
);
select throws_ok(
  $$ select public.merge_artist('40000000-0000-4000-a000-000000000002', '40000000-0000-4000-a000-000000000001') $$,
  '42501', null, 'Merging is admin only'
);
reset role;

-- Dave: stranger -----------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000005"}', true);
select is(
  (select count(*)::int from public.event_checkins where user_id = '00000000-0000-4000-a000-000000000002'),
  1, 'A stranger sees only public check-ins'
);
reset role;

-- Carol: blocked Alice, and is hidden from her -----------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000004"}', true);
select is((select count(*)::int from public.event_checkins where user_id = '00000000-0000-4000-a000-000000000002'), 0, 'A blocker does not see the blocked user''s check-ins');
select is((select count(*)::int from public.profiles where username = 'test_alice'), 0, 'A blocker does not see the blocked profile');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000002"}', true);
select is((select count(*)::int from public.profiles where username = 'test_carol'), 0, 'A blocked user does not see the blocker');
select is((select count(*)::int from public.private_checkin_data), 1, 'The owner reads their private spending');
select is((select count(*)::int from public.media where storage_path like 'test/%'), 2, 'The owner sees their pending photo');
select is((select count(*)::int from public.venues where name = 'Test Pending Venue'), 1, 'The creator sees their pending venue');
reset role;

-- A block ends a friendship.
insert into public.blocks (blocker_id, blocked_id) values
  ('00000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000002');
select is(public.are_friends('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000003'), false, 'A block ends the friendship');
delete from public.blocks where blocker_id = '00000000-0000-4000-a000-000000000003';

-- Admin --------------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000001"}', true);
select is((select count(*)::int from public.private_checkin_data), 0, 'Even an admin cannot read private spending');
select is((select count(*)::int from public.events where name = 'Test Cancelled'), 1, 'Staff see cancelled events');
select is((select count(*)::int from public.artists where slug = 'test-hidden'), 1, 'Staff see pending artists');
select lives_ok(
  $$ select public.merge_artist('40000000-0000-4000-a000-000000000002', '40000000-0000-4000-a000-000000000001') $$,
  'An admin can merge artists'
);
select is(
  (select artist_id from public.set_artists where set_id = '30000000-0000-4000-a000-000000000001'),
  '40000000-0000-4000-a000-000000000001'::uuid, 'The merge re-points sets to the kept artist'
);
reset role;

select * from finish();
rollback;
