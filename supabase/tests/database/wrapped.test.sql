-- Wrapped: periods, content, privacy and the Community Wrapped. Rolled back after each run.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(40);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-b000-000000000001', 'me@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-b000-000000000002', 'buddy@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-b000-000000000003', 'stranger@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-b000-000000000004', 'admin@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-b000-000000000005', 'public@test.invalid', 'authenticated', 'authenticated');
insert into public.profiles (id, username, display_name, birth_year, role, privacy) values
  ('00000000-0000-4000-b000-000000000001', 'test_wr_me', 'Me', 1995, 'user', '{"profile":"public","stats":"friends","map":"private","photos":"friends","badges":"friends"}'),
  ('00000000-0000-4000-b000-000000000002', 'test_wr_buddy', 'Buddy', 1995, 'user', '{"profile":"friends"}'),
  ('00000000-0000-4000-b000-000000000003', 'test_wr_stranger', 'Stranger', 1995, 'user', '{"profile":"friends"}'),
  ('00000000-0000-4000-b000-000000000004', 'test_wr_admin', 'Admin', 1995, 'admin', '{"profile":"friends"}'),
  ('00000000-0000-4000-b000-000000000005', 'test_wr_public', 'Public', 1995, 'user', '{"profile":"public","stats":"public"}');
insert into public.friendships (user_a, user_b, status, requested_by) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-b000-000000000002', 'accepted', '00000000-0000-4000-b000-000000000001');

insert into public.venues (id, name, city, country_code, lat, lng, venue_type, status) values
  ('00000000-0000-4000-b100-000000000001', 'Wr Hall', 'Testwien', 'AT', 48.2, 16.4, 'warehouse', 'approved'),
  ('00000000-0000-4000-b100-000000000002', 'Wr Club', 'Testlinz', 'AT', 48.3, 14.3, 'club', 'approved');
insert into public.events (id, name, date_start, venue_id, status) values
  ('00000000-0000-4000-b200-000000000001', 'Wr One', '1999-03-02', '00000000-0000-4000-b100-000000000001', 'approved'),
  ('00000000-0000-4000-b200-000000000002', 'Wr Two', '1999-03-09', '00000000-0000-4000-b100-000000000001', 'approved'),
  ('00000000-0000-4000-b200-000000000003', 'Wr Three', '1999-07-06', '00000000-0000-4000-b100-000000000002', 'approved'),
  ('00000000-0000-4000-b200-000000000004', 'Wr Secret', '1999-08-03', '00000000-0000-4000-b100-000000000002', 'approved'),
  ('00000000-0000-4000-b200-000000000005', 'Wr Old', '1998-05-05', '00000000-0000-4000-b100-000000000002', 'approved');
insert into public.artists (id, name, slug, status) values
  ('00000000-0000-4000-b300-000000000001', 'Wr Star', 'wr-star', 'approved'),
  ('00000000-0000-4000-b300-000000000002', 'Wr Newbie', 'wr-newbie', 'approved'),
  ('00000000-0000-4000-b300-000000000003', 'Wr Hidden', 'wr-hidden', 'approved');
insert into public.sets (id, event_id, status) values
  ('00000000-0000-4000-b400-000000000001', '00000000-0000-4000-b200-000000000001', 'approved'),
  ('00000000-0000-4000-b400-000000000002', '00000000-0000-4000-b200-000000000001', 'approved'),
  ('00000000-0000-4000-b400-000000000003', '00000000-0000-4000-b200-000000000002', 'approved'),
  ('00000000-0000-4000-b400-000000000004', '00000000-0000-4000-b200-000000000004', 'approved'),
  ('00000000-0000-4000-b400-000000000005', '00000000-0000-4000-b200-000000000005', 'approved');
insert into public.set_artists (set_id, artist_id) values
  ('00000000-0000-4000-b400-000000000001', '00000000-0000-4000-b300-000000000001'),
  ('00000000-0000-4000-b400-000000000002', '00000000-0000-4000-b300-000000000002'),
  ('00000000-0000-4000-b400-000000000003', '00000000-0000-4000-b300-000000000001'),
  ('00000000-0000-4000-b400-000000000004', '00000000-0000-4000-b300-000000000003'),
  ('00000000-0000-4000-b400-000000000005', '00000000-0000-4000-b300-000000000001');
insert into public.event_checkins (id, user_id, event_id, client_uuid, visibility, rating_sound) values
  ('00000000-0000-4000-b500-000000000001', '00000000-0000-4000-b000-000000000001', '00000000-0000-4000-b200-000000000001', gen_random_uuid(), null, 5),
  ('00000000-0000-4000-b500-000000000002', '00000000-0000-4000-b000-000000000001', '00000000-0000-4000-b200-000000000002', gen_random_uuid(), null, null),
  ('00000000-0000-4000-b500-000000000003', '00000000-0000-4000-b000-000000000001', '00000000-0000-4000-b200-000000000003', gen_random_uuid(), null, null),
  ('00000000-0000-4000-b500-000000000004', '00000000-0000-4000-b000-000000000001', '00000000-0000-4000-b200-000000000004', gen_random_uuid(), 'private', null),
  ('00000000-0000-4000-b500-000000000005', '00000000-0000-4000-b000-000000000001', '00000000-0000-4000-b200-000000000005', gen_random_uuid(), null, null),
  ('00000000-0000-4000-b500-000000000011', '00000000-0000-4000-b000-000000000002', '00000000-0000-4000-b200-000000000001', gen_random_uuid(), null, 3),
  ('00000000-0000-4000-b500-000000000021', '00000000-0000-4000-b000-000000000005', '00000000-0000-4000-b200-000000000001', gen_random_uuid(), null, null);
insert into public.set_checkins (event_checkin_id, set_id, rating) values
  ('00000000-0000-4000-b500-000000000001', '00000000-0000-4000-b400-000000000001', 4),
  ('00000000-0000-4000-b500-000000000001', '00000000-0000-4000-b400-000000000002', 5),
  ('00000000-0000-4000-b500-000000000002', '00000000-0000-4000-b400-000000000003', 3),
  ('00000000-0000-4000-b500-000000000004', '00000000-0000-4000-b400-000000000004', 5),
  ('00000000-0000-4000-b500-000000000005', '00000000-0000-4000-b400-000000000005', 3);
insert into public.media (owner_id, event_checkin_id, storage_path, moderation_status) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-b500-000000000001', 'test/wr-approved.webp', 'approved'),
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-b500-000000000002', 'test/wr-pending.webp', 'pending');
insert into public.private_checkin_data (event_checkin_id, ticket_price, other_spend) values
  ('00000000-0000-4000-b500-000000000001', 25, 40),
  ('00000000-0000-4000-b500-000000000003', 30, null);

select stats.refresh_if_dirty();

set local role authenticated;

-- Periods -------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-b000-000000000001"}', true);
select throws_ok($$ select public.get_wrapped('test_wr_me', 'nonsense') $$, '22023', null, 'An unknown period is rejected');
select throws_ok($$ select public.get_wrapped('test_wr_me', '1999-13') $$, '22023', null, 'An impossible month is rejected');
select throws_ok($$ select public.get_wrapped('test_wr_me', '1999-02-30_1999-03-01') $$, '22023', null, 'An impossible date is rejected');
select throws_ok($$ select public.get_wrapped('test_wr_me', '1999-05-01_1999-03-01') $$, '22023', null, 'A range ending before it starts is rejected');

select is(public.get_wrapped('test_wr_me', (extract(year from current_date)::int + 1)::text) ->> 'locked', 'true', 'A future year is locked');
select is((public.get_wrapped('test_wr_me', '1999') -> 'numbers' ->> 'events')::int, 4, 'A year holds its events');
select is((public.get_wrapped('test_wr_me', '1999-03') -> 'numbers' ->> 'events')::int, 2, 'A month holds its events');
select is((public.get_wrapped('test_wr_me', '1999-summer') -> 'numbers' ->> 'events')::int, 2, 'A season holds its events');
select is((public.get_wrapped('test_wr_me', '1999-03-05_1999-07-10') -> 'numbers' ->> 'events')::int, 2, 'A custom range holds its events');
select is((public.get_wrapped('test_wr_me', 'event-00000000-0000-4000-b200-000000000001') -> 'numbers' ->> 'sets')::int, 2, 'An event holds its sets');
select is(public.get_wrapped('test_wr_me', 'event-00000000-0000-4000-b200-000000000001') -> 'period' ->> 'event_name', 'Wr One', 'An event gives its name');
select is(public.get_wrapped('test_wr_me', '2001') ->> 'empty', 'true', 'A period without check-ins says so');

-- Content -------------------------------------------------------------------------------
select is(public.get_wrapped('test_wr_me', '1999') -> 'top_artist' ->> 'name', 'Wr Star', 'The top artist');
select is((public.get_wrapped('test_wr_me', '1999') -> 'top_artist' ->> 'sets')::int, 2, 'The top artist has their count');
select is(public.get_wrapped('test_wr_me', '1999-03') -> 'top_venue' ->> 'name', 'Wr Hall', 'The top venue');
select is(public.get_wrapped('test_wr_me', '1999') -> 'best_set' ->> 'artists', 'Wr Hidden', 'The owner sees the best set, private or not');
select is(public.get_wrapped('test_wr_me', '1999') -> 'longest_night' ->> 'event', 'Wr One', 'The longest night');
select is(public.get_wrapped('test_wr_me', '1999') -> 'active_month' ->> 'month', '1999-03', 'The most active month');
select is((public.get_wrapped('test_wr_me', '1999') -> 'new_artists' ->> 'count')::int, 2, 'New artists leave out those seen in earlier years');
select is(public.get_wrapped('test_wr_me', '1999') -> 'buddy' ->> 'username', 'test_wr_buddy', 'Rave Buddy No. 1 is a friend, not just someone at the same event');
select is(public.get_wrapped('test_wr_me', '1999') ->> 'persona', 'warehouse_rat', 'The persona follows the numbers');
select is(jsonb_array_length(public.get_wrapped('test_wr_me', '1999') -> 'collage'), 4, 'The collage has a photo and tiles for the rest');
select ok((public.get_wrapped('test_wr_me', '1999') -> 'collage')::text like '%wr-approved%', 'The collage shows approved photos');
select ok((public.get_wrapped('test_wr_me', '1999') -> 'collage')::text not like '%wr-pending%', 'The collage leaves out photos under review');
select ok(public.get_wrapped('test_wr_me', '1999')::text not like '%ticket%', 'Spending is never in the Wrapped data');

select is((select tickets::int from public.get_my_spending('1999')), 55, 'Your own view adds up your spending');
select is((select other::int from public.get_my_spending('1999')), 40, 'Other spending is separate');

-- The Wrapped badge
select public.mark_wrapped_shared('1999');
select public.evaluate_my_badges();
select is((select value::int from public.get_badges('00000000-0000-4000-b000-000000000001') where name = 'Wrapped'), 1, 'Sharing a yearly Wrapped counts for its badge');
select public.mark_wrapped_shared((extract(year from current_date)::int + 1)::text);
select public.mark_wrapped_shared('1999-03');
select public.evaluate_my_badges();
select is((select value::int from public.get_badges('00000000-0000-4000-b000-000000000001') where name = 'Wrapped'), 1, 'A locked year or a month does not count');

-- As a friend ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-b000-000000000002"}', true);
select is((public.get_wrapped('test_wr_me', '1999') -> 'numbers' ->> 'events')::int, 3, 'A friend misses private check-ins');
select is(public.get_wrapped('test_wr_me', '1999') -> 'best_set' ->> 'artists', 'Wr Newbie', 'A private set stays out of the best set');
select ok(public.get_wrapped('test_wr_me', '1999') -> 'places' = 'null'::jsonb, 'The map follows its own privacy setting');
select is((select count(*)::int from public.get_my_spending('1999')), 0, 'Someone else gets only their own spending');

-- As a stranger -------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-b000-000000000003"}', true);
select is(public.get_wrapped('test_wr_me', '1999'), null, 'A link does not get around friends-only stats');
select is(public.get_wrapped('test_wr_nobody', '1999'), null, 'An unknown user gives nothing');
select is((public.get_wrapped('test_wr_public', '1999') -> 'numbers' ->> 'events')::int, 1, 'Public stats can be seen through a link');

-- Community Wrapped ---------------------------------------------------------------------
select is(public.get_community_wrapped(1999), null, 'The Community Wrapped stays closed until unlocked');
select throws_ok($$ select public.admin_set_community_wrapped(1999, true) $$, '42501', null, 'Only an admin can unlock it');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-b000-000000000004"}', true);
select public.admin_set_community_wrapped(1999, true);
select is(public.get_community_wrapped(1999) -> 'top_artist' ->> 'name', 'Wr Star', 'Unlocked, it names the most-seen artist');
select is(public.get_community_wrapped(1999) -> 'best_sound' ->> 'name', 'Wr Hall', 'And the best sound');

select * from finish();
rollback;
