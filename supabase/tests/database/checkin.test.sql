-- GPS verification and the write paths of the offline queue. Rolled back after each run.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(25);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-c000-000000000001', 'raver@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-c000-000000000002', 'other@test.invalid', 'authenticated', 'authenticated');
insert into public.profiles (id, username, display_name, birth_year) values
  ('00000000-0000-4000-c000-000000000001', 'test_raver', 'Raver', 1995),
  ('00000000-0000-4000-c000-000000000002', 'test_other', 'Other', 1995);

insert into public.venues (id, name, city, country_code, lat, lng, status) values
  ('10000000-0000-4000-c000-000000000001', 'Test GPS Venue', 'Testcity', 'AT', 48.2178, 16.3709, 'approved');
insert into public.events (id, name, date_start, venue_id, status) values
  ('20000000-0000-4000-c000-000000000001', 'Test GPS Event', '2025-06-07', '10000000-0000-4000-c000-000000000001', 'approved');
insert into public.sets (id, event_id, status) values
  ('30000000-0000-4000-c000-000000000001', '20000000-0000-4000-c000-000000000001', 'approved');
insert into public.artists (id, name, slug, status) values
  ('40000000-0000-4000-c000-000000000001', 'Testartist Taken', 'testartist-taken', 'pending');

select ok(public.distance_meters(48.2178, 16.3709, 48.2178, 16.3709) < 1, 'Distance to the same point is zero');
select ok(public.distance_meters(48.2178, 16.3709, 48.2198, 16.3709) between 200 and 250, 'Distance is right for a short hop');
select ok(public.distance_meters(48.2082, 16.3738, 48.2998, 14.2869) between 150000 and 160000, 'Distance is right for Wien to Linz');
select is(
  public.event_live_until('20000000-0000-4000-c000-000000000001'),
  '2025-06-08 18:00:00+02'::timestamptz,
  'Without a timetable, a check-in is live until the evening after the night'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-c000-000000000001"}', true);

-- The offline queue writes with client ids and ON CONFLICT DO NOTHING, and repeats after errors.
select lives_ok(
  $$ insert into public.event_checkins (id, user_id, event_id, client_uuid)
     values ('50000000-0000-4000-c000-000000000001', '00000000-0000-4000-c000-000000000001', '20000000-0000-4000-c000-000000000001', '50000000-0000-4000-c000-0000000000a1')
     on conflict (id) do nothing $$,
  'A check-in with a client id can be written'
);
select lives_ok(
  $$ insert into public.event_checkins (id, user_id, event_id, client_uuid)
     values ('50000000-0000-4000-c000-000000000001', '00000000-0000-4000-c000-000000000001', '20000000-0000-4000-c000-000000000001', '50000000-0000-4000-c000-0000000000a1')
     on conflict (id) do nothing $$,
  'Sending the same check-in again does nothing'
);
select lives_ok(
  $$ insert into public.set_checkins (id, event_checkin_id, set_id, rating)
     values ('60000000-0000-4000-c000-000000000001', '50000000-0000-4000-c000-000000000001', '30000000-0000-4000-c000-000000000001', 4.5)
     on conflict (id) do nothing $$,
  'A rated set check-in can be written'
);
select lives_ok(
  $$ insert into public.set_checkins (id, event_checkin_id, set_id, rating)
     values ('60000000-0000-4000-c000-000000000001', '50000000-0000-4000-c000-000000000001', '30000000-0000-4000-c000-000000000001', 4.5)
     on conflict (id) do nothing $$,
  'Sending the same set check-in again does nothing'
);

-- A new set with a pending artist on someone else's approved event.
select lives_ok(
  $$ insert into public.artists (id, name, slug, created_by)
     values ('40000000-0000-4000-c000-000000000002', 'Testartist Fresh', 'testartist-fresh', '00000000-0000-4000-c000-000000000001') $$,
  'A new artist can be created as pending'
);
select lives_ok(
  $$ insert into public.sets (id, event_id, created_by)
     values ('30000000-0000-4000-c000-000000000002', '20000000-0000-4000-c000-000000000001', '00000000-0000-4000-c000-000000000001') $$,
  'A lineup addition can be created as pending'
);
select lives_ok(
  $$ insert into public.set_artists (set_id, artist_id)
     values ('30000000-0000-4000-c000-000000000002', '40000000-0000-4000-c000-000000000002') $$,
  'The creator can link artists to the pending set'
);
select lives_ok(
  $$ insert into public.set_checkins (id, event_checkin_id, set_id, rating)
     values ('60000000-0000-4000-c000-000000000002', '50000000-0000-4000-c000-000000000001', '30000000-0000-4000-c000-000000000002', 3) $$,
  'The creator can check in to their pending set right away'
);
select lives_ok(
  $$ insert into public.artists (id, name, slug, created_by)
     values ('40000000-0000-4000-c000-000000000003', 'Testartist Taken', 'testartist-taken', '00000000-0000-4000-c000-000000000001') $$,
  'A slug taken by a hidden row does not block a new artist'
);
select isnt((select slug from public.artists where id = '40000000-0000-4000-c000-000000000003'), 'testartist-taken', 'The new artist gets a suffix');

select is((select count(*)::int from public.search_events('Test GPS Event') where venue_name = 'Test GPS Venue'), 1, 'search_events returns the venue');
select is((select average from public.event_set_ratings('20000000-0000-4000-c000-000000000001') where set_id = '30000000-0000-4000-c000-000000000001'), 4.5, 'Set averages are computed');

-- GPS ----------------------------------------------------------------------------------

select is(
  public.verify_checkin_gps('50000000-0000-4000-c000-000000000001', 48.30, 14.29, '2025-06-07 23:00:00+02'), false,
  'Too far away is not verified'
);
select is(
  public.verify_checkin_gps('50000000-0000-4000-c000-000000000001', 48.2178, 16.3709, '2025-06-06 23:00:00+02'), false,
  'Before the event day is not verified'
);
select is(
  public.verify_checkin_gps('50000000-0000-4000-c000-000000000001', 48.2178, 16.3709, '2025-06-08 19:00:00+02'), false,
  'After the live window is not verified'
);
select is(
  public.verify_checkin_gps('50000000-0000-4000-c000-000000000001', 48.2178, 16.3709, now() + interval '1 day'), false,
  'A capture time in the future is not verified'
);
select is(
  (select verified_gps from public.event_checkins where id = '50000000-0000-4000-c000-000000000001'), false,
  'Failed attempts leave the check-in unverified'
);
select is(
  public.verify_checkin_gps('50000000-0000-4000-c000-000000000001', 48.2180, 16.3712, '2025-06-08 02:30:00+02'), true,
  'Near the venue at 2:30 in the night is verified'
);
select lives_ok(
  $$ update public.event_checkins set rating = 4 where id = '50000000-0000-4000-c000-000000000001' $$,
  'A verified check-in can be edited'
);
select is(
  public.verify_checkin_gps('50000000-0000-4000-c000-000000000001', 48.30, 14.29, '2025-06-08 02:30:00+02'), true,
  'Verification survives edits and later failed attempts'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-c000-000000000002"}', true);
select throws_ok(
  $$ select public.verify_checkin_gps('50000000-0000-4000-c000-000000000001', 48.2178, 16.3709, '2025-06-08 02:30:00+02') $$,
  '42501', 'checkin_not_found', 'Nobody can verify someone else''s check-in'
);
reset role;

select * from finish();
rollback;
