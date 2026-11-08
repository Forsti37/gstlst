-- Artist, venue and promoter pages: your own numbers, friends who were there, upcoming events,
-- and the check-ins anyone may see, as cards like in the feed.

-- Which check-ins belong to a page. For an artist that includes the sets of groups they are in.
create function public.entity_checkins(entity text, target uuid)
returns table (checkin_id uuid, user_id uuid, sets bigint, rating numeric, event_id uuid, event_date date)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.user_id, count(distinct sc.id), avg(sc.rating), e.id, e.date_start
  from public.event_checkins c
  join public.events e on e.id = c.event_id and e.lifecycle = 'scheduled' and e.status <> 'rejected'
  join public.set_checkins sc on sc.event_checkin_id = c.id
  join public.set_artists sa on sa.set_id = sc.set_id
  left join public.artist_members m on m.group_id = sa.artist_id
  where entity = 'artist' and (sa.artist_id = target or m.member_id = target)
  group by c.id, c.user_id, e.id, e.date_start
  union all
  select c.id, c.user_id, 0, c.rating, e.id, e.date_start
  from public.event_checkins c
  join public.events e on e.id = c.event_id and e.lifecycle = 'scheduled' and e.status <> 'rejected'
  where entity = 'venue' and e.venue_id = target
  union all
  select c.id, c.user_id, 0, c.rating, e.id, e.date_start
  from public.event_checkins c
  join public.events e on e.id = c.event_id and e.lifecycle = 'scheduled' and e.status <> 'rejected'
  join public.event_promoters ep on ep.event_id = e.id and ep.promoter_id = target
  where entity = 'promoter';
$$;

create function public.entity_is_visible(entity text, target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case entity
    when 'artist' then exists (select 1 from public.artists x where x.id = target and (x.status = 'approved' or x.created_by = (select auth.uid()) or public.is_staff()))
    when 'venue' then exists (select 1 from public.venues x where x.id = target and (x.status = 'approved' or x.created_by = (select auth.uid()) or public.is_staff()))
    when 'promoter' then exists (select 1 from public.promoters x where x.id = target and (x.status = 'approved' or x.created_by = (select auth.uid()) or public.is_staff()))
    else false
  end;
$$;

-- Cards of everyone whose check-in the viewer may see, newest first, history by its event date.
create function public.get_entity_checkins(entity text, target uuid, before_time timestamptz default null, page_size integer default 10)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(public.feed_card(x.id) order by x.feed_time desc, x.id), '[]')
  from (
    select c.id, public.feed_time(c.created_at, c.imported, e.date_start) as feed_time
    from public.entity_checkins(entity, target) ec
    join public.event_checkins c on c.id = ec.checkin_id
    join public.events e on e.id = c.event_id
    join public.profiles p on p.id = c.user_id
    where (select public.has_profile())
      and public.entity_is_visible(entity, target)
      and not p.hidden_for_review
      and public.can_view_checkin(c.id)
      and (before_time is null or public.feed_time(c.created_at, c.imported, e.date_start) < before_time)
    order by public.feed_time(c.created_at, c.imported, e.date_start) desc, c.id
    limit least(page_size, 30)
  ) x;
$$;

-- Your own numbers and the friends who were there too.
create function public.get_entity_personal(entity text, target uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select * from public.entity_checkins(entity, target) ec where ec.user_id = (select auth.uid())
  ),
  friends as (
    select ec.*
    from public.entity_checkins(entity, target) ec
    join public.friendships fr
      on fr.status = 'accepted'
      and fr.user_a = least(ec.user_id, (select auth.uid()))
      and fr.user_b = greatest(ec.user_id, (select auth.uid()))
    where ec.user_id <> (select auth.uid())
      and public.can_view_checkin(ec.checkin_id)
  )
  select jsonb_build_object(
    'count', (select case when entity = 'artist' then coalesce(sum(sets), 0) else count(*) end from mine),
    'avg_rating', (select round(avg(rating), 2) from mine),
    'last', (
      select to_jsonb(l) from (
        select e.id as event_id, e.name, e.date_start
        from mine
        join public.events e on e.id = mine.event_id
        order by e.date_start desc
        limit 1
      ) l
    ),
    'friends', (
      select coalesce(jsonb_agg(f order by f.times desc, f.display_name), '[]'::jsonb)
      from (
        select p.username, p.display_name, p.avatar_path,
          case when entity = 'artist' then sum(friends.sets) else count(*) end as times
        from friends
        join public.profiles p on p.id = friends.user_id and not p.hidden_for_review
        group by p.username, p.display_name, p.avatar_path
        limit 20
      ) f
    )
  )
  where (select public.has_profile()) and public.entity_is_visible(entity, target);
$$;

create function public.get_entity_upcoming(entity text, target uuid)
returns table (id uuid, name text, date_start date, date_end date, status public.entity_status, venue_name text, venue_city text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct e.id, e.name, e.date_start, e.date_end, e.status, v.name, v.city
  from public.events e
  join public.venues v on v.id = e.venue_id
  where (select public.has_profile())
    and public.entity_is_visible(entity, target)
    and e.lifecycle = 'scheduled'
    and e.date_start >= current_date
    and (e.status = 'approved' or e.created_by = (select auth.uid()))
    and case entity
      when 'venue' then e.venue_id = target
      when 'promoter' then exists (select 1 from public.event_promoters ep where ep.event_id = e.id and ep.promoter_id = target)
      when 'artist' then exists (
        select 1
        from public.sets s
        join public.set_artists sa on sa.set_id = s.id
        left join public.artist_members m on m.group_id = sa.artist_id
        where s.event_id = e.id and (sa.artist_id = target or m.member_id = target)
      )
      else false
    end
  order by e.date_start, e.name
  limit 10;
$$;

-- The numbers of a promoter across the app.
create function public.get_promoter_stats(target_promoter uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with their_events as (
    select e.*
    from public.events e
    join public.event_promoters ep on ep.event_id = e.id and ep.promoter_id = target_promoter
    where e.status = 'approved' and e.lifecycle = 'scheduled'
  )
  select jsonb_build_object(
    'events', (select count(*) from their_events),
    'checkins', (
      select count(*)
      from public.event_checkins c
      join their_events e on e.id = c.event_id
      where coalesce(c.visibility, public.privacy_level(c.user_id, 'stats')) <> 'private'
    ),
    'top_artists', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select a.id, a.name, count(distinct s.event_id) as events
        from their_events e
        join public.sets s on s.event_id = e.id and s.status = 'approved'
        join public.set_artists sa on sa.set_id = s.id
        join public.artists a on a.id = sa.artist_id and a.status = 'approved'
        group by a.id, a.name
        order by count(distinct s.event_id) desc, a.name
        limit 10
      ) t
    ),
    'venues', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select v.id, v.name, v.city, count(*) as events
        from their_events e
        join public.venues v on v.id = e.venue_id and v.status = 'approved'
        group by v.id, v.name, v.city
        order by count(*) desc, v.name
        limit 5
      ) t
    ),
    'series', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select s.id, s.name, count(*) as editions
        from their_events e
        join public.event_series s on s.id = e.series_id and s.status = 'approved'
        group by s.id, s.name
        order by count(*) desc, s.name
      ) t
    )
  )
  where (select public.has_profile()) and public.entity_is_visible('promoter', target_promoter);
$$;

revoke execute on function
  public.entity_checkins(text, uuid),
  public.entity_is_visible(text, uuid)
from public, anon, authenticated;
revoke execute on function
  public.get_entity_checkins(text, uuid, timestamptz, integer),
  public.get_entity_personal(text, uuid),
  public.get_entity_upcoming(text, uuid),
  public.get_promoter_stats(uuid)
from public, anon;
grant execute on function
  public.get_entity_checkins(text, uuid, timestamptz, integer),
  public.get_entity_personal(text, uuid),
  public.get_entity_upcoming(text, uuid),
  public.get_promoter_stats(uuid)
to authenticated, service_role;
