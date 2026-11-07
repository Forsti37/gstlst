-- Imported history belongs in the friends feed too, like on Untappd. It sorts by the date of
-- the event instead of the import, so that years of history don't land on top all at once.

create function public.feed_time(created_at timestamptz, imported boolean, event_date date)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select case when imported then least(created_at, event_date + time '12:00') else created_at end;
$$;

create or replace function public.feed_card(checkin_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'created_at', c.created_at,
    'imported', c.imported,
    'feed_time', public.feed_time(c.created_at, c.imported, e.date_start),
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
    'badges', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', d.id,
        'category', d.category,
        'level', u.level,
        'name', coalesce(d.rule -> 'level_names' ->> (u.level - 1), d.name)
      )), '[]')
      from public.user_badges u
      join public.badge_definitions d on d.id = u.badge_id
      where u.user_id = c.user_id
        and u.awarded_at between c.created_at and c.created_at + interval '10 minutes'
        and public.privacy_allows(c.user_id, 'badges')
    ),
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

create or replace function public.get_friends_feed(before_time timestamptz default null, page_size integer default 15)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(public.feed_card(x.id) order by x.feed_time desc, x.id), '[]')
  from (
    select c.id, public.feed_time(c.created_at, c.imported, e.date_start) as feed_time
    from public.event_checkins c
    join public.events e on e.id = c.event_id
    join public.profiles p on p.id = c.user_id
    where (select public.has_profile())
      and e.lifecycle = 'scheduled'
      and e.status <> 'rejected'
      and (before_time is null or public.feed_time(c.created_at, c.imported, e.date_start) < before_time)
      and (c.user_id = (select auth.uid()) or c.user_id in (select public.friends_of((select auth.uid()))))
      and not p.hidden_for_review
      and public.can_view_checkin(c.id)
    order by public.feed_time(c.created_at, c.imported, e.date_start) desc, c.id
    limit least(page_size, 50)
  ) x;
$$;

revoke execute on function public.feed_time(timestamptz, boolean, date) from public, anon;
grant execute on function public.feed_time(timestamptz, boolean, date) to authenticated, service_role;
