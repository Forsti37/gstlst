-- Phase 6: profile stats, explorer, leaderboards, comparison, artist and venue stats.
--
-- The facts live in a materialized view in their own schema, which the API doesn't expose: a
-- materialized view has no row level security, so clients must never reach it directly. All
-- access goes through the functions in public, which apply the viewer's rights row by row and
-- read visibility from the live tables, so that a changed setting works at once.

create schema stats;
revoke all on schema stats from public, anon, authenticated;

-- Maps a curated genre to its main genre and subgenre: Electronic > Drum & Bass > Neurofunk.
create view stats.genre_lineage as
select
  g.id,
  case when p.parent_id is not null then p.id when g.parent_id is not null then g.id end as main_id,
  case when p.parent_id is not null then g.id end as sub_id
from public.genres g
left join public.genres p on p.id = g.parent_id;

-- One row per set check-in, or one per event check-in without sets. fact_id makes the rows
-- unique, which a concurrent refresh needs.
create materialized view stats.facts as
select
  coalesce(sc.id, c.id) as fact_id,
  c.id as checkin_id,
  c.user_id,
  c.event_id,
  e.date_start as event_date,
  e.venue_id,
  v.name as venue_name,
  v.city,
  v.country_code::text as country_code,
  v.lat,
  v.lng,
  e.series_id,
  (e.status = 'approved' and v.status = 'approved') as event_approved,
  coalesce(s.status = 'approved', true) as set_approved,
  (c.verified_gps or c.verified_admin) as verified,
  sc.id as set_checkin_id,
  sc.set_id,
  s.set_type::text as set_type,
  sc.rating as set_rating,
  -- A B2B counts for everyone involved, a group set also for each member.
  array(
    select sa.artist_id from public.set_artists sa where sa.set_id = sc.set_id
    union
    select m.member_id
    from public.set_artists sa
    join public.artist_members m on m.group_id = sa.artist_id
    where sa.set_id = sc.set_id
  ) as artist_ids,
  -- The genres chosen in the check-in win over the artists' defaults.
  case
    when exists (select 1 from public.set_checkin_genres o where o.set_checkin_id = sc.id)
      then array(select o.genre_id from public.set_checkin_genres o where o.set_checkin_id = sc.id)
    else array(
      select distinct d.genre_id
      from public.set_artists sa
      join public.artist_default_genres d on d.artist_id = sa.artist_id
      where sa.set_id = sc.set_id
    )
  end as genre_ids,
  array(
    select t.tag_id from public.set_checkin_tags t where t.set_checkin_id = sc.id
    union
    select t.tag_id from public.event_event_tags t where t.event_id = e.id
  ) as tag_ids,
  array(select ep.promoter_id from public.event_promoters ep where ep.event_id = e.id) as promoter_ids
from public.event_checkins c
join public.events e on e.id = c.event_id and e.lifecycle = 'scheduled'
join public.venues v on v.id = e.venue_id
left join public.set_checkins sc on sc.event_checkin_id = c.id
left join public.sets s on s.id = sc.set_id;

create unique index facts_id on stats.facts (fact_id);
create index facts_user on stats.facts (user_id);
create index facts_event on stats.facts (event_id);
create index facts_venue on stats.facts (venue_id);
create index facts_artists on stats.facts using gin (artist_ids);

-- Refreshing ----------------------------------------------------------------------------

-- A refresh per write would slow down every check-in, and a check-in writes several rows. So
-- writes only leave a note, and the cron job refreshes within a minute.
create table stats.refresh_state (
  id boolean primary key default true check (id),
  dirty boolean not null default true,
  refreshed_at timestamptz
);
insert into stats.refresh_state default values;

create function stats.mark_dirty()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update stats.refresh_state set dirty = true where not dirty;
  return null;
end;
$$;

create trigger stats_dirty after insert or update or delete on public.event_checkins
  for each statement execute function stats.mark_dirty();
create trigger stats_dirty after insert or update or delete on public.set_checkins
  for each statement execute function stats.mark_dirty();
create trigger stats_dirty after insert or update or delete on public.set_checkin_genres
  for each statement execute function stats.mark_dirty();
create trigger stats_dirty after insert or update or delete on public.set_checkin_tags
  for each statement execute function stats.mark_dirty();
create trigger stats_dirty after insert or update or delete on public.set_artists
  for each statement execute function stats.mark_dirty();

create function stats.refresh_if_dirty()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Cleared first, so that a write during the refresh leaves the note for the next run.
  update stats.refresh_state set dirty = false, refreshed_at = now() where dirty;
  if found then
    refresh materialized view concurrently stats.facts;
  end if;
end;
$$;

select cron.schedule('stats-refresh', '* * * * *', 'select stats.refresh_if_dirty()');
-- Moderation and merges change master data without a note, so this catches up on them.
select cron.schedule('stats-refresh-hourly', '17 * * * *', 'update stats.refresh_state set dirty = true');

-- Who sees what -------------------------------------------------------------------------

-- The owner sees everything. Others need the area's setting, approved master data, and a
-- check-in that allows them: its own visibility if it has one, otherwise the area's.
create function stats.visible_facts(owner uuid, area text)
returns setof stats.facts
language sql
stable
security definer
set search_path = ''
as $$
  select f.*
  from stats.facts f
  join public.event_checkins c on c.id = f.checkin_id
  where f.user_id = owner
    and (f.set_checkin_id is null or exists (select 1 from public.set_checkins sc where sc.id = f.set_checkin_id))
    and (
      owner = (select auth.uid())
      or (
        f.event_approved
        and f.set_approved
        and public.privacy_allows(owner, area)
        and public.visibility_allows(owner, coalesce(c.visibility, public.privacy_level(owner, area)))
      )
    );
$$;

-- For app-wide numbers: everything that isn't private to its owner.
create function stats.shareable_facts()
returns setof stats.facts
language sql
stable
security definer
set search_path = ''
as $$
  select f.*
  from stats.facts f
  join public.event_checkins c on c.id = f.checkin_id
  where f.event_approved
    and f.set_approved
    and coalesce(c.visibility, public.privacy_level(f.user_id, 'stats')) <> 'private';
$$;

-- Top fans and residents: public profiles and public check-ins only, never someone blocked.
create function stats.is_public_fan(person uuid, visibility public.visibility)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.privacy_level(person, 'stats') = 'public'
    and coalesce(visibility, 'public') = 'public'
    and not public.is_blocked_between(person, (select auth.uid()));
$$;

-- Grouping ------------------------------------------------------------------------------

-- The whitelist of the explorer. Only these fixed branches ever run, so there is no dynamic SQL.
create function stats.fact_dim(f stats.facts, dimension text, own boolean)
returns table (key text, label text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id::text, a.name
  from unnest(f.artist_ids) as x (id)
  join public.artists a on a.id = x.id
  where dimension = 'artist' and (own or a.status = 'approved')
  union all
  select distinct g.id::text, g.name
  from unnest(f.genre_ids) as x (id)
  join stats.genre_lineage l on l.id = x.id
  join public.genres g on g.id = l.main_id
  where dimension = 'genre'
  union all
  select distinct g.id::text, g.name
  from unnest(f.genre_ids) as x (id)
  join stats.genre_lineage l on l.id = x.id
  join public.genres g on g.id = l.sub_id
  where dimension = 'subgenre'
  union all
  select f.venue_id::text, f.venue_name where dimension = 'venue'
  union all
  select f.city, f.city where dimension = 'city'
  union all
  select f.country_code, f.country_code where dimension = 'country'
  union all
  select p.id::text, p.name
  from unnest(f.promoter_ids) as x (id)
  join public.promoters p on p.id = x.id
  where dimension = 'promoter' and (own or p.status = 'approved')
  union all
  select s.id::text, s.name
  from public.event_series s
  where dimension = 'series' and s.id = f.series_id and (own or s.status = 'approved')
  union all
  select f.set_type, f.set_type where dimension = 'set_type' and f.set_type is not null
  union all
  select t.id::text, t.name
  from unnest(f.tag_ids) as x (id)
  join public.tags t on t.id = x.id
  where dimension = 'tag' and (own or t.status = 'approved')
  union all
  select to_char(f.event_date, 'YYYY-MM'), to_char(f.event_date, 'YYYY-MM') where dimension = 'month'
  union all
  select to_char(f.event_date, 'YYYY'), to_char(f.event_date, 'YYYY') where dimension = 'year'
  union all
  select to_char(f.event_date, 'ID'), to_char(f.event_date, 'ID') where dimension = 'weekday';
$$;

create function stats.is_dimension(dimension text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select dimension = any (array[
    'artist', 'genre', 'subgenre', 'venue', 'city', 'country', 'promoter', 'series',
    'set_type', 'tag', 'month', 'year', 'weekday'
  ]);
$$;

create function stats.aggregate(
  owner uuid,
  dimension text,
  date_from date default null,
  date_to date default null,
  filters jsonb default '{}',
  verified_only boolean default false,
  by_events boolean default false,
  max_rows integer default 200
)
returns table (key text, label text, events bigint, sets bigint, avg_rating numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select d.key, d.label, count(distinct f.event_id), count(distinct f.set_checkin_id), round(avg(f.set_rating), 2)
  from stats.visible_facts(owner, 'stats') f
  cross join lateral stats.fact_dim(f, dimension, owner = (select auth.uid())) d
  where (date_from is null or f.event_date >= date_from)
    and (date_to is null or f.event_date <= date_to)
    and (not verified_only or f.verified)
    and not exists (
      select 1
      from jsonb_each_text(coalesce(filters, '{}')) as wanted
      where not exists (
        select 1
        from stats.fact_dim(f, wanted.key, owner = (select auth.uid())) m
        where m.key = wanted.value
      )
    )
  group by d.key, d.label
  order by
    case when by_events then count(distinct f.event_id) else count(distinct f.set_checkin_id) end desc,
    case when by_events then count(distinct f.set_checkin_id) else count(distinct f.event_id) end desc,
    d.label
  limit max_rows;
$$;

create function stats.top(owner uuid, dimension text, by_events boolean, max_rows integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb)
  from stats.aggregate(owner, dimension, by_events => by_events, max_rows => max_rows) a;
$$;

create function stats.km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select 2 * 6371 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )));
$$;

-- The explorer --------------------------------------------------------------------------

create function public.explore_stats(
  target_user uuid,
  dimension text,
  date_from date default null,
  date_to date default null,
  filters jsonb default '{}',
  verified_only boolean default false
)
returns table (key text, label text, events bigint, sets bigint, avg_rating numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_profile() then
    return;
  end if;
  if not stats.is_dimension(dimension) then
    raise exception 'Unknown dimension' using errcode = 'invalid_parameter_value';
  end if;
  if jsonb_typeof(coalesce(filters, '{}')) <> 'object'
    or exists (select 1 from jsonb_object_keys(coalesce(filters, '{}')) as k where not stats.is_dimension(k)) then
    raise exception 'Unknown filter' using errcode = 'invalid_parameter_value';
  end if;
  return query
    select a.key, a.label, a.events, a.sets, a.avg_rating
    from stats.aggregate(target_user, dimension, date_from, date_to, filters, verified_only) a;
end;
$$;

-- The profile ---------------------------------------------------------------------------

-- Null means: not allowed to see these stats.
create function public.get_profile_stats(target_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  own boolean := target_user = (select auth.uid());
  checkin_count bigint;
  home record;
  km double precision;
  facts stats.facts[];
  result jsonb;
begin
  if not public.has_profile() or not (own or public.privacy_allows(target_user, 'stats')) then
    return null;
  end if;

  facts := array(select f from stats.visible_facts(target_user, 'stats') f);

  select count(distinct f.checkin_id) into checkin_count from unnest(facts) f;

  select jsonb_build_object(
    'events', count(distinct f.event_id),
    'sets', count(distinct f.set_checkin_id),
    'venues', count(distinct f.venue_id),
    'cities', count(distinct f.city),
    'countries', count(distinct f.country_code),
    'avg_rating', round(avg(f.set_rating), 2),
    'verified', count(distinct f.checkin_id) filter (where f.verified),
    'artists', (select count(distinct a) from unnest(facts) x, unnest(x.artist_ids) a),
    'promoters', (select count(distinct a) from unnest(facts) x, unnest(x.promoter_ids) a)
  ) into result
  from unnest(facts) f;

  result := jsonb_build_object(
    'headline', result,
    'genres', stats.top(target_user, 'genre', false, 12),
    'top_artists', stats.top(target_user, 'artist', false, 10),
    'top_venues', stats.top(target_user, 'venue', true, 10),
    'top_promoters', stats.top(target_user, 'promoter', true, 10),
    -- The combination is what was billed, so group members stay out of it.
    'b2b', (
      select coalesce(jsonb_agg(c), '[]'::jsonb)
      from (
        select combo.names as label, count(*) as sets
        from unnest(facts) f
        cross join lateral (
          select string_agg(distinct a.name, ' & ' order by a.name) as names, count(distinct a.id) as people
          from public.set_artists sa
          join public.artists a on a.id = sa.artist_id
          where sa.set_id = f.set_id and (own or a.status = 'approved')
        ) combo
        where f.set_type in ('b2b', 'b2b2b', 'f2f') and combo.people > 1
        group by combo.names
        order by count(*) desc, combo.names
        limit 10
      ) c
    ),
    'calendar', (
      select coalesce(jsonb_agg(d order by d.date), '[]'::jsonb)
      from (
        select f.event_date as date, count(distinct f.event_id) as events
        from unnest(facts) f
        group by f.event_date
      ) d
    ),
    'streaks', (
      with weekends as (
        select distinct date_trunc('week', f.event_date)::date as week
        from unnest(facts) f
        where extract(isodow from f.event_date) in (5, 6, 7)
      ),
      runs as (
        select count(*) as length, max(week) as last_week
        from (select week, week - (row_number() over (order by week))::int * 7 as run from weekends) w
        group by run
      )
      select jsonb_build_object(
        'longest', coalesce(max(length), 0),
        'current', coalesce(max(length) filter (where last_week >= date_trunc('week', current_date)::date - 7), 0)
      )
      from runs
    )
  );

  -- Coordinates come from the venues of the home city, so nothing needs a geocoding service.
  -- Only the rounded total ever leaves this function, so the home location can't be inferred.
  select avg(v.lat) as lat, avg(v.lng) as lng into home
  from public.profiles p
  join public.venues v on lower(v.city) = lower(p.home_city) and v.status = 'approved' and v.lat is not null
  where p.id = target_user;

  if checkin_count >= 10 and home.lat is not null then
    select sum(2 * stats.km(home.lat, home.lng, e.lat, e.lng)) into km
    from (select distinct f.event_id, f.lat, f.lng from unnest(facts) f where f.lat is not null) e;
    result := result || jsonb_build_object('travel_km', round(coalesce(km, 0) / 10) * 10);
  else
    result := result || jsonb_build_object('travel_km', null);
    if own then
      result := result || jsonb_build_object(
        'travel_missing', case when checkin_count < 10 then 'checkins' else 'home' end
      );
    end if;
  end if;
  return result;
end;
$$;

-- The map has its own privacy setting.
create function public.get_profile_map(target_user uuid)
returns table (venue_id uuid, name text, city text, lat double precision, lng double precision, events bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select f.venue_id, f.venue_name, f.city, f.lat, f.lng, count(distinct f.event_id)
  from stats.visible_facts(target_user, 'map') f
  where public.has_profile() and f.lat is not null and f.lng is not null
  group by f.venue_id, f.venue_name, f.city, f.lat, f.lng;
$$;

-- Friends -------------------------------------------------------------------------------

-- Verified check-ins only, so that the ranking can't be won by typing.
create function public.friends_leaderboard(for_year integer default null)
returns table (user_id uuid, username text, display_name text, avatar_path text, events bigint, sets bigint, artists bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id, p.username, p.display_name, p.avatar_path,
    coalesce(n.events, 0), coalesce(n.sets, 0), coalesce(n.artists, 0)
  from public.profiles p
  left join lateral (
    select
      count(distinct f.event_id) as events,
      count(distinct f.set_checkin_id) as sets,
      (
        select count(distinct a)
        from stats.visible_facts(p.id, 'stats') x, unnest(x.artist_ids) a
        where x.verified and (for_year is null or extract(year from x.event_date) = for_year)
      ) as artists
    from stats.visible_facts(p.id, 'stats') f
    where f.verified and (for_year is null or extract(year from f.event_date) = for_year)
  ) n on true
  where public.has_profile()
    and (
      p.id = (select auth.uid())
      or (
        exists (
          select 1
          from public.friendships fr
          where fr.status = 'accepted'
            and fr.user_a = least(p.id, (select auth.uid()))
            and fr.user_b = greatest(p.id, (select auth.uid()))
        )
        and public.privacy_allows(p.id, 'stats')
      )
    )
  order by coalesce(n.events, 0) desc, coalesce(n.sets, 0) desc, p.display_name;
$$;

-- Taste match is the cosine similarity of how often each of you has seen each artist: 100
-- means the same taste in the same proportions, however different the totals are.
create function public.compare_with(target_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select * from stats.visible_facts((select auth.uid()), 'stats')
  ),
  theirs as (
    select * from stats.visible_facts(target_user, 'stats')
  ),
  my_artists as (
    select a as artist_id, count(*)::double precision as n from mine, unnest(mine.artist_ids) a group by a
  ),
  their_artists as (
    select a as artist_id, count(*)::double precision as n from theirs, unnest(theirs.artist_ids) a group by a
  ),
  norms as (
    select
      (select sqrt(sum(n * n)) from my_artists) as mine,
      (select sqrt(sum(n * n)) from their_artists) as theirs
  )
  select jsonb_build_object(
    'events_together', (select count(distinct m.event_id) from mine m join theirs t on t.event_id = m.event_id),
    'sets_together', (select count(distinct m.set_id) from mine m join theirs t on t.set_id = m.set_id),
    'taste_match', (
      select round((100 * sum(m.n * t.n) / nullif((select norms.mine * norms.theirs from norms), 0))::numeric)
      from my_artists m
      join their_artists t on t.artist_id = m.artist_id
    ),
    'shared_artists', (
      select coalesce(jsonb_agg(s), '[]'::jsonb)
      from (
        select a.id, a.name, m.n::integer as mine, t.n::integer as theirs
        from my_artists m
        join their_artists t on t.artist_id = m.artist_id
        join public.artists a on a.id = m.artist_id and a.status = 'approved'
        order by least(m.n, t.n) desc, m.n + t.n desc, a.name
        limit 5
      ) s
    )
  )
  where public.has_profile()
    and target_user <> (select auth.uid())
    and public.privacy_allows(target_user, 'stats');
$$;

-- Artists and venues --------------------------------------------------------------------

create function public.get_artist_stats(target_artist uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with shared as (
    select * from stats.shareable_facts() f where target_artist = any (f.artist_ids)
  ),
  mine as (
    select * from stats.visible_facts((select auth.uid()), 'stats') f where target_artist = any (f.artist_ids)
  )
  select jsonb_build_object(
    'checkins', (select count(distinct set_checkin_id) from shared),
    'avg_rating', (select round(avg(set_rating), 2) from shared),
    'my_sets', (select count(distinct set_checkin_id) from mine),
    'my_avg_rating', (select round(avg(set_rating), 2) from mine),
    'aliases', (
      select coalesce(jsonb_agg(al.alias order by al.alias), '[]'::jsonb)
      from public.artist_aliases al
      where al.artist_id = target_artist
    ),
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name) order by m.name), '[]'::jsonb)
      from public.artist_members am
      join public.artists m on m.id = am.member_id and m.status = 'approved'
      where am.group_id = target_artist
    ),
    'groups', (
      select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name) order by g.name), '[]'::jsonb)
      from public.artist_members am
      join public.artists g on g.id = am.group_id and g.status = 'approved'
      where am.member_id = target_artist
    ),
    'genres', (
      select coalesce(jsonb_agg(g.name order by g.name), '[]'::jsonb)
      from public.artist_default_genres d
      join public.genres g on g.id = d.genre_id
      where d.artist_id = target_artist
    ),
    'partners', (
      select coalesce(jsonb_agg(p), '[]'::jsonb)
      from (
        select other.id, other.name, count(distinct s.id) as sets
        from public.set_artists me
        join public.sets s on s.id = me.set_id and s.status = 'approved' and s.set_type in ('b2b', 'b2b2b', 'f2f')
        join public.set_artists sa on sa.set_id = s.id and sa.artist_id <> target_artist
        join public.artists other on other.id = sa.artist_id and other.status = 'approved'
        where me.artist_id = target_artist
        group by other.id, other.name
        order by count(distinct s.id) desc, other.name
        limit 5
      ) p
    ),
    'top_fans', (
      select coalesce(jsonb_agg(fan), '[]'::jsonb)
      from (
        select p.username, p.display_name, p.avatar_path, count(distinct f.set_checkin_id) as sets
        from shared f
        join public.event_checkins c on c.id = f.checkin_id
        join public.profiles p on p.id = f.user_id
        where stats.is_public_fan(f.user_id, c.visibility)
        group by p.username, p.display_name, p.avatar_path
        order by count(distinct f.set_checkin_id) desc, p.display_name
        limit 5
      ) fan
    )
  )
  where public.has_profile()
    and exists (
      select 1
      from public.artists a
      where a.id = target_artist
        and (a.status = 'approved' or a.created_by = (select auth.uid()) or public.is_staff())
    );
$$;

-- A venue needs two ratings to rank, so that one person's opinion isn't the "best sound".
create function stats.sound_ranking()
returns table (venue_id uuid, name text, city text, avg_sound numeric, ratings bigint, rank bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.name, r.city, r.avg_sound, r.ratings, rank() over (order by r.avg_sound desc)
  from (
    select v.id, v.name, v.city, round(avg(c.rating_sound), 2) as avg_sound, count(c.rating_sound) as ratings
    from public.event_checkins c
    join public.events e on e.id = c.event_id and e.status = 'approved' and e.lifecycle = 'scheduled'
    join public.venues v on v.id = e.venue_id and v.status = 'approved'
    where coalesce(c.visibility, public.privacy_level(c.user_id, 'stats')) <> 'private'
    group by v.id, v.name, v.city
    having count(c.rating_sound) >= 2
  ) r;
$$;

create function public.best_sound_ranking()
returns table (venue_id uuid, name text, city text, avg_sound numeric, ratings bigint, rank bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select r.venue_id, r.name, r.city, r.avg_sound, r.ratings, r.rank
  from stats.sound_ranking() r
  where public.has_profile()
  order by r.rank, r.name
  limit 50;
$$;

create function public.get_venue_stats(target_venue uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with ratings as (
    select c.user_id, c.visibility, c.rating, c.rating_sound, c.rating_crowd, c.rating_location, c.rating_lineup
    from public.event_checkins c
    join public.events e on e.id = c.event_id and e.status = 'approved' and e.lifecycle = 'scheduled'
    where e.venue_id = target_venue
      and coalesce(c.visibility, public.privacy_level(c.user_id, 'stats')) <> 'private'
  )
  select jsonb_build_object(
    'checkins', (select count(*) from ratings),
    'my_events', (select count(distinct f.event_id) from stats.visible_facts((select auth.uid()), 'stats') f where f.venue_id = target_venue),
    'averages', (
      select jsonb_build_object(
        'overall', round(avg(rating), 2),
        'sound', round(avg(rating_sound), 2),
        'crowd', round(avg(rating_crowd), 2),
        'location', round(avg(rating_location), 2),
        'lineup', round(avg(rating_lineup), 2)
      )
      from ratings
    ),
    'sound_rank', (select r.rank from stats.sound_ranking() r where r.venue_id = target_venue),
    'top_artists', (
      select coalesce(jsonb_agg(t), '[]'::jsonb)
      from (
        select a.id, a.name, count(distinct f.set_checkin_id) as sets
        from stats.shareable_facts() f
        cross join lateral unnest(f.artist_ids) as x (id)
        join public.artists a on a.id = x.id and a.status = 'approved'
        where f.venue_id = target_venue
        group by a.id, a.name
        order by count(distinct f.set_checkin_id) desc, a.name
        limit 10
      ) t
    ),
    'resident', (
      select to_jsonb(r)
      from (
        select p.username, p.display_name, p.avatar_path, count(*) as checkins
        from public.event_checkins c
        join public.events e on e.id = c.event_id and e.status = 'approved' and e.lifecycle = 'scheduled'
        join public.profiles p on p.id = c.user_id
        where e.venue_id = target_venue and stats.is_public_fan(c.user_id, c.visibility)
        group by p.username, p.display_name, p.avatar_path
        order by count(*) desc, p.display_name
        limit 1
      ) r
    )
  )
  where public.has_profile()
    and exists (
      select 1
      from public.venues v
      where v.id = target_venue
        and (v.status = 'approved' or v.created_by = (select auth.uid()) or public.is_staff())
    );
$$;

-- Function access -----------------------------------------------------------------------

revoke execute on all functions in schema stats from public, anon, authenticated;
revoke execute on function
  public.explore_stats(uuid, text, date, date, jsonb, boolean),
  public.get_profile_stats(uuid),
  public.get_profile_map(uuid),
  public.friends_leaderboard(integer),
  public.compare_with(uuid),
  public.get_artist_stats(uuid),
  public.best_sound_ranking(),
  public.get_venue_stats(uuid)
from public, anon;
grant execute on function
  public.explore_stats(uuid, text, date, date, jsonb, boolean),
  public.get_profile_stats(uuid),
  public.get_profile_map(uuid),
  public.friends_leaderboard(integer),
  public.compare_with(uuid),
  public.get_artist_stats(uuid),
  public.best_sound_ranking(),
  public.get_venue_stats(uuid)
to authenticated, service_role;
