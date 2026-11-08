-- Artist, venue and promoter pages. Rolled back after each run.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(14);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-a800-000000000001', 'me@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a800-000000000002', 'friend@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a800-000000000003', 'stranger@test.invalid', 'authenticated', 'authenticated');
insert into public.profiles (id, username, display_name, birth_year, privacy) values
  ('00000000-0000-4000-a800-000000000001', 'test_ep_me', 'Me', 1995, '{"profile":"friends"}'),
  ('00000000-0000-4000-a800-000000000002', 'test_ep_friend', 'Friend', 1995, '{"profile":"friends"}'),
  ('00000000-0000-4000-a800-000000000003', 'test_ep_stranger', 'Stranger', 1995, '{"profile":"public","checkins":"public"}');
insert into public.friendships (user_a, user_b, status, requested_by) values
  ('00000000-0000-4000-a800-000000000001', '00000000-0000-4000-a800-000000000002', 'accepted', '00000000-0000-4000-a800-000000000001');

insert into public.venues (id, name, city, country_code, status) values
  ('00000000-0000-4000-a810-000000000001', 'EP Club', 'EP City', 'AT', 'approved');
insert into public.promoters (id, name, slug, status) values
  ('00000000-0000-4000-a820-000000000001', 'EP Crew', 'ep-crew', 'approved');
insert into public.event_series (id, name, slug, status) values
  ('00000000-0000-4000-a825-000000000001', 'EP Nights', 'ep-nights', 'approved');
insert into public.events (id, series_id, name, date_start, venue_id, status) values
  ('00000000-0000-4000-a830-000000000001', '00000000-0000-4000-a825-000000000001', 'EP Past', '2024-05-04', '00000000-0000-4000-a810-000000000001', 'approved'),
  ('00000000-0000-4000-a830-000000000002', '00000000-0000-4000-a825-000000000001', 'EP Later', '2025-05-03', '00000000-0000-4000-a810-000000000001', 'approved'),
  ('00000000-0000-4000-a830-000000000003', null, 'EP Soon', current_date + 20, '00000000-0000-4000-a810-000000000001', 'approved');
insert into public.event_promoters (event_id, promoter_id) values
  ('00000000-0000-4000-a830-000000000001', '00000000-0000-4000-a820-000000000001'),
  ('00000000-0000-4000-a830-000000000002', '00000000-0000-4000-a820-000000000001'),
  ('00000000-0000-4000-a830-000000000003', '00000000-0000-4000-a820-000000000001');
insert into public.artists (id, name, slug, kind, status) values
  ('00000000-0000-4000-a840-000000000001', 'EP Duo', 'ep-duo', 'group', 'approved'),
  ('00000000-0000-4000-a840-000000000002', 'EP Member', 'ep-member', 'person', 'approved');
insert into public.artist_members (group_id, member_id) values
  ('00000000-0000-4000-a840-000000000001', '00000000-0000-4000-a840-000000000002');
insert into public.sets (id, event_id, status) values
  ('00000000-0000-4000-a850-000000000001', '00000000-0000-4000-a830-000000000001', 'approved'),
  ('00000000-0000-4000-a850-000000000002', '00000000-0000-4000-a830-000000000002', 'approved'),
  ('00000000-0000-4000-a850-000000000003', '00000000-0000-4000-a830-000000000003', 'approved');
insert into public.set_artists (set_id, artist_id) values
  ('00000000-0000-4000-a850-000000000001', '00000000-0000-4000-a840-000000000001'),
  ('00000000-0000-4000-a850-000000000002', '00000000-0000-4000-a840-000000000002'),
  ('00000000-0000-4000-a850-000000000003', '00000000-0000-4000-a840-000000000002');
insert into public.event_checkins (id, user_id, event_id, client_uuid, visibility, rating) values
  ('00000000-0000-4000-a860-000000000001', '00000000-0000-4000-a800-000000000001', '00000000-0000-4000-a830-000000000001', gen_random_uuid(), null, 4),
  ('00000000-0000-4000-a860-000000000002', '00000000-0000-4000-a800-000000000001', '00000000-0000-4000-a830-000000000002', gen_random_uuid(), null, 5),
  ('00000000-0000-4000-a860-000000000003', '00000000-0000-4000-a800-000000000002', '00000000-0000-4000-a830-000000000001', gen_random_uuid(), null, null),
  ('00000000-0000-4000-a860-000000000004', '00000000-0000-4000-a800-000000000003', '00000000-0000-4000-a830-000000000002', gen_random_uuid(), null, null),
  ('00000000-0000-4000-a860-000000000005', '00000000-0000-4000-a800-000000000002', '00000000-0000-4000-a830-000000000002', gen_random_uuid(), 'private', null);
insert into public.set_checkins (event_checkin_id, set_id, rating) values
  ('00000000-0000-4000-a860-000000000001', '00000000-0000-4000-a850-000000000001', 3),
  ('00000000-0000-4000-a860-000000000002', '00000000-0000-4000-a850-000000000002', 5),
  ('00000000-0000-4000-a860-000000000003', '00000000-0000-4000-a850-000000000001', 4),
  ('00000000-0000-4000-a860-000000000004', '00000000-0000-4000-a850-000000000002', 2),
  ('00000000-0000-4000-a860-000000000005', '00000000-0000-4000-a850-000000000002', 2);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a800-000000000001"}', true);

-- Your own numbers ----------------------------------------------------------------------
select is((public.get_entity_personal('artist', '00000000-0000-4000-a840-000000000002') ->> 'count')::int, 2, 'A member counts the group set too');
select is(public.get_entity_personal('artist', '00000000-0000-4000-a840-000000000002') -> 'last' ->> 'name', 'EP Later', 'The last time you saw them');
select is((public.get_entity_personal('venue', '00000000-0000-4000-a810-000000000001') ->> 'count')::int, 2, 'Your visits to a venue');
select is((public.get_entity_personal('promoter', '00000000-0000-4000-a820-000000000001') ->> 'avg_rating')::numeric, 4.5, 'Your rating of a promoter''s events');
select is(public.get_entity_personal('venue', '00000000-0000-4000-a810-000000000001') -> 'friends' -> 0 ->> 'username', 'test_ep_friend', 'Friends who were there');
select is((public.get_entity_personal('venue', '00000000-0000-4000-a810-000000000001') -> 'friends' -> 0 ->> 'times')::int, 1, 'A friend''s private check-in stays out');

-- Check-ins on a page -------------------------------------------------------------------
select is(jsonb_array_length(public.get_entity_checkins('venue', '00000000-0000-4000-a810-000000000001')), 4, 'A venue page lists every check-in you may see');
select ok(public.get_entity_checkins('venue', '00000000-0000-4000-a810-000000000001')::text not like '%a860-000000000005%', 'Private check-ins stay out');
select is(jsonb_array_length(public.get_entity_checkins('artist', '00000000-0000-4000-a840-000000000002')), 4, 'An artist page includes their group''s sets');
select is(jsonb_array_length(public.get_entity_checkins('venue', '00000000-0000-4000-a810-000000000001', null, 2)), 2, 'Pages of check-ins have a size');

-- Upcoming and promoter numbers ---------------------------------------------------------
select is((select name from public.get_entity_upcoming('artist', '00000000-0000-4000-a840-000000000002')), 'EP Soon', 'Upcoming gigs of an artist');
select is((select count(*)::int from public.get_entity_upcoming('venue', '00000000-0000-4000-a810-000000000001')), 1, 'Past events are not upcoming');
select is(public.get_promoter_stats('00000000-0000-4000-a820-000000000001') -> 'series' -> 0 ->> 'editions', '2', 'A promoter''s series with its editions');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a800-000000000003"}', true);
select is(jsonb_array_length(public.get_entity_personal('venue', '00000000-0000-4000-a810-000000000001') -> 'friends'), 0, 'A stranger sees no friends of yours');

select * from finish();
rollback;
