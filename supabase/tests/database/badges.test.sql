-- Badge rule engine and fun facts. Rolled back after each run.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(51);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-c000-000000000001', 'me@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-c000-000000000002', 'friend@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-c000-000000000003', 'stranger@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-c000-000000000004', 'admin@test.invalid', 'authenticated', 'authenticated');
insert into public.profiles (id, username, display_name, birth_year, home_city, role, privacy) values
  ('00000000-0000-4000-c000-000000000001', 'test_bd_me', 'Me', 1995, 'Testwien', 'user', '{"profile":"public","badges":"friends"}'),
  ('00000000-0000-4000-c000-000000000002', 'test_bd_friend', 'Friend', 1995, null, 'user', '{"profile":"friends"}'),
  ('00000000-0000-4000-c000-000000000003', 'test_bd_stranger', 'Stranger', 1995, null, 'user', '{"profile":"friends"}'),
  ('00000000-0000-4000-c000-000000000004', 'test_bd_admin', 'Admin', 1995, null, 'admin', '{"profile":"friends"}');
insert into public.friendships (user_a, user_b, status, requested_by) values
  ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-c000-000000000002', 'accepted', '00000000-0000-4000-c000-000000000002');

insert into public.venues (id, name, city, country_code, lat, lng, venue_type, status) values
  ('00000000-0000-4000-c100-000000000001', 'Test Hall', 'Testwien', 'AT', 48.2, 16.4, 'warehouse', 'approved'),
  ('00000000-0000-4000-c100-000000000002', 'Test Castle', 'Testberlin', 'DE', 52.5, 13.4, 'castle', 'approved');
insert into public.event_series (id, name, slug, status) values
  ('00000000-0000-4000-c150-000000000001', 'Test Series', 'test-series-badges', 'approved');
insert into public.events (id, series_id, name, date_start, venue_id, status) values
  -- Consecutive Saturdays, a new year's eve and a Monday.
  ('00000000-0000-4000-c200-000000000001', '00000000-0000-4000-c150-000000000001', 'Test One', '2023-03-04', '00000000-0000-4000-c100-000000000001', 'approved'),
  ('00000000-0000-4000-c200-000000000002', '00000000-0000-4000-c150-000000000001', 'Test Two', '2024-03-02', '00000000-0000-4000-c100-000000000001', 'approved'),
  ('00000000-0000-4000-c200-000000000003', null, 'Test Three', '2024-03-09', '00000000-0000-4000-c100-000000000002', 'approved'),
  ('00000000-0000-4000-c200-000000000004', null, 'Test Eve', '2024-12-31', '00000000-0000-4000-c100-000000000001', 'approved'),
  ('00000000-0000-4000-c200-000000000005', null, 'Test Monday', '2025-02-03', '00000000-0000-4000-c100-000000000001', 'approved');
insert into public.artists (id, name, slug, kind, status, country_code) values
  ('00000000-0000-4000-c300-000000000001', 'Test Duo', 'test-duo-b', 'group', 'approved', null),
  ('00000000-0000-4000-c300-000000000002', 'Test A', 'test-a-b', 'person', 'approved', 'AT'),
  ('00000000-0000-4000-c300-000000000003', 'Test B', 'test-b-b', 'person', 'approved', 'DE');
insert into public.artist_members (group_id, member_id) values
  ('00000000-0000-4000-c300-000000000001', '00000000-0000-4000-c300-000000000002'),
  ('00000000-0000-4000-c300-000000000001', '00000000-0000-4000-c300-000000000003');
insert into public.artist_default_genres (artist_id, genre_id)
select '00000000-0000-4000-c300-000000000002', id from public.genres where slug = 'neurofunk';
insert into public.sets (id, event_id, set_type, status) values
  ('00000000-0000-4000-c400-000000000001', '00000000-0000-4000-c200-000000000001', 'solo', 'approved'),
  ('00000000-0000-4000-c400-000000000002', '00000000-0000-4000-c200-000000000002', 'solo', 'approved'),
  ('00000000-0000-4000-c400-000000000003', '00000000-0000-4000-c200-000000000002', 'b2b', 'approved'),
  ('00000000-0000-4000-c400-000000000004', '00000000-0000-4000-c200-000000000003', 'solo', 'approved');
insert into public.set_artists (set_id, artist_id) values
  ('00000000-0000-4000-c400-000000000001', '00000000-0000-4000-c300-000000000002'),
  ('00000000-0000-4000-c400-000000000002', '00000000-0000-4000-c300-000000000003'),
  ('00000000-0000-4000-c400-000000000003', '00000000-0000-4000-c300-000000000001'),
  ('00000000-0000-4000-c400-000000000004', '00000000-0000-4000-c300-000000000002');
insert into public.event_checkins (id, user_id, event_id, client_uuid, verified_gps) values
  ('00000000-0000-4000-c500-000000000001', '00000000-0000-4000-c000-000000000001', '00000000-0000-4000-c200-000000000001', gen_random_uuid(), true),
  ('00000000-0000-4000-c500-000000000002', '00000000-0000-4000-c000-000000000001', '00000000-0000-4000-c200-000000000002', gen_random_uuid(), false),
  ('00000000-0000-4000-c500-000000000003', '00000000-0000-4000-c000-000000000001', '00000000-0000-4000-c200-000000000003', gen_random_uuid(), false),
  ('00000000-0000-4000-c500-000000000004', '00000000-0000-4000-c000-000000000001', '00000000-0000-4000-c200-000000000004', gen_random_uuid(), false);
insert into public.set_checkins (id, event_checkin_id, set_id, rating) values
  ('00000000-0000-4000-c600-000000000001', '00000000-0000-4000-c500-000000000001', '00000000-0000-4000-c400-000000000001', 3),
  ('00000000-0000-4000-c600-000000000002', '00000000-0000-4000-c500-000000000002', '00000000-0000-4000-c400-000000000002', 4),
  ('00000000-0000-4000-c600-000000000003', '00000000-0000-4000-c500-000000000002', '00000000-0000-4000-c400-000000000003', 4),
  ('00000000-0000-4000-c600-000000000004', '00000000-0000-4000-c500-000000000003', '00000000-0000-4000-c400-000000000004', 5);
insert into public.set_checkin_tags (set_checkin_id, tag_id)
select '00000000-0000-4000-c600-000000000004', id from public.tags where name = 'Closing' and scope = 'set';

-- The notes -----------------------------------------------------------------------------
select ok(exists (select 1 from badges.dirty where user_id = '00000000-0000-4000-c000-000000000001' and scope = 'checkins' and not silent), 'A check-in leaves a note');

select badges.evaluate('00000000-0000-4000-c000-000000000001', 'checkins', true);
select badges.evaluate('00000000-0000-4000-c000-000000000001', 'community', true);
delete from badges.dirty;

create function pg_temp.level_of(badge text)
returns integer language sql as $$
  select coalesce((
    select u.level from public.user_badges u join public.badge_definitions d on d.id = u.badge_id
    where d.name = badge and u.user_id = '00000000-0000-4000-c000-000000000001'
  ), 0);
$$;
create function pg_temp.value_of(badge text)
returns numeric language sql as $$
  select p.value from badges.progress p join public.badge_definitions d on d.id = p.badge_id
  where d.name = badge and p.user_id = '00000000-0000-4000-c000-000000000001';
$$;
grant execute on all functions in schema pg_temp to authenticated;

-- The rule engine -----------------------------------------------------------------------
select is(pg_temp.level_of('First Drop'), 1, 'The first check-in earns First Drop');
select is(pg_temp.value_of('Raver'), 4::numeric, 'count counts events');
select is(pg_temp.value_of('Set Collector'), 4::numeric, 'count counts sets');
select is(pg_temp.value_of('Artist Hunter'), 3::numeric, 'A group set also counts for its members');
select is(pg_temp.value_of('Neuro Nerd'), 1::numeric, 'A genre filter matches');
select is(pg_temp.value_of('Drum & Bass Fan'), 1::numeric, 'A main genre includes its subgenres');
select is(pg_temp.value_of('Back to Back'), 1::numeric, 'A set type filter matches');
select is(pg_temp.value_of('Closing Crew'), 1::numeric, 'A tag filter matches');
select is(pg_temp.value_of('Proof of Rave'), 1::numeric, 'verified_only counts only verified check-ins');
select is(pg_temp.value_of('Weekend Warrior'), 2::numeric, 'A streak counts consecutive weekends');
select is(pg_temp.value_of('Night Shift'), 2::numeric, 'same_night finds the fullest night');
select is(pg_temp.value_of('Countdown'), 1::numeric, 'A date filter matches');
select is(pg_temp.value_of('Monday Blues'), 1::numeric, 'A weekday filter counts only the Tuesday, not the Saturdays');
select is(pg_temp.value_of('Regular'), 3::numeric, 'max_count finds the most visited venue');
select is(pg_temp.value_of('Superfan'), 3::numeric, 'max_count counts sets for artists');
select is(pg_temp.value_of('Border Crosser'), 2::numeric, 'Countries are counted');
select is(pg_temp.value_of('Castle Raver'), 1::numeric, 'A venue type filter matches');
select is(pg_temp.value_of('Road Trip'), 1::numeric, 'Distance is measured from the home region');
select is(pg_temp.value_of('Tradition'), 2::numeric, 'A custom rule: consecutive years of a series');
select is(pg_temp.value_of('Duo Completionist'), 1::numeric, 'A custom rule: a duo plus both members solo');
select is(pg_temp.value_of('Digger'), 3::numeric, 'A custom rule: nobody saw these artists before');
select is(pg_temp.value_of('Plus One'), 1::numeric, 'A custom rule: requests from the other side');
select is(pg_temp.value_of('Beta Raver'), 1::numeric, 'A custom rule: account created in the window');
select is(pg_temp.level_of('Raver'), 0, 'Below the first level there is no badge');
select is((select count(*)::int from public.notifications where recipient_id = '00000000-0000-4000-c000-000000000001' and type = 'badge'), 0, 'The backfill sends no notifications');

-- Levels and notifications --------------------------------------------------------------
insert into public.event_checkins (id, user_id, event_id, client_uuid) values
  ('00000000-0000-4000-c500-000000000005', '00000000-0000-4000-c000-000000000001', '00000000-0000-4000-c200-000000000005', gen_random_uuid());
select public.evaluate_my_badges();
select badges.process_dirty();
select is(pg_temp.level_of('Raver'), 1, 'The fifth event reaches a level');
select is((select payload ->> 'name' from public.notifications where recipient_id = '00000000-0000-4000-c000-000000000001' and type = 'badge' and payload ->> 'badge' = 'Raver'), 'Raver', 'A new level sends a notification');
select is((select count(*)::int from public.notifications where recipient_id = '00000000-0000-4000-c000-000000000001' and type = 'badge' and payload ->> 'badge' = 'Raver'), 1, 'One notification per level');

-- Revoking ------------------------------------------------------------------------------
delete from public.notifications where recipient_id = '00000000-0000-4000-c000-000000000001';
delete from public.event_checkins where id = '00000000-0000-4000-c500-000000000005';
select badges.process_dirty();
select is(pg_temp.level_of('Raver'), 0, 'A deleted check-in takes its level away');
select is((select count(*)::int from public.notifications where recipient_id = '00000000-0000-4000-c000-000000000001'), 0, 'A lost level disappears without a notification');

-- Fun facts -----------------------------------------------------------------------------
select ok(exists (select 1 from public.checkin_fun_facts where checkin_id = '00000000-0000-4000-c500-000000000001' and kind = 'artist_seen' and (payload ->> 'n')::int = 1), 'First time seen');
select ok(exists (select 1 from public.checkin_fun_facts where checkin_id = '00000000-0000-4000-c500-000000000001' and kind = 'first_venue'), 'First time at this venue');
select ok(exists (select 1 from public.checkin_fun_facts where checkin_id = '00000000-0000-4000-c500-000000000003' and kind = 'first_country'), 'First time in this country');
select ok(not exists (select 1 from public.checkin_fun_facts where checkin_id = '00000000-0000-4000-c500-000000000002' and kind = 'first_venue'), 'Not first time anymore');
select ok(exists (select 1 from public.checkin_fun_facts where checkin_id = '00000000-0000-4000-c500-000000000002' and kind = 'series_streak' and (payload ->> 'n')::int = 2), 'Same series for the second year in a row');
select ok(exists (select 1 from public.checkin_fun_facts where checkin_id = '00000000-0000-4000-c500-000000000002' and kind = 'duo_complete'), 'A duo completed');
select ok(exists (select 1 from public.checkin_fun_facts where checkin_id = '00000000-0000-4000-c500-000000000003' and kind = 'artist_best_rating'), 'Highest rating for this artist');
select ok(exists (select 1 from public.checkin_fun_facts where checkin_id = '00000000-0000-4000-c500-000000000002' and kind = 'record_sets'), 'New record of sets in one night');
select ok(exists (select 1 from public.checkin_fun_facts where kind = 'first_of_friends' and checkin_id = '00000000-0000-4000-c500-000000000001'), 'First of your friends');

-- Who sees what -------------------------------------------------------------------------
set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-c000-000000000001"}', true);
select ok((select value from public.get_badges('00000000-0000-4000-c000-000000000001') where name = 'Raver') is not null, 'You see your own progress');
select ok((select count(*) from public.get_badges('00000000-0000-4000-c000-000000000001')) >= 60, 'No secret badges: you see the whole catalog');
select throws_ok($$ select * from badges.progress $$, '42501', null, 'Clients cannot read the engine tables');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-c000-000000000002"}', true);
select is((select level from public.get_badges('00000000-0000-4000-c000-000000000001') where name = 'First Drop'), 1, 'A friend sees your level');
select is((select value from public.get_badges('00000000-0000-4000-c000-000000000001') where name = 'Raver'), null, 'A friend does not see your progress');
select is((select count(*)::int from public.checkin_fun_facts where checkin_id = '00000000-0000-4000-c500-000000000001'), 0, 'Fun facts stay with their owner');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-c000-000000000003"}', true);
select is((select count(*)::int from public.get_badges('00000000-0000-4000-c000-000000000001')), 0, 'A stranger gets nothing when badges are for friends');
select throws_ok($$ select * from public.admin_preview_badge('{"metric":"count","subject":"event","levels":[1]}') $$, '42501', null, 'The preview is for staff');
select throws_ok($$ insert into public.badge_definitions (name, description, category, rule) values ('Hacked', 'x', 'y', '{"metric":"count","subject":"event","levels":[1]}') $$, '42501', null, 'Members cannot create badges');

-- The editor ----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-c000-000000000004"}', true);
select is((select level from public.admin_preview_badge('{"metric":"count","subject":"event","levels":[1,4]}') where username = 'test_bd_me'), 2, 'The preview shows who would have it, and the level');
select throws_ok($$ select * from public.admin_preview_badge('{"metric":"drop table","levels":[1]}') $$, '22023', null, 'An unknown metric is rejected');

select * from finish();
rollback;
