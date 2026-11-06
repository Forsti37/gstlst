-- Stats, explorer, leaderboards and their privacy. Rolled back after each run.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(47);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-d000-000000000001', 'me@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-d000-000000000002', 'friend@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-d000-000000000003', 'stranger@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-d000-000000000004', 'private@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-d000-000000000005', 'fan@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-d000-000000000006', 'nomember@test.invalid', 'authenticated', 'authenticated');
insert into public.profiles (id, username, display_name, birth_year, home_city, privacy) values
  ('00000000-0000-4000-d000-000000000001', 'test_st_me', 'Me', 1995, 'Testwien', '{"profile":"public","stats":"friends","map":"private"}'),
  ('00000000-0000-4000-d000-000000000002', 'test_st_friend', 'Friend', 1995, null, '{"profile":"friends","stats":"friends"}'),
  ('00000000-0000-4000-d000-000000000003', 'test_st_stranger', 'Stranger', 1995, null, '{"profile":"friends"}'),
  ('00000000-0000-4000-d000-000000000004', 'test_st_private', 'Private', 1995, null, '{"profile":"private","stats":"public"}'),
  ('00000000-0000-4000-d000-000000000005', 'test_st_fan', 'Fan', 1995, null, '{"profile":"public","stats":"public"}');
insert into public.friendships (user_a, user_b, status, requested_by) values
  ('00000000-0000-4000-d000-000000000001', '00000000-0000-4000-d000-000000000002', 'accepted', '00000000-0000-4000-d000-000000000001');

insert into public.venues (id, name, city, country_code, lat, lng, status, created_by) values
  ('00000000-0000-4000-d100-000000000001', 'Test Club', 'Testwien', 'AT', 48.2, 16.4, 'approved', null),
  ('00000000-0000-4000-d100-000000000002', 'Far Club', 'Testlinz', 'AT', 48.3, 14.3, 'approved', null),
  ('00000000-0000-4000-d100-000000000003', 'Secret Pending Club', 'Testgraz', 'AT', 47.1, 15.4, 'pending', '00000000-0000-4000-d000-000000000001');
insert into public.events (id, name, date_start, venue_id, status) values
  -- A Saturday and the Saturday after it.
  ('00000000-0000-4000-d200-000000000001', 'Test Event One', '2024-03-02', '00000000-0000-4000-d100-000000000001', 'approved'),
  ('00000000-0000-4000-d200-000000000002', 'Test Event Two', '2024-03-09', '00000000-0000-4000-d100-000000000002', 'approved'),
  ('00000000-0000-4000-d200-000000000003', 'Test Event Hidden', '2023-05-05', '00000000-0000-4000-d100-000000000002', 'approved'),
  ('00000000-0000-4000-d200-000000000004', 'Test Event Pending', '2023-06-06', '00000000-0000-4000-d100-000000000003', 'pending');
insert into public.artists (id, name, slug, kind, status) values
  ('00000000-0000-4000-d300-000000000001', 'Test Duo', 'test-duo', 'group', 'approved'),
  ('00000000-0000-4000-d300-000000000002', 'Test Member', 'test-member', 'person', 'approved'),
  ('00000000-0000-4000-d300-000000000003', 'Test Other', 'test-other', 'person', 'approved');
insert into public.artist_members (group_id, member_id) values
  ('00000000-0000-4000-d300-000000000001', '00000000-0000-4000-d300-000000000002');
insert into public.artist_default_genres (artist_id, genre_id)
select '00000000-0000-4000-d300-000000000001', id from public.genres where name = 'Neurofunk';
insert into public.sets (id, event_id, set_type, status) values
  ('00000000-0000-4000-d400-000000000001', '00000000-0000-4000-d200-000000000001', 'solo', 'approved'),
  ('00000000-0000-4000-d400-000000000002', '00000000-0000-4000-d200-000000000002', 'b2b', 'approved'),
  ('00000000-0000-4000-d400-000000000003', '00000000-0000-4000-d200-000000000003', 'solo', 'approved'),
  ('00000000-0000-4000-d400-000000000004', '00000000-0000-4000-d200-000000000004', 'solo', 'pending');
insert into public.set_artists (set_id, artist_id) values
  ('00000000-0000-4000-d400-000000000001', '00000000-0000-4000-d300-000000000001'),
  ('00000000-0000-4000-d400-000000000002', '00000000-0000-4000-d300-000000000002'),
  ('00000000-0000-4000-d400-000000000002', '00000000-0000-4000-d300-000000000003'),
  ('00000000-0000-4000-d400-000000000003', '00000000-0000-4000-d300-000000000003'),
  ('00000000-0000-4000-d400-000000000004', '00000000-0000-4000-d300-000000000003');

insert into public.event_checkins (id, user_id, event_id, client_uuid, visibility, verified_gps, rating_sound) values
  -- Mine: two normal ones, one explicitly private, one on a pending event.
  ('00000000-0000-4000-d500-000000000001', '00000000-0000-4000-d000-000000000001', '00000000-0000-4000-d200-000000000001', gen_random_uuid(), null, true, 5),
  ('00000000-0000-4000-d500-000000000002', '00000000-0000-4000-d000-000000000001', '00000000-0000-4000-d200-000000000002', gen_random_uuid(), null, false, null),
  ('00000000-0000-4000-d500-000000000003', '00000000-0000-4000-d000-000000000001', '00000000-0000-4000-d200-000000000003', gen_random_uuid(), 'private', true, 1),
  ('00000000-0000-4000-d500-000000000004', '00000000-0000-4000-d000-000000000001', '00000000-0000-4000-d200-000000000004', gen_random_uuid(), null, false, null),
  -- The friend was at the first event too.
  ('00000000-0000-4000-d500-000000000011', '00000000-0000-4000-d000-000000000002', '00000000-0000-4000-d200-000000000001', gen_random_uuid(), null, true, 4),
  -- The private profile and the public fan.
  ('00000000-0000-4000-d500-000000000021', '00000000-0000-4000-d000-000000000004', '00000000-0000-4000-d200-000000000001', gen_random_uuid(), null, false, null),
  ('00000000-0000-4000-d500-000000000031', '00000000-0000-4000-d000-000000000005', '00000000-0000-4000-d200-000000000001', gen_random_uuid(), null, false, null);
insert into public.set_checkins (id, event_checkin_id, set_id, rating) values
  ('00000000-0000-4000-d600-000000000001', '00000000-0000-4000-d500-000000000001', '00000000-0000-4000-d400-000000000001', 4),
  ('00000000-0000-4000-d600-000000000002', '00000000-0000-4000-d500-000000000002', '00000000-0000-4000-d400-000000000002', 5),
  ('00000000-0000-4000-d600-000000000003', '00000000-0000-4000-d500-000000000003', '00000000-0000-4000-d400-000000000003', 1),
  ('00000000-0000-4000-d600-000000000004', '00000000-0000-4000-d500-000000000004', '00000000-0000-4000-d400-000000000004', 3),
  ('00000000-0000-4000-d600-000000000011', '00000000-0000-4000-d500-000000000011', '00000000-0000-4000-d400-000000000001', 5),
  ('00000000-0000-4000-d600-000000000021', '00000000-0000-4000-d500-000000000021', '00000000-0000-4000-d400-000000000001', 1),
  ('00000000-0000-4000-d600-000000000031', '00000000-0000-4000-d500-000000000031', '00000000-0000-4000-d400-000000000001', 3);

select stats.refresh_if_dirty();

set local role authenticated;

-- Direct access stays closed ------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-d000-000000000001"}', true);
select throws_ok($$ select * from stats.facts $$, '42501', null, 'Clients cannot read the facts directly');
select throws_ok($$ select stats.refresh_if_dirty() $$, '42501', null, 'Clients cannot trigger a refresh');

-- As the owner ---------------------------------------------------------------------------
select is((public.get_profile_stats('00000000-0000-4000-d000-000000000001') -> 'headline' ->> 'events')::int, 4, 'The owner counts all their events');
select is((public.get_profile_stats('00000000-0000-4000-d000-000000000001') -> 'headline' ->> 'sets')::int, 4, 'The owner counts all their sets');
select is((public.get_profile_stats('00000000-0000-4000-d000-000000000001') -> 'headline' ->> 'artists')::int, 3, 'A group set also counts for its member');
select is((public.get_profile_stats('00000000-0000-4000-d000-000000000001') -> 'headline' ->> 'verified')::int, 2, 'Verified check-ins are counted');
select is((public.get_profile_stats('00000000-0000-4000-d000-000000000001') -> 'headline' ->> 'cities')::int, 3, 'Cities are counted');
select is((public.get_profile_stats('00000000-0000-4000-d000-000000000001') -> 'genres' -> 0 ->> 'label'), 'Drum & Bass', 'A subgenre rolls up to its main genre');
select is((public.get_profile_stats('00000000-0000-4000-d000-000000000001') -> 'b2b' -> 0 ->> 'label'), 'Test Member & Test Other', 'B2B combinations are listed');
select is((public.get_profile_stats('00000000-0000-4000-d000-000000000001') -> 'streaks' ->> 'longest')::int, 2, 'Consecutive weekends make a streak');
select is((public.get_profile_stats('00000000-0000-4000-d000-000000000001') ->> 'travel_km'), null, 'Travel km stay hidden below 10 check-ins');
select is((public.get_profile_stats('00000000-0000-4000-d000-000000000001') ->> 'travel_missing'), 'checkins', 'The owner learns why');
select is((select count(*)::int from public.get_profile_map('00000000-0000-4000-d000-000000000001')), 3, 'The owner sees their whole map');

-- The explorer --------------------------------------------------------------------------
select is((select sets::int from public.explore_stats('00000000-0000-4000-d000-000000000001', 'artist') where label = 'Test Member'), 2, 'The explorer credits a member for the group set too');
select is((select count(*)::int from public.explore_stats('00000000-0000-4000-d000-000000000001', 'year')), 2, 'The explorer groups by year');
select is((select key from public.explore_stats('00000000-0000-4000-d000-000000000001', 'weekday', '2024-03-02', '2024-03-02')), '6', 'The explorer groups by weekday inside a time range');
select is((select sets::int from public.explore_stats('00000000-0000-4000-d000-000000000001', 'venue', filters => '{"city":"Testlinz"}') where label = 'Far Club'), 2, 'The explorer filters');
select is((select count(*)::int from public.explore_stats('00000000-0000-4000-d000-000000000001', 'venue', filters => '{"city":"Testlinz","set_type":"b2b"}')), 1, 'Filters combine');
select is((select count(*)::int from public.explore_stats('00000000-0000-4000-d000-000000000001', 'venue', verified_only => true)), 2, 'The explorer can limit to verified check-ins');
select throws_ok($$ select * from public.explore_stats('00000000-0000-4000-d000-000000000001', 'password') $$, '22023', null, 'Unknown dimensions are rejected');
select throws_ok($$ select * from public.explore_stats('00000000-0000-4000-d000-000000000001', 'year', filters => '{"role":"admin"}') $$, '22023', null, 'Unknown filters are rejected');

-- As a friend ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-d000-000000000002"}', true);
select is((public.get_profile_stats('00000000-0000-4000-d000-000000000001') -> 'headline' ->> 'events')::int, 2, 'A friend misses private check-ins and pending events');
select is((public.get_profile_stats('00000000-0000-4000-d000-000000000001') -> 'headline' ->> 'cities')::int, 2, 'A pending venue does not leak its city');
select is((select count(*)::int from public.explore_stats('00000000-0000-4000-d000-000000000001', 'venue') where label = 'Secret Pending Club'), 0, 'The explorer hides pending venues from others');
select is((select count(*)::int from public.get_profile_map('00000000-0000-4000-d000-000000000001')), 0, 'The map has its own privacy setting');
select is(public.get_profile_stats('00000000-0000-4000-d000-000000000001') ? 'travel_missing', false, 'Others do not learn why travel km are missing');
select is((public.compare_with('00000000-0000-4000-d000-000000000001') ->> 'sets_together')::int, 1, 'Comparison counts sets seen together');
select is((public.compare_with('00000000-0000-4000-d000-000000000001') ->> 'events_together')::int, 1, 'Comparison counts events together');
select ok((public.compare_with('00000000-0000-4000-d000-000000000001') ->> 'taste_match')::int between 1 and 99, 'Taste match is a percentage');

-- Leaderboard: my verified events are the first and the hidden one, the friend sees only one.
select is((select events::int from public.friends_leaderboard() where username = 'test_st_me'), 1, 'The leaderboard counts only verified check-ins the viewer may see');
select is((select count(*)::int from public.friends_leaderboard()), 2, 'The leaderboard holds only you and your friends');
select is((select count(*)::int from public.friends_leaderboard(2020)), 2, 'A year without check-ins still lists everyone');
select is((select events::int from public.friends_leaderboard(2020) where username = 'test_st_me'), 0, 'The year limits the numbers');

-- As a stranger -------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-d000-000000000003"}', true);
select is(public.get_profile_stats('00000000-0000-4000-d000-000000000001'), null, 'A stranger gets no friends-only stats');
select is((select count(*)::int from public.explore_stats('00000000-0000-4000-d000-000000000001', 'year')), 0, 'The explorer follows the same rule');
select is(public.compare_with('00000000-0000-4000-d000-000000000001'), null, 'Neither does the comparison');
select is(public.get_profile_stats('00000000-0000-4000-d000-000000000004'), null, 'A private profile overrides public stats');
select is((public.get_profile_stats('00000000-0000-4000-d000-000000000005') -> 'headline' ->> 'events')::int, 1, 'Public stats are visible to a stranger');

-- Artist and venue pages ----------------------------------------------------------------
select is((public.get_artist_stats('00000000-0000-4000-d300-000000000001') ->> 'checkins')::int, 3, 'App-wide numbers include friends-level check-ins, not private profiles');
select is(jsonb_array_length(public.get_artist_stats('00000000-0000-4000-d300-000000000001') -> 'top_fans'), 1, 'Top fans are public profiles only');
select is((public.get_artist_stats('00000000-0000-4000-d300-000000000002') -> 'partners' -> 0 ->> 'name'), 'Test Other', 'B2B partners are listed');
select is((public.get_venue_stats('00000000-0000-4000-d100-000000000001') -> 'resident' ->> 'username'), 'test_st_fan', 'The resident has a public profile');
select is((select round(avg_sound, 1) from public.best_sound_ranking() where name = 'Test Club'), 4.5, 'The sound ranking averages ratings');
select is(public.get_venue_stats('00000000-0000-4000-d100-000000000003'), null, 'Pending venues stay hidden from others');

-- Travel km -----------------------------------------------------------------------------
reset role;
update public.profiles set home_city = 'testwien' where id = '00000000-0000-4000-d000-000000000005';
insert into public.events (id, name, date_start, venue_id, status)
select ('00000000-0000-4000-d700-' || lpad(n::text, 12, '0'))::uuid, 'Test Trip ' || n, date '2022-01-01' + n, '00000000-0000-4000-d100-000000000002', 'approved'
from generate_series(1, 9) n;
insert into public.event_checkins (user_id, event_id, client_uuid)
select '00000000-0000-4000-d000-000000000005', ('00000000-0000-4000-d700-' || lpad(n::text, 12, '0'))::uuid, gen_random_uuid()
from generate_series(1, 9) n;
select stats.refresh_if_dirty();
set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-d000-000000000005"}', true);
select ok((public.get_profile_stats('00000000-0000-4000-d000-000000000005') ->> 'travel_km')::numeric between 2500 and 5000, 'Travel km appear from 10 check-ins, as round trips');
select is((public.get_profile_stats('00000000-0000-4000-d000-000000000005') ->> 'travel_km')::numeric % 10, 0::numeric, 'Travel km are rounded');
select is(public.get_profile_stats('00000000-0000-4000-d000-000000000005') ? 'home_city', false, 'The result holds no home location');

select * from finish();
rollback;
