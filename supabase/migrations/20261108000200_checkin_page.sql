-- Cards link to the venue and the promoters, and a single check-in can be opened on its own page.

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
      'venue_id', v.id, 'venue_name', v.name, 'venue_city', v.city,
      'promoters', (
        select coalesce(jsonb_agg(jsonb_build_object('id', pr.id, 'name', pr.name) order by pr.name), '[]')
        from public.event_promoters ep
        join public.promoters pr on pr.id = ep.promoter_id
        where ep.event_id = e.id and (pr.status = 'approved' or pr.created_by = (select auth.uid()))
      )
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

-- One card, for the check-in page. Null when the viewer may not see it.
create function public.get_checkin_card(target_checkin uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.feed_card(c.id)
  from public.event_checkins c
  join public.profiles p on p.id = c.user_id
  where c.id = target_checkin
    and (select public.has_profile())
    and (not p.hidden_for_review or c.user_id = (select auth.uid()))
    and public.can_view_checkin(c.id);
$$;

revoke execute on function public.get_checkin_card(uuid) from public, anon;
grant execute on function public.get_checkin_card(uuid) to authenticated, service_role;

-- Reactions --------------------------------------------------------------------------------

-- The parameter "id" was shadowed by the column of the same name, so the subquery compared
-- every set check-in with itself and failed as soon as there was more than one. Every reaction
-- on a set failed with a server error, which the app took for bad reception and kept retrying.
create or replace function public.can_view_reaction_target(target public.reaction_target, id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case target
    when 'event_checkin' then public.can_view_checkin(can_view_reaction_target.id)
    else public.can_view_checkin((
      select s.event_checkin_id from public.set_checkins s where s.id = can_view_reaction_target.id
    ))
  end;
$$;

-- Like on Untappd, you don't react to your own check-ins. A tap that still arrives, for example
-- from an older version of the app or the offline queue, is ignored instead of failing.
create or replace function public.set_reaction(target public.reaction_target, target_id uuid, kind public.reaction_kind)
returns void
language sql
set search_path = ''
as $$
  insert into public.reactions (user_id, target_type, target_id, kind)
  select (select auth.uid()), target, set_reaction.target_id, set_reaction.kind
  where not exists (
    select 1
    from public.event_checkins c
    left join public.set_checkins sc on sc.event_checkin_id = c.id and sc.id = set_reaction.target_id
    where c.user_id = (select auth.uid())
      and (
        (target = 'event_checkin' and c.id = set_reaction.target_id)
        or (target = 'set_checkin' and sc.id is not null)
      )
  )
  on conflict (user_id, target_type, target_id) do update set kind = excluded.kind;
$$;

-- Reactions people already left on their own check-ins.
delete from public.reactions r
using public.event_checkins c
where r.target_type = 'event_checkin' and r.target_id = c.id and c.user_id = r.user_id;
delete from public.reactions r
using public.set_checkins sc
join public.event_checkins c on c.id = sc.event_checkin_id
where r.target_type = 'set_checkin' and r.target_id = sc.id and c.user_id = r.user_id;
