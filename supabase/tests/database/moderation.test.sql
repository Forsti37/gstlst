-- Queues, reports, roles and the audit log. Rolled back after each run.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(43);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-d000-000000000001', 'admin@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-d000-000000000002', 'mod@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-d000-000000000003', 'user@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-d000-000000000004', 'other@test.invalid', 'authenticated', 'authenticated');
insert into public.profiles (id, username, display_name, birth_year, role, privacy) values
  ('00000000-0000-4000-d000-000000000001', 'test_adm', 'Adm', 1990, 'admin', '{}'),
  ('00000000-0000-4000-d000-000000000002', 'test_mod', 'Mod', 1990, 'moderator', '{}'),
  ('00000000-0000-4000-d000-000000000003', 'test_usr', 'Usr', 1995, 'user', '{"profile":"public","photos":"public","checkins":"public"}'),
  ('00000000-0000-4000-d000-000000000004', 'test_oth', 'Oth', 1995, 'user', '{"profile":"public"}');

insert into public.venues (id, name, city, country_code, status, created_by) values
  ('10000000-0000-4000-d000-000000000001', 'Test Pending Hall', 'Testcity', 'AT', 'pending', '00000000-0000-4000-d000-000000000003'),
  ('10000000-0000-4000-d000-000000000002', 'Test Reject Hall', 'Testcity', 'AT', 'pending', '00000000-0000-4000-d000-000000000003'),
  ('10000000-0000-4000-d000-000000000003', 'Test Kept Hall', 'Testcity', 'AT', 'approved', null);
insert into public.events (id, name, date_start, venue_id, status, created_by) values
  ('20000000-0000-4000-d000-000000000001', 'Test Pending Night', '2025-03-01', '10000000-0000-4000-d000-000000000001', 'pending', '00000000-0000-4000-d000-000000000003'),
  ('20000000-0000-4000-d000-000000000002', 'Test Approved Night', '2025-03-02', '10000000-0000-4000-d000-000000000003', 'approved', null);
insert into public.artists (id, name, slug, status, created_by) values
  ('40000000-0000-4000-d000-000000000001', 'Test Newcomer', 'test-newcomer', 'pending', '00000000-0000-4000-d000-000000000003');
insert into public.sets (id, event_id, status, created_by) values
  ('30000000-0000-4000-d000-000000000001', '20000000-0000-4000-d000-000000000002', 'pending', '00000000-0000-4000-d000-000000000003');
insert into public.set_artists (set_id, artist_id) values
  ('30000000-0000-4000-d000-000000000001', '40000000-0000-4000-d000-000000000001');
insert into public.event_checkins (id, user_id, event_id, client_uuid, visibility) values
  ('50000000-0000-4000-d000-000000000001', '00000000-0000-4000-d000-000000000003', '20000000-0000-4000-d000-000000000002', gen_random_uuid(), 'public'),
  ('50000000-0000-4000-d000-000000000002', '00000000-0000-4000-d000-000000000003', '20000000-0000-4000-d000-000000000001', gen_random_uuid(), 'private');
insert into public.media (id, owner_id, event_checkin_id, storage_path, moderation_status) values
  ('60000000-0000-4000-d000-000000000001', '00000000-0000-4000-d000-000000000003', '50000000-0000-4000-d000-000000000001', 'test/m1.webp', 'pending'),
  ('60000000-0000-4000-d000-000000000002', '00000000-0000-4000-d000-000000000003', '50000000-0000-4000-d000-000000000001', 'test/m2.webp', 'approved');
insert into public.change_requests (id, entity_type, entity_id, diff, created_by) values
  ('70000000-0000-4000-d000-000000000001', 'event_timetable', '20000000-0000-4000-d000-000000000002',
   '{"sets":[{"set_id":"30000000-0000-4000-d000-000000000001","start_at":"2025-03-02T23:00:00+01:00","end_at":"2025-03-03T00:30:00+01:00"}]}', '00000000-0000-4000-d000-000000000003'),
  ('70000000-0000-4000-d000-000000000002', 'event_correction', '20000000-0000-4000-d000-000000000002', '{"name":"Test Corrected Night"}', '00000000-0000-4000-d000-000000000003'),
  ('70000000-0000-4000-d000-000000000003', 'event_correction', '20000000-0000-4000-d000-000000000002', '{"lifecycle":"cancelled"}', '00000000-0000-4000-d000-000000000003');

-- A normal user --------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-d000-000000000003"}', true);

select throws_ok($$ select public.moderate_entity('venues', '10000000-0000-4000-d000-000000000001', 'approve') $$, '42501', null, 'Users cannot approve master data');
select throws_ok($$ select public.moderate_media('60000000-0000-4000-d000-000000000001', 'approve') $$, '42501', null, 'Users cannot approve photos');
select throws_ok($$ select public.review_change_request('70000000-0000-4000-d000-000000000001', 'approve') $$, '42501', null, 'Users cannot review requests');
select throws_ok($$ select public.staff_dashboard() $$, '42501', null, 'Users cannot open the dashboard');
select throws_ok($$ select public.staff_verify_checkin('50000000-0000-4000-d000-000000000001', true) $$, '42501', null, 'Users cannot verify check-ins');
select throws_ok($$ select public.set_event_lifecycle('20000000-0000-4000-d000-000000000002', 'cancelled') $$, '42501', null, 'Users cannot cancel events');
select throws_ok($$ select public.admin_set_moderator('00000000-0000-4000-d000-000000000003', true) $$, '42501', null, 'Users cannot give themselves a role');
select throws_ok($$ update public.media set moderation_status = 'approved' $$, '42501', null, 'Photos cannot be approved directly');
select throws_ok(
  $$ insert into public.reports (reporter_id, target_type, target_id, reason) values ((select auth.uid()), 'media', '60000000-0000-4000-d000-000000000001', 'x') $$,
  '42501', null, 'Reports only go through the function'
);
reset role;

-- A moderator ----------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-d000-000000000002"}', true);

select throws_ok(
  $$ select public.moderate_entity('venues', '10000000-0000-4000-d000-000000000002', 'reject', '   ') $$,
  'P0001', 'reason_required', 'A rejection needs a reason'
);
select lives_ok(
  $$ select public.moderate_entity('venues', '10000000-0000-4000-d000-000000000002', 'reject', 'Does not exist') $$,
  'A moderator can reject with a reason'
);
select throws_ok(
  $$ select public.moderate_entity('venues', '10000000-0000-4000-d000-000000000001', 'approve', null, '{"role":"admin"}') $$,
  '22023', null, 'Only whitelisted fields can be edited'
);
select lives_ok(
  $$ select public.moderate_entity('events', '20000000-0000-4000-d000-000000000001', 'approve', null, '{"name":"Test Edited Night"}') $$,
  'A moderator can edit and approve an event'
);
select lives_ok(
  $$ select public.moderate_entity('venues', '10000000-0000-4000-d000-000000000003', 'approve', null, '{"lat":"48.2178","lng":"16.3709","venue_type":"club"}') $$,
  'Coordinates and enum fields can be set before approval'
);
select throws_ok($$ select public.admin_set_moderator('00000000-0000-4000-d000-000000000004', true) $$, '42501', null, 'A moderator cannot assign roles');
reset role;

select is((select name from public.events where id = '20000000-0000-4000-d000-000000000001'), 'Test Edited Night', 'The edit was applied');
select is((select status::text from public.events where id = '20000000-0000-4000-d000-000000000001'), 'approved', 'The event is approved');
select is((select status::text from public.venues where id = '10000000-0000-4000-d000-000000000001'), 'approved', 'Approving an event also approves its venue');
select is((select status::text from public.venues where id = '10000000-0000-4000-d000-000000000002'), 'rejected', 'The rejected venue is rejected');
select is((select lat from public.venues where id = '10000000-0000-4000-d000-000000000003'), 48.2178::double precision, 'Coordinates were saved');
select is(
  (select payload ->> 'reason' from public.notifications where recipient_id = '00000000-0000-4000-d000-000000000003' and payload ->> 'decision' = 'reject'),
  'Does not exist', 'The creator is told why'
);
select is(
  (select count(*)::int from public.admin_audit_log where actor_id = '00000000-0000-4000-d000-000000000002' and action = 'reject'),
  1, 'The rejection is in the audit log'
);
select ok(
  (select count(*) from public.admin_audit_log where actor_id = '00000000-0000-4000-d000-000000000002' and action = 'update' and entity_type = 'events') > 0,
  'The edit itself is in the audit log'
);

-- Sets, requests, photos -----------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-d000-000000000002"}', true);

select lives_ok($$ select public.moderate_entity('sets', '30000000-0000-4000-d000-000000000001', 'approve') $$, 'A set can be approved');
select is((select status::text from public.artists where id = '40000000-0000-4000-d000-000000000001'), 'approved', 'Approving a set also approves its new artist');

select lives_ok($$ select public.review_change_request('70000000-0000-4000-d000-000000000001', 'approve') $$, 'A timetable can be approved');
select is(
  (select start_at from public.sets where id = '30000000-0000-4000-d000-000000000001'),
  '2025-03-02 23:00:00+01'::timestamptz, 'The timetable was applied'
);
select throws_ok($$ select public.review_change_request('70000000-0000-4000-d000-000000000001', 'approve') $$, 'P0001', 'already_reviewed', 'A request is reviewed only once');
select lives_ok($$ select public.review_change_request('70000000-0000-4000-d000-000000000002', 'approve') $$, 'A correction can be approved');
select throws_ok($$ select public.review_change_request('70000000-0000-4000-d000-000000000003', 'approve') $$, '22023', null, 'A correction cannot touch fields outside the whitelist');

select lives_ok($$ select public.moderate_media('60000000-0000-4000-d000-000000000001', 'approve') $$, 'A photo can be approved');

select is((select count(*)::int from public.staff_list_checkins('test_usr')), 1, 'Manual verification lists only non-private check-ins');
select lives_ok($$ select public.staff_verify_checkin('50000000-0000-4000-d000-000000000001', true) $$, 'A check-in can be verified by hand');
select ok((public.staff_dashboard() -> 'queues' ->> 'requests')::int >= 1, 'The dashboard counts open requests');
reset role;

-- Reports --------------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-d000-000000000004"}', true);
select lives_ok($$ select public.report_content('media', '60000000-0000-4000-d000-000000000002', 'Not okay') $$, 'A photo can be reported');
select is((select count(*)::int from public.media where id = '60000000-0000-4000-d000-000000000002'), 0, 'A reported photo is hidden until reviewed');
select lives_ok($$ select public.report_content('profile', '00000000-0000-4000-d000-000000000003', 'Not okay') $$, 'A profile can be reported');
select is((select count(*)::int from public.get_profile_by_username('test_usr')), 0, 'A reported profile is hidden until reviewed');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-d000-000000000001"}', true);
select lives_ok(
  $$ select public.resolve_report((select id from public.reports where target_type = 'media' and resolved_at is null), 'dismiss') $$,
  'A report can be dismissed'
);
select is((select moderation_status::text from public.media where id = '60000000-0000-4000-d000-000000000002'), 'approved', 'A dismissed report restores the photo');
select lives_ok(
  $$ select public.resolve_report((select id from public.reports where target_type = 'profile' and resolved_at is null), 'dismiss') $$,
  'A profile report can be dismissed'
);
select lives_ok($$ select public.admin_set_moderator('00000000-0000-4000-d000-000000000004', true) $$, 'The admin can assign a moderator');
select throws_ok($$ select public.admin_set_moderator('00000000-0000-4000-d000-000000000001', false) $$, 'P0001', 'not_changeable', 'The admin role cannot be changed this way');
reset role;

select * from finish();
rollback;
