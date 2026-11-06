-- Feeds, reactions and notifications. Rolled back after each run.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(40);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-f000-000000000001', 'me@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-f000-000000000002', 'friend@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-f000-000000000003', 'stranger@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-f000-000000000004', 'private@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-f000-000000000005', 'blocked@test.invalid', 'authenticated', 'authenticated');
insert into public.profiles (id, username, display_name, birth_year, home_city, privacy) values
  ('00000000-0000-4000-f000-000000000001', 'test_feed_me', 'Me', 1995, 'Testwien', '{}'),
  ('00000000-0000-4000-f000-000000000002', 'test_feed_friend', 'Friend', 1995, null, '{"checkins":"friends","photos":"friends"}'),
  ('00000000-0000-4000-f000-000000000003', 'test_feed_stranger', 'Stranger', 1995, null, '{"profile":"public","checkins":"public","photos":"public"}'),
  ('00000000-0000-4000-f000-000000000004', 'test_feed_private', 'Private', 1995, null, '{"profile":"private"}'),
  ('00000000-0000-4000-f000-000000000005', 'test_feed_blocked', 'Blocked', 1995, null, '{"profile":"public","checkins":"public"}');
insert into public.friendships (user_a, user_b, status, requested_by) values
  ('00000000-0000-4000-f000-000000000001', '00000000-0000-4000-f000-000000000002', 'accepted', '00000000-0000-4000-f000-000000000001');
insert into public.blocks (blocker_id, blocked_id) values
  ('00000000-0000-4000-f000-000000000001', '00000000-0000-4000-f000-000000000005');

insert into public.venues (id, name, city, country_code, status) values
  ('10000000-0000-4000-f000-000000000001', 'Test Feed Hall', 'Testwien', 'AT', 'approved'),
  ('10000000-0000-4000-f000-000000000002', 'Test Far Hall', 'Testgraz', 'AT', 'approved');
insert into public.events (id, name, date_start, venue_id, status, lifecycle) values
  ('20000000-0000-4000-f000-000000000001', 'Test Feed Night', '2025-05-01', '10000000-0000-4000-f000-000000000001', 'approved', 'scheduled'),
  ('20000000-0000-4000-f000-000000000002', 'Test Pending Feed', '2025-05-02', '10000000-0000-4000-f000-000000000001', 'pending', 'scheduled'),
  ('20000000-0000-4000-f000-000000000003', 'Test Cancelled Feed', '2025-05-03', '10000000-0000-4000-f000-000000000001', 'approved', 'cancelled'),
  ('20000000-0000-4000-f000-000000000004', 'Test Far Night', '2025-05-04', '10000000-0000-4000-f000-000000000002', 'approved', 'scheduled'),
  ('20000000-0000-4000-f000-000000000005', 'Test Upcoming', current_date + 30, '10000000-0000-4000-f000-000000000001', 'approved', 'scheduled');
insert into public.artists (id, name, slug, status) values
  ('40000000-0000-4000-f000-000000000001', 'Test Wish Artist', 'test-wish-artist', 'approved');
insert into public.sets (id, event_id, status) values
  ('30000000-0000-4000-f000-000000000001', '20000000-0000-4000-f000-000000000001', 'approved'),
  ('30000000-0000-4000-f000-000000000002', '20000000-0000-4000-f000-000000000001', 'approved');
insert into public.set_artists (set_id, artist_id) values
  ('30000000-0000-4000-f000-000000000001', '40000000-0000-4000-f000-000000000001');
insert into public.wishlist_artists (user_id, artist_id) values
  ('00000000-0000-4000-f000-000000000001', '40000000-0000-4000-f000-000000000001');

-- Friend checks in, with bundling --------------------------------------------------------

insert into public.event_checkins (id, user_id, event_id, client_uuid) values
  ('50000000-0000-4000-f000-000000000001', '00000000-0000-4000-f000-000000000002', '20000000-0000-4000-f000-000000000001', gen_random_uuid());
select is(
  (select count(*)::int from public.notifications where recipient_id = '00000000-0000-4000-f000-000000000001' and type = 'friend_checkin'),
  1, 'A friend checking in creates a notification'
);
insert into public.set_checkins (id, event_checkin_id, set_id, rating) values
  ('60000000-0000-4000-f000-000000000001', '50000000-0000-4000-f000-000000000001', '30000000-0000-4000-f000-000000000001', 4),
  ('60000000-0000-4000-f000-000000000002', '50000000-0000-4000-f000-000000000001', '30000000-0000-4000-f000-000000000002', 5);
select is(
  (select count(*)::int from public.notifications where recipient_id = '00000000-0000-4000-f000-000000000001' and type = 'friend_checkin'),
  1, 'Follow-up sets update it instead of adding more'
);
select is(
  (select (payload ->> 'sets')::int from public.notifications where recipient_id = '00000000-0000-4000-f000-000000000001' and type = 'friend_checkin'),
  2, 'The notification counts the sets'
);
select is(
  (select count(*)::int from public.notifications where recipient_id = '00000000-0000-4000-f000-000000000001' and type = 'wishlist' and payload ->> 'kind' = 'seen'),
  1, 'A friend seeing a wishlist artist notifies'
);
update public.notifications set updated_at = now() - interval '61 minutes', pushed_at = now()
  where recipient_id = '00000000-0000-4000-f000-000000000001' and type = 'friend_checkin';
insert into public.set_checkins (event_checkin_id, set_id, imported) values
  ('50000000-0000-4000-f000-000000000001', '30000000-0000-4000-f000-000000000002', true)
  on conflict do nothing;
select public.upsert_notification('00000000-0000-4000-f000-000000000001', 'friend_checkin', '{"sets":3}', 'checkin:00000000-0000-4000-f000-000000000002:20000000-0000-4000-f000-000000000001');
select is(
  (select count(*)::int from public.notifications where recipient_id = '00000000-0000-4000-f000-000000000001' and type = 'friend_checkin'),
  2, 'After 60 minutes a new notification starts'
);

-- A private check-in tells nobody, and imports stay quiet.
insert into public.event_checkins (id, user_id, event_id, client_uuid, visibility) values
  ('50000000-0000-4000-f000-000000000002', '00000000-0000-4000-f000-000000000002', '20000000-0000-4000-f000-000000000004', gen_random_uuid(), 'private');
select is(
  (select count(*)::int from public.notifications where recipient_id = '00000000-0000-4000-f000-000000000001' and payload ->> 'event' = 'Test Far Night'),
  0, 'A private check-in creates no notification'
);
insert into public.event_checkins (id, user_id, event_id, client_uuid, imported) values
  ('50000000-0000-4000-f000-000000000003', '00000000-0000-4000-f000-000000000002', '20000000-0000-4000-f000-000000000005', gen_random_uuid(), true);
select is(
  (select count(*)::int from public.notifications where payload ->> 'event' = 'Test Upcoming'),
  0, 'Imported history creates no notification'
);

-- More check-ins for the feeds -----------------------------------------------------------

insert into public.event_checkins (id, user_id, event_id, client_uuid, visibility, created_at) values
  ('50000000-0000-4000-f000-000000000010', '00000000-0000-4000-f000-000000000003', '20000000-0000-4000-f000-000000000001', gen_random_uuid(), null, now() - interval '10 hours'),
  ('50000000-0000-4000-f000-000000000011', '00000000-0000-4000-f000-000000000003', '20000000-0000-4000-f000-000000000004', gen_random_uuid(), null, now() - interval '2 hours'),
  ('50000000-0000-4000-f000-000000000012', '00000000-0000-4000-f000-000000000003', '20000000-0000-4000-f000-000000000002', gen_random_uuid(), null, now()),
  ('50000000-0000-4000-f000-000000000013', '00000000-0000-4000-f000-000000000003', '20000000-0000-4000-f000-000000000003', gen_random_uuid(), null, now()),
  ('50000000-0000-4000-f000-000000000014', '00000000-0000-4000-f000-000000000004', '20000000-0000-4000-f000-000000000001', gen_random_uuid(), 'public', now()),
  ('50000000-0000-4000-f000-000000000015', '00000000-0000-4000-f000-000000000005', '20000000-0000-4000-f000-000000000001', gen_random_uuid(), null, now()),
  ('50000000-0000-4000-f000-000000000016', '00000000-0000-4000-f000-000000000002', '20000000-0000-4000-f000-000000000002', gen_random_uuid(), null, now()),
  ('50000000-0000-4000-f000-000000000017', '00000000-0000-4000-f000-000000000001', '20000000-0000-4000-f000-000000000001', gen_random_uuid(), 'public', now() - interval '100 hours');
insert into public.media (owner_id, event_checkin_id, storage_path, moderation_status) values
  ('00000000-0000-4000-f000-000000000002', '50000000-0000-4000-f000-000000000001', 'test/feed-ok.webp', 'approved'),
  ('00000000-0000-4000-f000-000000000002', '50000000-0000-4000-f000-000000000001', 'test/feed-wait.webp', 'pending');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-f000-000000000001"}', true);

create temp table friends_ids on commit drop as
  select card ->> 'id' as id, card from jsonb_array_elements(public.get_friends_feed()) card;
create temp table public_ids on commit drop as
  select card ->> 'id' as id, card, ordinality from jsonb_array_elements(public.get_public_feed()) with ordinality as t(card, ordinality);

select ok(exists (select 1 from friends_ids where id = '50000000-0000-4000-f000-000000000001'), 'The friends feed has a friend''s check-in');
select ok(exists (select 1 from friends_ids where id = '50000000-0000-4000-f000-000000000017'), 'The friends feed has the user''s own check-in');
select ok(not exists (select 1 from friends_ids where id = '50000000-0000-4000-f000-000000000002'), 'The friends feed hides a friend''s private check-in');
select ok(not exists (select 1 from friends_ids where id = '50000000-0000-4000-f000-000000000003'), 'The friends feed hides imported history');
select ok(not exists (select 1 from friends_ids where id = '50000000-0000-4000-f000-000000000010'), 'The friends feed has no strangers');
select is(
  (select card -> 'event' ->> 'status' from friends_ids where id = '50000000-0000-4000-f000-000000000016'),
  'pending', 'A pending event shows in the friends feed, marked as pending'
);
select is(
  (select jsonb_array_length(card -> 'photos') from friends_ids where id = '50000000-0000-4000-f000-000000000001'),
  1, 'Cards show approved photos only'
);
select is((select card -> 'sets' -> 0 -> 'set_artists' -> 0 -> 'artist' ->> 'name' from friends_ids where id = '50000000-0000-4000-f000-000000000001'), 'Test Wish Artist', 'Cards list sets with their artists');
select ok(not (select card ? 'fun_facts' from friends_ids where id = '50000000-0000-4000-f000-000000000001'), 'Cards carry no fun facts');

select ok(exists (select 1 from public_ids where id = '50000000-0000-4000-f000-000000000010'), 'The public feed has public check-ins');
select ok(not exists (select 1 from public_ids where id = '50000000-0000-4000-f000-000000000012'), 'The public feed hides pending events');
select ok(not exists (select 1 from public_ids where id = '50000000-0000-4000-f000-000000000013'), 'The public feed hides cancelled events');
select ok(not exists (select 1 from public_ids where id = '50000000-0000-4000-f000-000000000014'), 'The public feed hides private profiles, even with a public check-in');
select ok(not exists (select 1 from public_ids where id = '50000000-0000-4000-f000-000000000015'), 'The public feed hides blocked users');
select ok(not exists (select 1 from public_ids where id = '50000000-0000-4000-f000-000000000001'), 'The public feed hides friends-only check-ins');
select ok(
  (select ordinality from public_ids where id = '50000000-0000-4000-f000-000000000010')
    < (select ordinality from public_ids where id = '50000000-0000-4000-f000-000000000011'),
  'A nearby check-in outranks a slightly newer one far away'
);

-- Reactions ------------------------------------------------------------------------------

select lives_ok(
  $$ insert into public.reactions (user_id, target_type, target_id, kind)
     values ((select auth.uid()), 'event_checkin', '50000000-0000-4000-f000-000000000001', 'fire')
     on conflict (user_id, target_type, target_id) do update set kind = excluded.kind $$,
  'A user can react'
);
select lives_ok(
  $$ insert into public.reactions (user_id, target_type, target_id, kind)
     values ((select auth.uid()), 'event_checkin', '50000000-0000-4000-f000-000000000001', 'bassface')
     on conflict (user_id, target_type, target_id) do update set kind = excluded.kind $$,
  'A reaction can be changed'
);
select lives_ok($$ select public.set_reaction('event_checkin', '50000000-0000-4000-f000-000000000001', 'dance') $$, 'set_reaction changes a reaction');
select lives_ok($$ select public.set_reaction('event_checkin', '50000000-0000-4000-f000-000000000001', 'bassface') $$, 'set_reaction changes it back');
select is((public.reaction_summary('event_checkin', '50000000-0000-4000-f000-000000000001') ->> 'mine'), 'bassface', 'The summary shows the user''s reaction');
select is((public.reaction_summary('event_checkin', '50000000-0000-4000-f000-000000000001') ->> 'bassface')::int, 1, 'There is one reaction per user');
select is((select count(*)::int from public.list_reactions('event_checkin', '50000000-0000-4000-f000-000000000001')), 1, 'The list of who reacted is visible');
select is((select username from public.list_reactions('event_checkin', '50000000-0000-4000-f000-000000000001')), 'test_feed_me', 'The list names the person');
select throws_ok(
  $$ insert into public.reactions (user_id, target_type, target_id, kind) values ((select auth.uid()), 'event_checkin', '50000000-0000-4000-f000-000000000002', 'fire') $$,
  '42501', null, 'Nobody can react to a check-in they cannot see'
);
select throws_ok($$ select public.upsert_notification((select auth.uid()), 'x', '{}') $$, '42501', null, 'Clients cannot create notifications');
reset role;

select is(
  (select count(*)::int from public.notifications where recipient_id = '00000000-0000-4000-f000-000000000002' and type = 'reaction'),
  1, 'A reaction notifies the owner, also when it is changed'
);

insert into public.friendships (user_a, user_b, requested_by) values ('00000000-0000-4000-f000-000000000001', '00000000-0000-4000-f000-000000000003', '00000000-0000-4000-f000-000000000003');
select is((select count(*)::int from public.notifications where recipient_id = '00000000-0000-4000-f000-000000000001' and type = 'friend_request'), 1, 'A friend request notifies the other person');

-- Tagging, going, wishlist ---------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-f000-000000000002"}', true);
select lives_ok(
  $$ insert into public.checkin_companions (event_checkin_id, user_id) values ('50000000-0000-4000-f000-000000000002', '00000000-0000-4000-f000-000000000001') $$,
  'A friend can be tagged, also on a private check-in'
);
insert into public.going (user_id, event_id) values ('00000000-0000-4000-f000-000000000002', '20000000-0000-4000-f000-000000000005');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-f000-000000000001"}', true);
select is(
  (public.tagged_checkin('50000000-0000-4000-f000-000000000002') ->> 'event_id'),
  '20000000-0000-4000-f000-000000000004', 'The tagged friend gets what they need to adopt it'
);
insert into public.going (user_id, event_id) values ('00000000-0000-4000-f000-000000000001', '20000000-0000-4000-f000-000000000005');
reset role;
select is(
  (select count(*)::int from public.notifications where recipient_id = '00000000-0000-4000-f000-000000000002' and type = 'friend_going'),
  1, 'A friend going to the same event notifies'
);
select is(
  (select count(*)::int from public.notifications where recipient_id = '00000000-0000-4000-f000-000000000001' and type = 'tagged'),
  1, 'Being tagged notifies'
);

insert into public.sets (id, event_id, status) values ('30000000-0000-4000-f000-000000000003', '20000000-0000-4000-f000-000000000005', 'pending');
insert into public.set_artists (set_id, artist_id) values ('30000000-0000-4000-f000-000000000003', '40000000-0000-4000-f000-000000000001');
update public.sets set status = 'approved' where id = '30000000-0000-4000-f000-000000000003';
select is(
  (select count(*)::int from public.notifications where recipient_id = '00000000-0000-4000-f000-000000000001' and type = 'wishlist' and payload ->> 'kind' = 'plays'),
  1, 'A wishlist artist playing nearby notifies, once approved'
);

select * from finish();
rollback;
