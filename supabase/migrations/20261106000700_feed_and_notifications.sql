-- Phase 5: feed, reactions, tagging, going, wishlist, notifications with bundling, push dispatch.
-- See docs/SPEC.md, "Feed & social" and "Notifications".
-- The relationship helpers only answer for the signed-in user, so everything here that looks
-- at third parties reads friendships and blocks directly.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

alter table public.notifications
  add column bundle_key text,
  add column updated_at timestamptz not null default now(),
  add column pushed_at timestamptz;

create index notifications_bundle on public.notifications (recipient_id, bundle_key, updated_at desc) where bundle_key is not null;
create index notifications_unpushed on public.notifications (created_at) where pushed_at is null;

alter table public.profiles add column notification_settings jsonb not null default '{}';
grant update (notification_settings) on public.profiles to authenticated;

-- Anything that existed before push is not news.
update public.notifications set pushed_at = now();

-- Bundling -----------------------------------------------------------------------------

-- A follow-up to the same thing within 60 minutes updates the existing notification. It goes
-- out again as an update of the same push, not as a new one.
create function public.upsert_notification(recipient uuid, kind text, payload jsonb, bundle text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing uuid;
begin
  if bundle is not null then
    select n.id into existing
      from public.notifications n
      where n.recipient_id = recipient and n.bundle_key = bundle and n.updated_at > now() - interval '60 minutes'
      order by n.updated_at desc
      limit 1;
  end if;
  if existing is not null then
    update public.notifications
      set payload = upsert_notification.payload, updated_at = now(), pushed_at = null, read_at = null
      where id = existing;
  else
    insert into public.notifications (recipient_id, type, payload, bundle_key)
    values (recipient, kind, payload, bundle);
  end if;
end;
$$;

create or replace function public.notify_decision(recipient uuid, kind text, payload jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.upsert_notification(recipient, kind, payload)
  where recipient is not null and recipient <> (select auth.uid());
$$;

-- Who may hear about a user's activity: accepted friends. A block ends a friendship.
create function public.friends_of(person uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case when f.user_a = person then f.user_b else f.user_a end
  from public.friendships f
  where person in (f.user_a, f.user_b) and f.status = 'accepted';
$$;

-- Friend checks in ----------------------------------------------------------------------

create function public.notify_friend_checkin(checkin_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  friend uuid;
  sets_count integer;
begin
  select ec.id, ec.user_id, ec.event_id, ec.imported, ec.visibility, e.name as event_name, p.display_name, p.username
    into c
    from public.event_checkins ec
    join public.events e on e.id = ec.event_id
    join public.profiles p on p.id = ec.user_id
    where ec.id = checkin_id;
  if not found or c.imported then
    return;
  end if;
  if coalesce(c.visibility, public.privacy_level(c.user_id, 'checkins')) = 'private' then
    return;
  end if;
  select count(*) into sets_count from public.set_checkins sc where sc.event_checkin_id = checkin_id;
  for friend in select public.friends_of(c.user_id) loop
    perform public.upsert_notification(
      friend,
      'friend_checkin',
      jsonb_build_object('actor', c.display_name, 'username', c.username, 'event_id', c.event_id, 'event', c.event_name, 'sets', sets_count, 'checkin_id', checkin_id),
      'checkin:' || c.user_id || ':' || c.event_id
    );
  end loop;
end;
$$;

create function public.on_event_checkin_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_friend_checkin(new.id);
  return new;
end;
$$;

create trigger event_checkins_notify after insert on public.event_checkins
  for each row execute function public.on_event_checkin_insert();

-- A friend saw an artist on someone's wishlist.
create function public.on_set_checkin_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
  private_checkin boolean;
  w record;
begin
  if new.imported then
    return new;
  end if;
  perform public.notify_friend_checkin(new.event_checkin_id);

  select ec.user_id, coalesce(ec.visibility, public.privacy_level(ec.user_id, 'checkins')) = 'private'
    into owner_id, private_checkin
    from public.event_checkins ec where ec.id = new.event_checkin_id;
  if private_checkin then
    return new;
  end if;
  for w in
    select wa.user_id, a.id as artist_id, a.name as artist, p.display_name as actor
      from public.set_artists sa
      join public.artists a on a.id = sa.artist_id
      join public.wishlist_artists wa on wa.artist_id = a.id
      join public.profiles p on p.id = owner_id
      where sa.set_id = new.set_id
        and wa.user_id in (select public.friends_of(owner_id))
  loop
    perform public.upsert_notification(
      w.user_id, 'wishlist',
      jsonb_build_object('kind', 'seen', 'artist', w.artist, 'artist_id', w.artist_id, 'actor', w.actor),
      'wishlist-seen:' || owner_id || ':' || w.artist_id
    );
  end loop;
  return new;
end;
$$;

create trigger set_checkins_notify after insert on public.set_checkins
  for each row execute function public.on_set_checkin_insert();

-- A wishlist artist plays nearby: in the user's home region or the city of their last check-in.
create function public.notify_wishlist_lineup(target_set uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  w record;
begin
  for w in
    select wa.user_id, a.id as artist_id, a.name as artist, e.id as event_id, e.name as event, v.city
      from public.sets s
      join public.events e on e.id = s.event_id
      join public.venues v on v.id = e.venue_id
      join public.set_artists sa on sa.set_id = s.id
      join public.artists a on a.id = sa.artist_id
      join public.wishlist_artists wa on wa.artist_id = a.id
      join public.profiles p on p.id = wa.user_id
      where s.id = target_set
        and s.status = 'approved'
        and e.status = 'approved'
        and e.lifecycle = 'scheduled'
        and coalesce(e.date_end, e.date_start) >= current_date
        and (
          lower(p.home_city) = lower(v.city)
          or lower(v.city) = lower((
            select v2.city from public.event_checkins c2
            join public.events e2 on e2.id = c2.event_id
            join public.venues v2 on v2.id = e2.venue_id
            where c2.user_id = wa.user_id
            order by e2.date_start desc limit 1
          ))
        )
        and not exists (
          select 1 from public.notifications n
          where n.recipient_id = wa.user_id and n.bundle_key = 'wishlist-plays:' || a.id || ':' || e.id
        )
  loop
    perform public.upsert_notification(
      w.user_id, 'wishlist',
      jsonb_build_object('kind', 'plays', 'artist', w.artist, 'artist_id', w.artist_id, 'event', w.event, 'event_id', w.event_id, 'city', w.city),
      'wishlist-plays:' || w.artist_id || ':' || w.event_id
    );
  end loop;
end;
$$;

create function public.on_set_artist_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_wishlist_lineup(new.set_id);
  return new;
end;
$$;
create trigger set_artists_notify after insert on public.set_artists
  for each row execute function public.on_set_artist_insert();

create function public.on_set_approved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_wishlist_lineup(new.id);
  return new;
end;
$$;
create trigger sets_approved_notify after update of status on public.sets
  for each row when (new.status = 'approved' and old.status <> 'approved')
  execute function public.on_set_approved();

-- Reactions, friend requests, tagging, going --------------------------------------------

create function public.on_reaction_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
  event_name text;
  event_id uuid;
  actor text;
  reactions integer;
begin
  if new.target_type = 'event_checkin' then
    select c.user_id, e.name, e.id into owner_id, event_name, event_id
      from public.event_checkins c join public.events e on e.id = c.event_id
      where c.id = new.target_id;
  else
    select c.user_id, e.name, e.id into owner_id, event_name, event_id
      from public.set_checkins sc
      join public.event_checkins c on c.id = sc.event_checkin_id
      join public.events e on e.id = c.event_id
      where sc.id = new.target_id;
  end if;
  if owner_id is null or owner_id = new.user_id then
    return new;
  end if;
  select p.display_name into actor from public.profiles p where p.id = new.user_id;
  select count(*) into reactions from public.reactions r where r.target_type = new.target_type and r.target_id = new.target_id;
  perform public.upsert_notification(
    owner_id, 'reaction',
    jsonb_build_object('actor', actor, 'kind', new.kind, 'event', event_name, 'event_id', event_id, 'count', reactions),
    'reaction:' || new.target_type || ':' || new.target_id
  );
  return new;
end;
$$;
create trigger reactions_notify after insert on public.reactions
  for each row execute function public.on_reaction_change();

create function public.on_friendship_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor record;
  other uuid := case when new.requested_by = new.user_a then new.user_b else new.user_a end;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    select p.display_name, p.username into actor from public.profiles p where p.id = new.requested_by;
    perform public.upsert_notification(other, 'friend_request', jsonb_build_object('actor', actor.display_name, 'username', actor.username));
  elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status <> 'accepted' then
    select p.display_name, p.username into actor from public.profiles p where p.id = other;
    perform public.upsert_notification(new.requested_by, 'friend_accepted', jsonb_build_object('actor', actor.display_name, 'username', actor.username));
  end if;
  return new;
end;
$$;
create trigger friendships_notify after insert or update of status on public.friendships
  for each row execute function public.on_friendship_change();

create function public.on_companion_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
begin
  select ec.user_id, e.id as event_id, e.name as event, p.display_name as actor
    into c
    from public.event_checkins ec
    join public.events e on e.id = ec.event_id
    join public.profiles p on p.id = ec.user_id
    where ec.id = new.event_checkin_id;
  perform public.upsert_notification(
    new.user_id, 'tagged',
    jsonb_build_object('actor', c.actor, 'event', c.event, 'event_id', c.event_id, 'checkin_id', new.event_checkin_id)
  );
  return new;
end;
$$;
create trigger companions_notify after insert on public.checkin_companions
  for each row execute function public.on_companion_insert();

create function public.on_going_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor text;
  event_name text;
  friend uuid;
begin
  select p.display_name into actor from public.profiles p where p.id = new.user_id;
  select e.name into event_name from public.events e where e.id = new.event_id;
  for friend in
    select g.user_id from public.going g
    where g.event_id = new.event_id and g.user_id <> new.user_id
      and g.user_id in (select public.friends_of(new.user_id))
  loop
    perform public.upsert_notification(
      friend, 'friend_going',
      jsonb_build_object('actor', actor, 'event', event_name, 'event_id', new.event_id),
      'going:' || new.event_id
    );
  end loop;
  return new;
end;
$$;
create trigger going_notify after insert on public.going
  for each row execute function public.on_going_insert();

-- Tagged friends see just enough of the check-in to adopt it, whatever its visibility.
create function public.tagged_checkin(checkin_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'event_id', ec.event_id,
    'set_ids', (select coalesce(jsonb_agg(sc.set_id), '[]') from public.set_checkins sc where sc.event_checkin_id = ec.id)
  )
  from public.event_checkins ec
  where ec.id = checkin_id
    and exists (
      select 1 from public.checkin_companions cc
      where cc.event_checkin_id = ec.id and cc.user_id = (select auth.uid())
    );
$$;

-- Reactions -----------------------------------------------------------------------------

create function public.reaction_summary(target public.reaction_target, target_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'bassface', count(*) filter (where r.kind = 'bassface'),
    'dance', count(*) filter (where r.kind = 'dance'),
    'fire', count(*) filter (where r.kind = 'fire'),
    'mine', max(r.kind::text) filter (where r.user_id = (select auth.uid()))
  )
  from public.reactions r
  where r.target_type = target and r.target_id = reaction_summary.target_id
    and not public.is_blocked_between(r.user_id, (select auth.uid()));
$$;

create function public.list_reactions(target public.reaction_target, target_id uuid)
returns table (username text, display_name text, avatar_path text, kind public.reaction_kind)
language sql
stable
security definer
set search_path = ''
as $$
  select p.username, p.display_name, p.avatar_path, r.kind
  from public.reactions r
  join public.profiles p on p.id = r.user_id
  where r.target_type = target and r.target_id = list_reactions.target_id
    and public.can_view_reaction_target(target, list_reactions.target_id)
    and not public.is_blocked_between(r.user_id, (select auth.uid()))
    and not p.hidden_for_review
  order by r.created_at desc;
$$;

-- Feed ---------------------------------------------------------------------------------

create function public.feed_card(checkin_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'created_at', c.created_at,
    'rating', c.rating,
    'rating_sound', c.rating_sound,
    'rating_crowd', c.rating_crowd,
    'rating_location', c.rating_location,
    'rating_lineup', c.rating_lineup,
    'text', c.text,
    'verified', c.verified_gps or c.verified_admin,
    'user', jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name, 'avatar_path', p.avatar_path),
    'event', jsonb_build_object(
      'id', e.id, 'name', e.name, 'date_start', e.date_start, 'date_end', e.date_end, 'status', e.status,
      'venue_name', v.name, 'venue_city', v.city
    ),
    'reactions', public.reaction_summary('event_checkin', c.id),
    'companions', (
      select coalesce(jsonb_agg(jsonb_build_object('username', cp.username, 'display_name', cp.display_name)), '[]')
      from public.checkin_companions cc
      join public.profiles cp on cp.id = cc.user_id
      where cc.event_checkin_id = c.id
        and not cp.hidden_for_review
        and not public.is_blocked_between(cp.id, (select auth.uid()))
    ),
    'photos', (
      select coalesce(jsonb_agg(m.storage_path), '[]')
      from public.media m
      where m.event_checkin_id = c.id
        and (
          m.owner_id = (select auth.uid())
          or (m.moderation_status = 'approved' and public.privacy_allows(m.owner_id, 'photos'))
        )
    ),
    'sets', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', sc.id,
        'rating', sc.rating,
        'text', sc.text,
        'status', s.status,
        'set_type', s.set_type,
        'set_artists', (
          select coalesce(jsonb_agg(jsonb_build_object('role', sa.role, 'artist', jsonb_build_object('id', a.id, 'name', a.name))), '[]')
          from public.set_artists sa join public.artists a on a.id = sa.artist_id
          where sa.set_id = s.id
        ),
        'reactions', public.reaction_summary('set_checkin', sc.id)
      ) order by sc.created_at), '[]')
      from public.set_checkins sc
      join public.sets s on s.id = sc.set_id
      where sc.event_checkin_id = c.id
    )
  )
  from public.event_checkins c
  join public.profiles p on p.id = c.user_id
  join public.events e on e.id = c.event_id
  join public.venues v on v.id = e.venue_id
  where c.id = checkin_id;
$$;

-- Friends: chronological, the user's own check-ins included. Pending events show here with a
-- label, as the spec asks. Imported history is old news and stays out of both feeds.
create function public.get_friends_feed(before_time timestamptz default null, page_size integer default 15)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(public.feed_card(x.id) order by x.created_at desc), '[]')
  from (
    select c.id, c.created_at
    from public.event_checkins c
    join public.events e on e.id = c.event_id
    join public.profiles p on p.id = c.user_id
    where (select public.has_profile())
      and not c.imported
      and e.lifecycle = 'scheduled'
      and e.status <> 'rejected'
      and (before_time is null or c.created_at < before_time)
      and (c.user_id = (select auth.uid()) or c.user_id in (select public.friends_of((select auth.uid()))))
      and not p.hidden_for_review
      and public.can_view_checkin(c.id)
    order by c.created_at desc
    limit least(page_size, 50)
  ) x;
$$;

-- Public: only public check-ins of approved events, ranked by recency and proximity. Being
-- nearby counts as much as being 48 hours newer. Nearby means the city of the user's last
-- check-in, or within 50 km of a rounded position, if they allow it.
create function public.get_public_feed(page_offset integer default 0, page_size integer default 15, near_lat double precision default null, near_lng double precision default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with my_city as (
    select v.city
    from public.event_checkins c
    join public.events e on e.id = c.event_id
    join public.venues v on v.id = e.venue_id
    where c.user_id = (select auth.uid())
    order by c.created_at desc, e.date_start desc
    limit 1
  ),
  ranked as (
    select c.id,
      extract(epoch from now() - c.created_at) / 3600
        - case
            when lower(v.city) = lower((select city from my_city)) then 48
            when near_lat is not null and near_lng is not null and v.lat is not null
              and public.distance_meters(near_lat, near_lng, v.lat, v.lng) < 50000 then 48
            else 0
          end as score
    from public.event_checkins c
    join public.events e on e.id = c.event_id
    join public.venues v on v.id = e.venue_id
    join public.profiles p on p.id = c.user_id
    where (select public.has_profile())
      and not c.imported
      and e.status = 'approved'
      and e.lifecycle = 'scheduled'
      and not p.hidden_for_review
      and public.privacy_level(c.user_id, 'profile') <> 'private'
      and coalesce(c.visibility, public.privacy_level(c.user_id, 'checkins')) = 'public'
      and not public.is_blocked_between(c.user_id, (select auth.uid()))
    order by score, c.id
    offset greatest(page_offset, 0)
    limit least(page_size, 50)
  )
  select coalesce(jsonb_agg(public.feed_card(r.id) order by r.score, r.id), '[]') from ranked r;
$$;

-- Push dispatch ------------------------------------------------------------------------

-- Runs every minute, and calls the send-push function only if something is waiting. Its URL
-- and secret live in the Vault, one set per project. Without them this does nothing.
create function public.dispatch_push()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  function_url text;
  shared_secret text;
begin
  if not exists (select 1 from public.notifications where pushed_at is null) then
    return;
  end if;
  select decrypted_secret into function_url from vault.decrypted_secrets where name = 'push_function_url';
  select decrypted_secret into shared_secret from vault.decrypted_secrets where name = 'push_shared_secret';
  if function_url is null or shared_secret is null then
    return;
  end if;
  perform net.http_post(
    url := function_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', shared_secret),
    body := '{}'::jsonb
  );
end;
$$;

select cron.schedule('dispatch-push', '* * * * *', 'select public.dispatch_push()');

-- Function access ----------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon;
grant execute on function public.keep_alive() to anon;
grant execute on function
  public.tagged_checkin(uuid),
  public.reaction_summary(public.reaction_target, uuid),
  public.list_reactions(public.reaction_target, uuid),
  public.get_friends_feed(timestamptz, integer),
  public.get_public_feed(integer, integer, double precision, double precision)
to authenticated;
-- These run inside other functions and triggers only.
revoke execute on function
  public.upsert_notification(uuid, text, jsonb, text),
  public.friends_of(uuid),
  public.notify_friend_checkin(uuid),
  public.notify_wishlist_lineup(uuid),
  public.feed_card(uuid),
  public.dispatch_push()
from authenticated;
grant execute on all functions in schema public to service_role;
