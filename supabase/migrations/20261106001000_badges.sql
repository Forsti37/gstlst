-- Phase 7: badge rule engine and fun facts.
--
-- Rules are JSON in public.badge_definitions, so that the admin can change them without code.
-- Writes only leave a note in badges.dirty. The note is processed right after a check-in (the
-- client calls evaluate_my_badges at the end of its batch) and by a cron job for everything
-- else. Evaluating only the rules of the noted scope keeps this cheap.

create schema badges;
revoke all on schema badges from public, anon, authenticated;

alter table public.badge_definitions add column description_de text;

-- Facts, always current ------------------------------------------------------------------

-- Each genre with its own slug and those of its ancestors, so that "drum-and-bass" also
-- matches a neurofunk set.
create view badges.genre_paths as
with recursive path as (
  select g.id, g.parent_id, array[g.slug] as slugs, 0 as depth from public.genres g where g.parent_id is null
  union all
  select g.id, g.parent_id, p.slugs || g.slug, p.depth + 1 from public.genres g join path p on p.id = g.parent_id
)
select id, slugs, depth from path;

-- Unlike stats.facts this reads the tables directly, because a new badge can't wait for a
-- refresh. One row per set check-in, or one per event check-in without sets.
create view badges.facts as
select
  coalesce(sc.id, c.id) as fact_id,
  c.id as checkin_id,
  c.user_id,
  c.event_id,
  c.created_at,
  e.date_start as event_date,
  e.date_end,
  e.venue_id,
  v.city,
  v.country_code::text as country,
  v.lat,
  v.lng,
  v.venue_type::text as venue_type,
  e.series_id,
  (c.verified_gps or c.verified_admin) as verified,
  sc.id as set_checkin_id,
  sc.set_id,
  s.set_type::text as set_type,
  sc.rating,
  -- A set after midnight still belongs to the night before.
  coalesce(((s.start_at at time zone 'Europe/Vienna') - interval '12 hours')::date, e.date_start) as night,
  array(select sa.artist_id from public.set_artists sa where sa.set_id = sc.set_id) as named_artist_ids,
  array(
    select sa.artist_id from public.set_artists sa where sa.set_id = sc.set_id
    union
    select m.member_id
    from public.set_artists sa
    join public.artist_members m on m.group_id = sa.artist_id
    where sa.set_id = sc.set_id
  ) as artist_ids,
  exists (select 1 from public.set_artists sa where sa.set_id = sc.set_id and sa.role = 'mc') as has_mc,
  array(
    select distinct slug
    from unnest(genres.ids) as x (id)
    join badges.genre_paths gp on gp.id = x.id
    cross join lateral unnest(gp.slugs) as slug
  ) as genre_slugs,
  array(
    select distinct gp.id
    from unnest(genres.ids) as x (id)
    join badges.genre_paths gp on gp.id = x.id
    where gp.depth >= 2
  ) as subgenre_ids,
  array(
    select lower(t.name)
    from public.set_checkin_tags sct
    join public.tags t on t.id = sct.tag_id
    where sct.set_checkin_id = sc.id
  ) as set_tags,
  array(
    select lower(t.name)
    from public.event_event_tags eet
    join public.tags t on t.id = eet.tag_id
    where eet.event_id = e.id
  ) as event_tags,
  array(select ep.promoter_id from public.event_promoters ep where ep.event_id = e.id) as promoter_ids
from public.event_checkins c
join public.events e on e.id = c.event_id and e.lifecycle = 'scheduled' and e.status <> 'rejected'
join public.venues v on v.id = e.venue_id
left join public.set_checkins sc on sc.event_checkin_id = c.id
left join public.sets s on s.id = sc.set_id
left join lateral (
  -- The genres chosen in the check-in win over the artists' defaults.
  select case
    when exists (select 1 from public.set_checkin_genres o where o.set_checkin_id = sc.id)
      then array(select o.genre_id from public.set_checkin_genres o where o.set_checkin_id = sc.id)
    else array(
      select distinct d.genre_id
      from public.set_artists sa
      join public.artist_default_genres d on d.artist_id = sa.artist_id
      where sa.set_id = sc.set_id
    )
  end as ids
) genres on true;

-- Rules ---------------------------------------------------------------------------------

create function badges.custom_names()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'double_header', 'marathon', 'series_years', 'duo_completionist', 'digger', 'called_it',
    'local_support', 'crew_love', 'plus_one', 'hype_machine', 'crowd_favourite', 'data_hero',
    'timetable_wizard', 'account_created', 'wrapped_shared'
  ];
$$;

-- Rejects a rule before it can reach the engine, with a message for the editor.
create function badges.validate_rule(rule jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  levels jsonb := rule -> 'levels';
  previous numeric := 0;
  threshold jsonb;
begin
  if jsonb_typeof(rule) is distinct from 'object' then
    raise exception 'The rule must be a JSON object' using errcode = 'invalid_parameter_value';
  end if;
  if exists (
    select 1 from jsonb_object_keys(rule) k
    where k not in ('metric', 'subject', 'scope', 'filter', 'window', 'levels', 'level_names', 'custom', 'unit')
  ) then
    raise exception 'The rule has an unknown key' using errcode = 'invalid_parameter_value';
  end if;
  if jsonb_typeof(levels) is distinct from 'array' or jsonb_array_length(levels) = 0 then
    raise exception 'levels must be a list of thresholds' using errcode = 'invalid_parameter_value';
  end if;
  for threshold in select jsonb_array_elements(levels) loop
    if jsonb_typeof(threshold) <> 'number' or threshold::numeric <= previous or threshold::numeric <> trunc(threshold::numeric) then
      raise exception 'levels must be whole numbers in ascending order' using errcode = 'invalid_parameter_value';
    end if;
    previous := threshold::numeric;
  end loop;
  if rule ? 'level_names' and (
    jsonb_typeof(rule -> 'level_names') <> 'array'
    or jsonb_array_length(rule -> 'level_names') <> jsonb_array_length(levels)
  ) then
    raise exception 'level_names needs one name per level' using errcode = 'invalid_parameter_value';
  end if;
  if rule ? 'scope' and rule ->> 'scope' not in ('checkins', 'reactions', 'community') then
    raise exception 'Unknown scope' using errcode = 'invalid_parameter_value';
  end if;
  if rule ? 'custom' then
    if not (rule ->> 'custom' = any (badges.custom_names())) then
      raise exception 'Unknown custom rule' using errcode = 'invalid_parameter_value';
    end if;
    return;
  end if;
  if coalesce(rule ->> 'metric', '') not in ('count', 'count_distinct', 'max_count', 'streak', 'same_night', 'exists') then
    raise exception 'Unknown metric' using errcode = 'invalid_parameter_value';
  end if;
  if rule ->> 'metric' = 'streak' then
    if coalesce(rule ->> 'unit', '') not in ('weekend', 'day') then
      raise exception 'A streak needs the unit weekend or day' using errcode = 'invalid_parameter_value';
    end if;
  elsif rule ->> 'metric' <> 'exists'
    and coalesce(rule ->> 'subject', '') not in ('event', 'set', 'artist', 'venue', 'city', 'country', 'promoter', 'series', 'genre', 'subgenre', 'year') then
    raise exception 'Unknown subject' using errcode = 'invalid_parameter_value';
  end if;
  if rule ? 'filter' and (
    jsonb_typeof(rule -> 'filter') <> 'object'
    or exists (
      select 1 from jsonb_object_keys(rule -> 'filter') k
      where k not in (
        'genre', 'tag', 'event_tag', 'set_type', 'venue_type', 'weekday', 'month', 'date', 'city',
        'min_distance_km', 'verified_only', 'artist_id', 'series_id', 'venue_id', 'event_id', 'role'
      )
    )
  ) then
    raise exception 'The filter has an unknown key' using errcode = 'invalid_parameter_value';
  end if;
  if rule ? 'window' and coalesce(rule -> 'window' ->> 'type', '') not in ('all_time', 'calendar_year', 'rolling', 'fixed') then
    raise exception 'Unknown window' using errcode = 'invalid_parameter_value';
  end if;
end;
$$;

create function badges.check_definition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform badges.validate_rule(new.rule);
  return new;
end;
$$;

create trigger badge_definitions_valid before insert or update of rule on public.badge_definitions
  for each row execute function badges.check_definition();

-- A filter value is one value or a list of them.
create function badges.in_list(value text, allowed jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value is not null and case jsonb_typeof(allowed)
    when 'array' then exists (select 1 from jsonb_array_elements_text(allowed) as a (item) where lower(a.item) = lower(value))
    else lower(allowed #>> '{}') = lower(value)
  end;
$$;

create function badges.any_in_list(values_ text[], allowed jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select exists (select 1 from unnest(values_) as v (item) where badges.in_list(v.item, allowed));
$$;

create function badges.matches_date(d date, wanted jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  -- "12-31", or a range that may wrap around the new year.
  select case
    when jsonb_typeof(wanted) = 'string' then to_char(d, 'MM-DD') = wanted #>> '{}'
    when wanted ->> 'from' <= wanted ->> 'to' then to_char(d, 'MM-DD') between wanted ->> 'from' and wanted ->> 'to'
    else to_char(d, 'MM-DD') >= wanted ->> 'from' or to_char(d, 'MM-DD') <= wanted ->> 'to'
  end;
$$;

create function badges.in_window(d date, wanted jsonb)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case coalesce(wanted ->> 'type', 'all_time')
    when 'calendar_year' then extract(year from d) = extract(year from current_date)
    when 'rolling' then d >= current_date - (wanted ->> 'days')::int
    when 'fixed' then (wanted ->> 'from' is null or d >= (wanted ->> 'from')::date) and (wanted ->> 'to' is null or d <= (wanted ->> 'to')::date)
    else true
  end;
$$;

create function badges.km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
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

create function badges.matches(f badges.facts, wanted jsonb, home_lat double precision, home_lng double precision)
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    (wanted is null or wanted = '{}'::jsonb)
    or (
      (coalesce(wanted ->> 'verified_only', 'false') <> 'true' or f.verified)
      and (not wanted ? 'genre' or badges.any_in_list(f.genre_slugs, wanted -> 'genre'))
      and (not wanted ? 'tag' or badges.any_in_list(f.set_tags, wanted -> 'tag'))
      and (not wanted ? 'event_tag' or badges.any_in_list(f.event_tags, wanted -> 'event_tag'))
      and (not wanted ? 'set_type' or badges.in_list(f.set_type, wanted -> 'set_type'))
      and (not wanted ? 'venue_type' or badges.in_list(f.venue_type, wanted -> 'venue_type'))
      and (not wanted ? 'weekday' or badges.in_list(extract(isodow from f.event_date)::text, wanted -> 'weekday'))
      and (not wanted ? 'month' or badges.in_list(extract(month from f.event_date)::text, wanted -> 'month'))
      and (not wanted ? 'date' or badges.matches_date(f.event_date, wanted -> 'date'))
      and (not wanted ? 'city' or badges.in_list(f.city, wanted -> 'city'))
      and (not wanted ? 'artist_id' or (wanted ->> 'artist_id')::uuid = any (f.artist_ids))
      and (not wanted ? 'series_id' or f.series_id = (wanted ->> 'series_id')::uuid)
      and (not wanted ? 'venue_id' or f.venue_id = (wanted ->> 'venue_id')::uuid)
      and (not wanted ? 'event_id' or f.event_id = (wanted ->> 'event_id')::uuid)
      and (wanted ->> 'role' is distinct from 'mc' or f.has_mc)
      and (
        not wanted ? 'min_distance_km'
        or (
          home_lat is not null and f.lat is not null
          and badges.km(home_lat, home_lng, f.lat, f.lng) >= (wanted ->> 'min_distance_km')::double precision
        )
      )
    );
$$;

create function badges.subject_keys(f badges.facts, subject text)
returns setof text
language sql
stable
set search_path = ''
as $$
  select f.event_id::text where subject = 'event'
  union all select f.set_checkin_id::text where subject = 'set' and f.set_checkin_id is not null
  union all select x::text from unnest(f.artist_ids) x where subject = 'artist'
  union all select f.venue_id::text where subject = 'venue'
  union all select lower(f.city) where subject = 'city'
  union all select f.country where subject = 'country'
  union all select x::text from unnest(f.promoter_ids) x where subject = 'promoter'
  union all select f.series_id::text where subject = 'series' and f.series_id is not null
  union all select x from unnest(f.genre_slugs) x where subject = 'genre'
  union all select x::text from unnest(f.subgenre_ids) x where subject = 'subgenre'
  union all select extract(year from f.event_date)::text where subject = 'year';
$$;

create function badges.longest_streak(days date[], unit text)
returns integer
language sql
immutable
set search_path = ''
as $$
  with steps as (
    select distinct
      case unit
        when 'weekend' then date_trunc('week', d)::date
        else d
      end as step
    from unnest(days) d
    where unit <> 'weekend' or extract(isodow from d) in (5, 6, 7)
  ),
  runs as (
    select count(*) as length
    from (
      select step, step - (row_number() over (order by step))::int * (case unit when 'weekend' then 7 else 1 end) as run
      from steps
    ) s
    group by run
  )
  select coalesce(max(length), 0)::int from runs;
$$;

-- Rules that can't be expressed as JSON ---------------------------------------------------

create function badges.custom_value(name text, uid uuid, facts badges.facts[], valid_from date, valid_to date)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result numeric := 0;
  -- Everything imported was created by the person importing it, which is no contribution.
  import_time timestamptz := (
    select max(c.created_at) from public.event_checkins c where c.user_id = uid and c.imported
  );
begin
  case name
    when 'double_header' then
      select count(*) into result from (
        select f.event_date from unnest(facts) f group by f.event_date having count(distinct f.event_id) >= 2
      ) d;
    when 'marathon' then
      -- Every day of a multi-day event, shown by the start times of the sets seen.
      select count(*) into result from (
        select f.event_id
        from unnest(facts) f
        where f.date_end > f.event_date and f.night between f.event_date and f.date_end
        group by f.event_id, f.event_date, f.date_end
        having count(distinct f.night) = f.date_end - f.event_date + 1
      ) e;
    when 'series_years' then
      select coalesce(max(run_length), 0) into result from (
        select count(*) as run_length from (
          select y.series_id, y.year - (row_number() over (partition by y.series_id order by y.year))::int as run
          from (
            select distinct f.series_id, extract(year from f.event_date)::int as year
            from unnest(facts) f
            where f.series_id is not null
          ) y
        ) r
        group by r.series_id, r.run
      ) lengths;
    when 'duo_completionist' then
      select count(*) into result
      from public.artists g
      where g.kind = 'group'
        and exists (select 1 from unnest(facts) f where g.id = any (f.named_artist_ids))
        and (select count(*) from public.artist_members m where m.group_id = g.id) >= 2
        and not exists (
          select 1 from public.artist_members m
          where m.group_id = g.id
            and not exists (select 1 from unnest(facts) f where f.named_artist_ids = array[m.member_id])
        );
    when 'digger' then
      select count(*) into result from (
        select x.artist_id, min(x.event_date) as first_date
        from (select a as artist_id, f.event_date from unnest(facts) f, unnest(f.named_artist_ids) a) x
        group by x.artist_id
      ) mine
      where not exists (
        select 1
        from public.set_artists sa
        join public.set_checkins sc on sc.set_id = sa.set_id
        join public.event_checkins c on c.id = sc.event_checkin_id and c.user_id <> uid
        join public.events e on e.id = c.event_id
        where sa.artist_id = mine.artist_id and e.date_start <= mine.first_date
      );
    when 'called_it' then
      select count(*) into result from (
        select x.artist_id, min(x.event_date) as first_date
        from (select a as artist_id, f.event_date from unnest(facts) f, unnest(f.named_artist_ids) a) x
        group by x.artist_id
      ) mine
      where (
        select count(*)
        from public.set_artists sa
        join public.set_checkins sc on sc.set_id = sa.set_id
        where sa.artist_id = mine.artist_id
      ) >= 25
      and (
        select count(*)
        from public.set_artists sa
        join public.set_checkins sc on sc.set_id = sa.set_id
        join public.event_checkins c on c.id = sc.event_checkin_id
        join public.events e on e.id = c.event_id
        where sa.artist_id = mine.artist_id and e.date_start < mine.first_date
      ) < 25;
    when 'local_support' then
      select count(distinct f.set_checkin_id) into result
      from unnest(facts) f
      join public.artists a on a.id = any (f.named_artist_ids)
      where a.country_code = (
        select v.country_code
        from public.profiles p
        join public.venues v on lower(v.city) = lower(p.home_city) and v.status = 'approved'
        where p.id = uid
        limit 1
      );
    when 'crew_love' then
      select count(*) into result from (
        select e.event_id
        from (select distinct f.event_id from unnest(facts) f) e
        join public.event_checkins c on c.event_id = e.event_id and c.user_id <> uid
        join public.friendships fr
          on fr.status = 'accepted' and fr.user_a = least(uid, c.user_id) and fr.user_b = greatest(uid, c.user_id)
        where coalesce(c.visibility, public.privacy_level(c.user_id, 'checkins')) <> 'private'
        group by e.event_id
        having count(*) >= 3
      ) crews;
    when 'plus_one' then
      -- A request from the other side is the closest record of a friend coming through your
      -- link or QR code, since nothing stores how a request started.
      select count(*) into result
      from public.friendships fr
      where fr.status = 'accepted' and uid in (fr.user_a, fr.user_b) and fr.requested_by <> uid;
    when 'hype_machine' then
      select count(*) into result from public.reactions r where r.user_id = uid;
    when 'crowd_favourite' then
      select count(*) into result
      from public.reactions r
      where r.user_id <> uid
        and (
          (r.target_type = 'event_checkin' and exists (
            select 1 from public.event_checkins c where c.id = r.target_id and c.user_id = uid
          ))
          or (r.target_type = 'set_checkin' and exists (
            select 1 from public.set_checkins sc
            join public.event_checkins c on c.id = sc.event_checkin_id
            where sc.id = r.target_id and c.user_id = uid
          ))
        );
    when 'data_hero' then
      select
        (select count(*) from public.artists x where x.created_by = uid and x.status = 'approved' and x.created_at > coalesce(import_time, '-infinity'))
        + (select count(*) from public.venues x where x.created_by = uid and x.status = 'approved' and x.created_at > coalesce(import_time, '-infinity'))
        + (select count(*) from public.promoters x where x.created_by = uid and x.status = 'approved' and x.created_at > coalesce(import_time, '-infinity'))
        + (select count(*) from public.event_series x where x.created_by = uid and x.status = 'approved' and x.created_at > coalesce(import_time, '-infinity'))
        + (select count(*) from public.events x where x.created_by = uid and x.status = 'approved' and x.created_at > coalesce(import_time, '-infinity'))
        + (select count(*) from public.change_requests x where x.created_by = uid and x.status = 'approved')
      into result;
    when 'timetable_wizard' then
      select count(distinct s.event_id) into result
      from public.sets s
      where s.created_by = uid and s.status = 'approved' and s.start_at is not null
        and s.created_at > coalesce(import_time, '-infinity');
    when 'account_created' then
      select count(*) into result
      from public.profiles p
      where p.id = uid
        and (valid_from is null or p.created_at::date >= valid_from)
        and (valid_to is null or p.created_at::date <= valid_to);
    else
      -- wrapped_shared: Wrapped doesn't exist yet.
      result := 0;
  end case;
  return result;
end;
$$;

create function badges.rule_value(
  facts badges.facts[],
  rule jsonb,
  valid_from date,
  valid_to date,
  home_lat double precision,
  home_lng double precision,
  uid uuid
)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  subject text := rule ->> 'subject';
  matched badges.facts[];
  result numeric;
begin
  if rule ? 'custom' then
    return badges.custom_value(rule ->> 'custom', uid, facts, valid_from, valid_to);
  end if;

  matched := array(
    select f
    from unnest(facts) f
    where badges.matches(f, rule -> 'filter', home_lat, home_lng)
      and badges.in_window(f.event_date, rule -> 'window')
      and (valid_from is null or f.event_date >= valid_from)
      and (valid_to is null or f.event_date <= valid_to)
  );

  case rule ->> 'metric'
    when 'exists' then
      return case when cardinality(matched) > 0 then 1 else 0 end;
    when 'streak' then
      return badges.longest_streak(array(select f.event_date from unnest(matched) f), rule ->> 'unit');
    when 'same_night' then
      select coalesce(max(n), 0) into result from (
        select count(distinct k) as n
        from unnest(matched) f, lateral badges.subject_keys(f, subject) k
        group by f.night
      ) nights;
    when 'max_count' then
      -- Artists count sets, everything else counts events.
      select coalesce(max(n), 0) into result from (
        select case when subject = 'artist' then count(distinct f.set_checkin_id) else count(distinct f.event_id) end as n
        from unnest(matched) f, lateral badges.subject_keys(f, subject) k
        group by k
      ) groups;
    else
      select count(distinct k) into result
      from unnest(matched) f, lateral badges.subject_keys(f, subject) k;
  end case;
  return result;
end;
$$;

create function badges.home_of(uid uuid)
returns table (lat double precision, lng double precision)
language sql
stable
security definer
set search_path = ''
as $$
  select avg(v.lat), avg(v.lng)
  from public.profiles p
  join public.venues v on lower(v.city) = lower(p.home_city) and v.status = 'approved' and v.lat is not null
  where p.id = uid;
$$;

-- Fun facts -----------------------------------------------------------------------------

-- Derived data, so the whole set is recalculated: editing an old check-in can change what
-- every later one means. Visible to the owner only, through the policy on the table.
create function badges.refresh_fun_facts(uid uuid, facts badges.facts[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.checkin_fun_facts ff
  using public.event_checkins c
  where c.id = ff.checkin_id and c.user_id = uid;

  -- Per artist seen: 1st, 5th, 10th and 25th time, gaps, repeats and rating records.
  insert into public.checkin_fun_facts (checkin_id, kind, payload)
  with seen as (
    select
      f.checkin_id,
      f.event_id,
      f.event_date,
      f.rating,
      a as artist_id,
      row_number() over w as n,
      lag(f.event_date) over w as previous_date,
      lag(f.event_id) over w as previous_event,
      max(f.rating) over (w rows between unbounded preceding and 1 preceding) as best_before
    from unnest(facts) f, unnest(f.artist_ids) a
    where f.set_checkin_id is not null
    window w as (partition by a order by f.event_date, f.created_at, f.set_checkin_id)
  )
  select s.checkin_id, r.kind, jsonb_build_object('artist_id', s.artist_id, 'artist', a.name) || r.detail
  from seen s
  join public.artists a on a.id = s.artist_id
  cross join lateral (
    select 'artist_seen' as kind, jsonb_build_object('n', s.n) as detail where s.n in (1, 5, 10, 25)
    union all
    select 'artist_gap', jsonb_build_object(
      'months', (extract(year from age(s.event_date, s.previous_date)) * 12 + extract(month from age(s.event_date, s.previous_date)))::int
    )
    where s.previous_date <= s.event_date - interval '6 months'
    union all
    select 'artist_same_weekend', '{}'::jsonb
    where s.previous_event <> s.event_id and date_trunc('week', s.previous_date) = date_trunc('week', s.event_date)
    union all
    select 'artist_same_month', '{}'::jsonb
    where s.previous_event <> s.event_id
      and date_trunc('week', s.previous_date) <> date_trunc('week', s.event_date)
      and date_trunc('month', s.previous_date) = date_trunc('month', s.event_date)
    union all
    select 'artist_best_rating', jsonb_build_object('rating', s.rating) where s.rating > s.best_before
  ) r;

  -- You saw them first among your friends. Private check-ins of friends stay out of this,
  -- so that the fact can't reveal them.
  insert into public.checkin_fun_facts (checkin_id, kind, payload)
  select distinct on (first_seen.artist_id) first_seen.checkin_id, 'first_of_friends', jsonb_build_object('artist_id', a.id, 'artist', a.name)
  from (
    select distinct on (x) f.checkin_id, f.event_date, x as artist_id
    from unnest(facts) f, unnest(f.artist_ids) x
    where f.set_checkin_id is not null
    order by x, f.event_date, f.created_at
  ) first_seen
  join public.artists a on a.id = first_seen.artist_id
  where exists (
      select 1 from public.friendships fr
      where fr.status = 'accepted' and uid in (fr.user_a, fr.user_b)
    )
    and not exists (
      select 1
      from public.friendships fr
      join public.event_checkins c
        on c.user_id = case when fr.user_a = uid then fr.user_b else fr.user_a end
      join public.events e on e.id = c.event_id and e.date_start <= first_seen.event_date
      join public.set_checkins sc on sc.event_checkin_id = c.id
      join public.set_artists sa on sa.set_id = sc.set_id and sa.artist_id = first_seen.artist_id
      where fr.status = 'accepted' and uid in (fr.user_a, fr.user_b)
        and coalesce(c.visibility, public.privacy_level(c.user_id, 'checkins')) <> 'private'
    );

  -- Per check-in: firsts, milestones and records.
  insert into public.checkin_fun_facts (checkin_id, kind, payload)
  with checkins as (
    select
      f.checkin_id, f.event_date, f.created_at, f.venue_id, f.city, f.country, f.series_id,
      count(f.set_checkin_id) as sets
    from unnest(facts) f
    group by f.checkin_id, f.event_date, f.created_at, f.venue_id, f.city, f.country, f.series_id
  ),
  ordered as (
    select
      c.*,
      row_number() over (order by c.event_date, c.created_at, c.checkin_id) as n,
      row_number() over (partition by c.venue_id order by c.event_date, c.created_at, c.checkin_id) as at_venue,
      row_number() over (partition by lower(c.city) order by c.event_date, c.created_at, c.checkin_id) as in_city,
      row_number() over (partition by c.country order by c.event_date, c.created_at, c.checkin_id) as in_country,
      row_number() over (partition by extract(year from c.event_date) order by c.event_date, c.created_at, c.checkin_id) as in_year,
      max(c.sets) over (order by c.event_date, c.created_at, c.checkin_id rows between unbounded preceding and 1 preceding) as record_before
    from checkins c
  )
  select o.checkin_id, r.kind, r.detail
  from ordered o
  left join public.venues v on v.id = o.venue_id
  cross join lateral (
    select 'first_venue' as kind, jsonb_build_object('venue', v.name) as detail where o.at_venue = 1
    union all select 'first_city', jsonb_build_object('city', o.city) where o.in_city = 1
    union all select 'first_country', jsonb_build_object('country', o.country) where o.in_country = 1
    union all select 'first_of_year', jsonb_build_object('year', extract(year from o.event_date)::int) where o.in_year = 1
    union all select 'event_milestone', jsonb_build_object('n', o.n) where o.n in (10, 25, 50, 75, 100, 150, 200, 250, 500)
    union all select 'record_sets', jsonb_build_object('n', o.sets) where o.sets > o.record_before and o.record_before > 0
  ) r;

  -- First set in a new subgenre.
  insert into public.checkin_fun_facts (checkin_id, kind, payload)
  select distinct on (s.genre_id) s.checkin_id, 'first_subgenre', jsonb_build_object('genre', g.name)
  from (
    select f.checkin_id, f.event_date, f.created_at, x as genre_id
    from unnest(facts) f, unnest(f.subgenre_ids) x
  ) s
  join public.genres g on g.id = s.genre_id
  order by s.genre_id, s.event_date, s.created_at;

  -- Same series for the Xth year in a row.
  insert into public.checkin_fun_facts (checkin_id, kind, payload)
  with years as (
    select distinct on (f.series_id, extract(year from f.event_date))
      f.series_id, f.checkin_id, extract(year from f.event_date)::int as year
    from unnest(facts) f
    where f.series_id is not null
    order by f.series_id, extract(year from f.event_date), f.event_date, f.created_at
  ),
  runs as (
    select y.*, y.year - (row_number() over (partition by y.series_id order by y.year))::int as run
    from years y
  ),
  numbered as (
    select r.*, row_number() over (partition by r.series_id, r.run order by r.year) as streak
    from runs r
  )
  select n.checkin_id, 'series_streak', jsonb_build_object('series', s.name, 'n', n.streak)
  from numbered n
  join public.event_series s on s.id = n.series_id
  where n.streak >= 2;

  -- Both members of a duo now also seen solo, at the check-in that completes it.
  insert into public.checkin_fun_facts (checkin_id, kind, payload)
  with sequence as (
    select f.checkin_id, f.named_artist_ids, row_number() over (order by f.event_date, f.created_at, f.fact_id) as seq
    from unnest(facts) f
    where f.set_checkin_id is not null
  ),
  duos as (
    select
      g.id,
      g.name,
      (select min(s.seq) from sequence s where g.id = any (s.named_artist_ids)) as group_seq,
      (select count(*) from public.artist_members m where m.group_id = g.id) as members,
      (
        select count(*)
        from public.artist_members m
        where m.group_id = g.id
          and exists (select 1 from sequence s where s.named_artist_ids = array[m.member_id])
      ) as members_solo,
      (
        select max((select min(s.seq) from sequence s where s.named_artist_ids = array[m.member_id]))
        from public.artist_members m
        where m.group_id = g.id
      ) as solo_seq
    from public.artists g
    where g.kind = 'group'
  )
  select s.checkin_id, 'duo_complete', jsonb_build_object('artist_id', d.id, 'artist', d.name)
  from duos d
  join sequence s on s.seq = greatest(d.group_seq, d.solo_seq)
  where d.members >= 2 and d.members = d.members_solo and d.group_seq is not null;
end;
$$;

-- Evaluating ----------------------------------------------------------------------------

create table badges.progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge_id uuid not null references public.badge_definitions (id) on delete cascade,
  value numeric not null,
  primary key (user_id, badge_id)
);

create function badges.evaluate(uid uuid, target_scope text, silent boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  facts badges.facts[];
  home record;
  d public.badge_definitions;
  amount numeric;
  new_level integer;
  old_level integer;
  -- Half the catalog is genre badges, and most people have seen few of those genres.
  known_genres text[];
begin
  if not exists (select 1 from public.profiles where id = uid) then
    return;
  end if;
  facts := array(select f from badges.facts f where f.user_id = uid);
  select lat, lng into home from badges.home_of(uid);
  known_genres := array(select distinct x from unnest(facts) f, unnest(f.genre_slugs) x);

  for d in
    select * from public.badge_definitions b where coalesce(b.rule ->> 'scope', 'checkins') = target_scope
  loop
    if jsonb_typeof(d.rule -> 'filter' -> 'genre') = 'string' and not (d.rule -> 'filter' ->> 'genre' = any (known_genres)) then
      amount := 0;
    else
      amount := badges.rule_value(facts, d.rule, d.valid_from, d.valid_to, home.lat, home.lng, uid);
    end if;
    new_level := (select count(*) from jsonb_array_elements_text(d.rule -> 'levels') as l (threshold) where l.threshold::numeric <= amount);

    insert into badges.progress (user_id, badge_id, value) values (uid, d.id, amount)
    on conflict (user_id, badge_id) do update set value = excluded.value;

    select level into old_level from public.user_badges u where u.user_id = uid and u.badge_id = d.id;

    if new_level = 0 then
      -- A lost level disappears without a notification.
      delete from public.user_badges u where u.user_id = uid and u.badge_id = d.id;
    elsif old_level is null or new_level > old_level then
      insert into public.user_badges (user_id, badge_id, level, awarded_at) values (uid, d.id, new_level, now())
      on conflict (user_id, badge_id) do update set level = excluded.level, awarded_at = excluded.awarded_at;
      if not silent then
        perform public.upsert_notification(uid, 'badge', jsonb_build_object(
          'name', coalesce(d.rule -> 'level_names' ->> (new_level - 1), d.name),
          'badge', d.name,
          'level', new_level
        ));
      end if;
    elsif new_level < old_level then
      update public.user_badges u set level = new_level where u.user_id = uid and u.badge_id = d.id;
    end if;
  end loop;

  if target_scope = 'checkins' then
    perform badges.refresh_fun_facts(uid, facts);
  end if;
end;
$$;

-- The notes ------------------------------------------------------------------------------

create table badges.dirty (
  user_id uuid not null references public.profiles (id) on delete cascade,
  scope text not null,
  silent boolean not null,
  primary key (user_id, scope)
);

create function badges.note(uid uuid, target_scope text, is_silent boolean default false)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into badges.dirty (user_id, scope, silent)
  select uid, target_scope, is_silent
  where uid is not null and exists (select 1 from public.profiles where id = uid)
  on conflict (user_id, scope) do update set silent = badges.dirty.silent and excluded.silent;
$$;

create function badges.on_event_checkin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform badges.note(coalesce(new.user_id, old.user_id), 'checkins');
  return null;
end;
$$;

create function badges.on_set_checkin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Nothing to find when the parent check-in is being deleted, but that one leaves a note too.
  perform badges.note(
    (select c.user_id from public.event_checkins c where c.id = coalesce(new.event_checkin_id, old.event_checkin_id)),
    'checkins'
  );
  return null;
end;
$$;

create function badges.on_set_checkin_child()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform badges.note(
    (
      select c.user_id
      from public.set_checkins sc
      join public.event_checkins c on c.id = sc.event_checkin_id
      where sc.id = coalesce(new.set_checkin_id, old.set_checkin_id)
    ),
    'checkins'
  );
  return null;
end;
$$;

create function badges.on_reaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.reaction_target := coalesce(new.target_type, old.target_type);
  target_id uuid := coalesce(new.target_id, old.target_id);
begin
  perform badges.note(coalesce(new.user_id, old.user_id), 'reactions');
  perform badges.note(
    case when target = 'event_checkin' then (
      select c.user_id from public.event_checkins c where c.id = target_id
    ) else (
      select c.user_id
      from public.set_checkins sc
      join public.event_checkins c on c.id = sc.event_checkin_id
      where sc.id = target_id
    ) end,
    'reactions'
  );
  return null;
end;
$$;

create trigger badges_note after insert or update or delete on public.event_checkins
  for each row execute function badges.on_event_checkin();
create trigger badges_note after insert or update or delete on public.set_checkins
  for each row execute function badges.on_set_checkin();
create trigger badges_note after insert or update or delete on public.set_checkin_genres
  for each row execute function badges.on_set_checkin_child();
create trigger badges_note after insert or update or delete on public.set_checkin_tags
  for each row execute function badges.on_set_checkin_child();
create trigger badges_note after insert or update or delete on public.reactions
  for each row execute function badges.on_reaction();

create function badges.process_dirty()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  note badges.dirty;
begin
  for note in delete from badges.dirty returning * loop
    begin
      perform badges.evaluate(note.user_id, note.scope, note.silent);
    exception when others then
      -- One person's problem must not stop everyone else. The hourly sweep tries again.
      raise warning 'Badge evaluation failed for scope %: %', note.scope, sqlerrm;
    end;
  end loop;
end;
$$;

-- Master data and other people's check-ins change results too. Those changes come quietly,
-- except for the community rules, which only ever change this way.
create function badges.sweep()
returns void
language sql
security definer
set search_path = ''
as $$
  select badges.note(p.id, 'checkins', true) from public.profiles p;
  select badges.note(p.id, 'community', false) from public.profiles p;
$$;

select cron.schedule('badges-process', '* * * * *', 'select badges.process_dirty()');
select cron.schedule('badges-sweep', '23 * * * *', 'select badges.sweep()');

-- For the end of a check-in batch, so that new badges and fun facts are there right away.
create function public.evaluate_my_badges()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  note badges.dirty;
begin
  if not public.has_profile() then
    return;
  end if;
  for note in delete from badges.dirty d where d.user_id = uid returning * loop
    perform badges.evaluate(note.user_id, note.scope, note.silent);
  end loop;
end;
$$;

-- Reading -------------------------------------------------------------------------------

-- No secret badges: everyone sees all of them, and their own progress. Someone else's progress
-- could reveal private check-ins, so others get only the level reached.
create function public.get_badges(target_user uuid)
returns table (
  id uuid,
  name text,
  description text,
  description_de text,
  category text,
  levels jsonb,
  level_names jsonb,
  valid_from date,
  valid_to date,
  level integer,
  value numeric,
  awarded_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    d.id, d.name, d.description, d.description_de, d.category,
    d.rule -> 'levels', d.rule -> 'level_names', d.valid_from, d.valid_to,
    coalesce(u.level, 0)::integer,
    case when target_user = (select auth.uid()) then coalesce(p.value, 0) end,
    u.awarded_at
  from public.badge_definitions d
  left join public.user_badges u on u.badge_id = d.id and u.user_id = target_user
  left join badges.progress p on p.badge_id = d.id and p.user_id = target_user
  where public.has_profile() and public.privacy_allows(target_user, 'badges')
  order by d.category, d.name;
$$;

-- Live preview for the editor: who would have this badge right now?
create function public.admin_preview_badge(rule jsonb, valid_from date default null, valid_to date default null)
returns table (username text, display_name text, value numeric, level integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  person record;
  home record;
  amount numeric;
begin
  if not public.is_staff() then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  perform badges.validate_rule(rule);
  for person in select p.id, p.username, p.display_name from public.profiles p loop
    select h.lat, h.lng into home from badges.home_of(person.id) h;
    amount := badges.rule_value(
      array(select f from badges.facts f where f.user_id = person.id),
      rule, valid_from, valid_to, home.lat, home.lng, person.id
    );
    if amount > 0 then
      username := person.username;
      display_name := person.display_name;
      value := amount;
      level := (select count(*) from jsonb_array_elements_text(rule -> 'levels') as l (threshold) where l.threshold::numeric <= amount);
      return next;
    end if;
  end loop;
end;
$$;

-- The catalog ---------------------------------------------------------------------------

create function pg_temp.badge(category text, name text, en text, de text, rule jsonb)
returns void
language sql
as $$
  insert into public.badge_definitions (category, name, description, description_de, rule)
  values (category, name, en, de, rule);
$$;

select pg_temp.badge('starter', 'First Drop', 'Your first check-in', 'Dein erster Check-in', '{"metric":"count","subject":"event","levels":[1]}');
select pg_temp.badge('starter', 'Raver', 'Events in total', 'Events insgesamt', '{"metric":"count","subject":"event","levels":[5,10,25,50,100,250]}');
select pg_temp.badge('starter', 'Set Collector', 'Sets in total', 'Sets insgesamt', '{"metric":"count","subject":"set","levels":[10,25,50,100,250,500,1000]}');
select pg_temp.badge('starter', 'Artist Hunter', 'Different artists', 'Verschiedene Artists', '{"metric":"count_distinct","subject":"artist","levels":[10,25,50,100,250,500]}');

-- Genre badges: the named ones from the spec, then one per remaining genre in the tree.
select pg_temp.badge('genre', 'Liquid Soul', 'Different artists with liquid sets', 'Verschiedene Artists mit Liquid-Sets', '{"metric":"count_distinct","subject":"artist","filter":{"genre":"liquid"},"levels":[5,10,25,50,100]}');
select pg_temp.badge('genre', 'Neuro Nerd', 'Different artists with neurofunk sets', 'Verschiedene Artists mit Neurofunk-Sets', '{"metric":"count_distinct","subject":"artist","filter":{"genre":"neurofunk"},"levels":[5,10,25,50,100],"level_names":["Neuro Nerd","Neuro Head","Neuro Fiend","Neuro Addict","Neuro Overlord"]}');
select pg_temp.badge('genre', 'Jump-Up Junkie', 'Different artists with jump up sets', 'Verschiedene Artists mit Jump-Up-Sets', '{"metric":"count_distinct","subject":"artist","filter":{"genre":"jump-up"},"levels":[5,10,25,50,100]}');
select pg_temp.badge('genre', 'Jungle Massive', 'Different artists with jungle sets', 'Verschiedene Artists mit Jungle-Sets', '{"metric":"count_distinct","subject":"artist","filter":{"genre":"jungle"},"levels":[5,10,25,50,100]}');
select pg_temp.badge('genre', 'Roller Coaster', 'Different artists with rollers or minimal sets', 'Verschiedene Artists mit Rollers- oder Minimal-Sets', '{"metric":"count_distinct","subject":"artist","filter":{"genre":"rollers-minimal"},"levels":[5,10,25,50,100]}');
select pg_temp.badge('genre', 'Halftime Hero', 'Different artists with halftime sets', 'Verschiedene Artists mit Halftime-Sets', '{"metric":"count_distinct","subject":"artist","filter":{"genre":"halftime"},"levels":[5,10,25]}');
select pg_temp.badge('genre', 'Bunker Kid', 'Different artists with techno sets', 'Verschiedene Artists mit Techno-Sets', '{"metric":"count_distinct","subject":"artist","filter":{"genre":"techno"},"levels":[5,10,25,50,100]}');
select pg_temp.badge('genre', 'House Head', 'Different artists with house sets', 'Verschiedene Artists mit House-Sets', '{"metric":"count_distinct","subject":"artist","filter":{"genre":"house"},"levels":[5,10,25,50,100]}');
select pg_temp.badge('genre', 'Wobble Warrior', 'Different artists with dubstep sets', 'Verschiedene Artists mit Dubstep-Sets', '{"metric":"count_distinct","subject":"artist","filter":{"genre":"dubstep"},"levels":[5,10,25,50]}');
select pg_temp.badge('genre', 'Genre Hopper', 'Different subgenres', 'Verschiedene Subgenres', '{"metric":"count_distinct","subject":"subgenre","levels":[5,10,15,20]}');

select pg_temp.badge(
  'genre',
  g.name || ' Fan',
  'Different artists with ' || g.name || ' sets',
  'Verschiedene Artists mit ' || g.name || '-Sets',
  jsonb_build_object('metric', 'count_distinct', 'subject', 'artist', 'filter', jsonb_build_object('genre', g.slug), 'levels', '[5,10,25,50]'::jsonb)
)
from public.genres g
where g.parent_id is not null
  and g.slug not in ('liquid', 'neurofunk', 'jump-up', 'jungle', 'rollers-minimal', 'halftime', 'techno', 'house', 'dubstep');

select pg_temp.badge('set_format', 'Back to Back', 'B2B sets seen', 'B2B-Sets gesehen', '{"metric":"count","subject":"set","filter":{"set_type":"b2b"},"levels":[5,10,25]}');
select pg_temp.badge('set_format', 'Triple Threat', 'A B2B2B set seen', 'Ein B2B2B-Set gesehen', '{"metric":"count","subject":"set","filter":{"set_type":"b2b2b"},"levels":[1]}');
select pg_temp.badge('set_format', 'Fight Night', 'F2F sets seen', 'F2F-Sets gesehen', '{"metric":"count","subject":"set","filter":{"set_type":"f2f"},"levels":[3,10,25]}');
select pg_temp.badge('set_format', 'Live Wire', 'Live sets seen', 'Live-Sets gesehen', '{"metric":"count","subject":"set","filter":{"set_type":"live"},"levels":[5,10,25]}');
select pg_temp.badge('set_format', 'Vinyl Junkie', 'Sets tagged Vinyl', 'Sets mit dem Tag Vinyl', '{"metric":"count","subject":"set","filter":{"tag":"vinyl"},"levels":[5,10,25]}');
select pg_temp.badge('set_format', 'Showcase Collector', 'Sets tagged Showcase', 'Sets mit dem Tag Showcase', '{"metric":"count","subject":"set","filter":{"tag":"showcase"},"levels":[5,10,25]}');
select pg_temp.badge('set_format', 'MC Massive', 'Sets with an MC', 'Sets mit MC', '{"metric":"count","subject":"set","filter":{"role":"mc"},"levels":[10,25,50]}');
select pg_temp.badge('set_format', 'Headliner Hunter', 'Sets tagged Headliner', 'Sets mit dem Tag Headliner', '{"metric":"count","subject":"set","filter":{"tag":"headliner"},"levels":[10,25,50]}');

select pg_temp.badge('time', 'Closing Crew', 'Sets tagged Closing', 'Sets mit dem Tag Closing', '{"metric":"count","subject":"set","filter":{"tag":"closing"},"levels":[5,10,25,50]}');
select pg_temp.badge('time', 'Early Bird', 'Sets tagged Opening', 'Sets mit dem Tag Opening', '{"metric":"count","subject":"set","filter":{"tag":"opening"},"levels":[5,10,25]}');
select pg_temp.badge('time', 'Night Shift', 'Sets in one night', 'Sets in einer Nacht', '{"metric":"same_night","subject":"set","levels":[5,8,12]}');
select pg_temp.badge('time', 'Weekend Warrior', 'Consecutive weekends with a check-in', 'Aufeinanderfolgende Wochenenden mit Check-in', '{"metric":"streak","unit":"weekend","levels":[3,5,10]}');
select pg_temp.badge('time', 'Double Header', 'Two events on one day or night', 'Zwei Events an einem Tag oder in einer Nacht', '{"custom":"double_header","levels":[1,5]}');
select pg_temp.badge('time', 'Marathon', 'All days of a multi-day festival checked in', 'Alle Tage eines mehrtägigen Festivals eingecheckt', '{"custom":"marathon","levels":[1,3,10]}');
select pg_temp.badge('time', 'Monday Blues', 'Events between Monday and Thursday', 'Events zwischen Montag und Donnerstag', '{"metric":"count","subject":"event","filter":{"weekday":[1,2,3,4]},"levels":[1,5,10]}');
select pg_temp.badge('time', 'Afterhour Survivor', 'Events tagged Afterhour', 'Events mit dem Tag Afterhour', '{"metric":"count","subject":"event","filter":{"event_tag":"afterhour"},"levels":[3,10]}');

select pg_temp.badge('season', 'Spooky Bass', 'An event between Oct 25 and Nov 2, once per year', 'Ein Event zwischen 25. Oktober und 2. November, einmal pro Jahr', '{"metric":"count_distinct","subject":"year","filter":{"date":{"from":"10-25","to":"11-02"}},"levels":[1,2,3,5,10]}');
select pg_temp.badge('season', 'Silent Night? Nope', 'An event between Dec 20 and Dec 26, once per year', 'Ein Event zwischen 20. und 26. Dezember, einmal pro Jahr', '{"metric":"count_distinct","subject":"year","filter":{"date":{"from":"12-20","to":"12-26"}},"levels":[1,2,3,5,10]}');
select pg_temp.badge('season', 'Countdown', 'An event on Dec 31, in different years', 'Ein Event am 31. Dezember, in verschiedenen Jahren', '{"metric":"count_distinct","subject":"year","filter":{"date":"12-31"},"levels":[1,3,5]}');
select pg_temp.badge('season', 'Summer of Bass', 'Open-air events between June and August', 'Open-Air-Events zwischen Juni und August', '{"metric":"count","subject":"event","filter":{"venue_type":"open_air","month":[6,7,8]},"levels":[3,5,10]}');
select pg_temp.badge('season', 'Winter Raver', 'Events between December and February', 'Events zwischen Dezember und Februar', '{"metric":"count","subject":"event","filter":{"month":[12,1,2]},"levels":[5,10]}');

select pg_temp.badge('places', 'Regular', 'Check-ins at the same venue', 'Check-ins in derselben Location', '{"metric":"max_count","subject":"venue","levels":[5,10,25],"level_names":["Regular","Local","Part of the Furniture"]}');
select pg_temp.badge('places', 'Venue Hopper', 'Different venues', 'Verschiedene Locations', '{"metric":"count_distinct","subject":"venue","levels":[5,10,25,50]}');
select pg_temp.badge('places', 'City Tripper', 'Different cities', 'Verschiedene Städte', '{"metric":"count_distinct","subject":"city","levels":[3,5,10,20]}');
select pg_temp.badge('places', 'Border Crosser', 'Different countries', 'Verschiedene Länder', '{"metric":"count_distinct","subject":"country","levels":[2,3,5,10]}');
select pg_temp.badge('places', 'State Capitals', 'Events in the 9 Austrian state capitals', 'Events in den 9 österreichischen Landeshauptstädten', '{"metric":"count_distinct","subject":"city","filter":{"city":["Wien","St. Pölten","Linz","Salzburg","Innsbruck","Bregenz","Klagenfurt","Graz","Eisenstadt"]},"levels":[3,6,9]}');
select pg_temp.badge('places', 'Castle Raver', 'Castle venues', 'Locations in Schlössern und Burgen', '{"metric":"count_distinct","subject":"venue","filter":{"venue_type":"castle"},"levels":[1,3,5]}');
select pg_temp.badge('places', 'Splash Zone', 'Pool or boat venues', 'Locations an Pools oder auf Booten', '{"metric":"count_distinct","subject":"venue","filter":{"venue_type":["pool","boat"]},"levels":[1,3]}');
select pg_temp.badge('places', 'Warehouse Rat', 'Warehouse venues', 'Locations in Lagerhallen', '{"metric":"count_distinct","subject":"venue","filter":{"venue_type":"warehouse"},"levels":[5,10,25]}');
select pg_temp.badge('places', 'Road Trip', 'Events more than 200 km from your home region', 'Events über 200 km von deiner Heimatregion', '{"metric":"count","subject":"event","filter":{"min_distance_km":200},"levels":[1,5,10]}');

select pg_temp.badge('loyalty', 'Superfan', 'Same artist seen', 'Denselben Artist gesehen', '{"metric":"max_count","subject":"artist","levels":[3,5,10,20]}');
select pg_temp.badge('loyalty', 'Tradition', 'Same series in consecutive years', 'Dieselbe Reihe in aufeinanderfolgenden Jahren', '{"custom":"series_years","levels":[2,3,5]}');
select pg_temp.badge('loyalty', 'Promoter Loyalist', 'Events by the same promoter', 'Events desselben Veranstalters', '{"metric":"max_count","subject":"promoter","levels":[5,10,25]}');
select pg_temp.badge('loyalty', 'Duo Completionist', 'A duo plus both members solo seen', 'Ein Duo und beide Mitglieder solo gesehen', '{"custom":"duo_completionist","levels":[1,3]}');

select pg_temp.badge('discovery', 'Digger', 'Artists nobody in the app had seen before you', 'Artists, die vor dir niemand in der App gesehen hat', '{"custom":"digger","scope":"community","levels":[1,5,10,25]}');
select pg_temp.badge('discovery', 'Called It', 'Artists you saw before they reached 25 check-ins in the app', 'Artists, die du gesehen hast, bevor sie 25 Check-ins in der App hatten', '{"custom":"called_it","scope":"community","levels":[1,3,5]}');
select pg_temp.badge('discovery', 'Local Support', 'Sets by artists from your country', 'Sets von Artists aus deinem Land', '{"custom":"local_support","levels":[10,25,50]}');

select pg_temp.badge('community', 'Crew Love', 'Events checked in with 3 or more friends', 'Events mit 3 oder mehr Freunden eingecheckt', '{"custom":"crew_love","scope":"community","levels":[1,5,10]}');
select pg_temp.badge('community', 'Plus One', 'Friends who added you via your QR code or link', 'Freunde, die dich über deinen QR-Code oder Link hinzugefügt haben', '{"custom":"plus_one","scope":"community","levels":[3,10,25]}');
select pg_temp.badge('community', 'Hype Machine', 'Reactions given', 'Reactions vergeben', '{"custom":"hype_machine","scope":"reactions","levels":[25,100,500]}');
select pg_temp.badge('community', 'Crowd Favourite', 'Reactions received', 'Reactions erhalten', '{"custom":"crowd_favourite","scope":"reactions","levels":[25,100,500]}');
select pg_temp.badge('community', 'Data Hero', 'Approved new data points or corrections', 'Freigegebene neue Daten oder Korrekturen', '{"custom":"data_hero","scope":"community","levels":[1,10,25,50]}');
select pg_temp.badge('community', 'Timetable Wizard', 'Approved timetables', 'Freigegebene Timetables', '{"custom":"timetable_wizard","scope":"community","levels":[1,5,10]}');

select pg_temp.badge('verified', 'Proof of Rave', 'GPS- or admin-verified check-ins', 'Per GPS oder Admin verifizierte Check-ins', '{"metric":"count","subject":"event","filter":{"verified_only":true},"levels":[5,10,25,50,100]}');

select pg_temp.badge('limited', 'Beta Raver', 'Account created during the friends beta', 'Konto während der Friends-Beta erstellt', '{"custom":"account_created","scope":"community","levels":[1]}');
select pg_temp.badge('limited', 'Wrapped', 'Yearly Wrapped viewed and shared, once per year', 'Jährliches Wrapped angesehen und geteilt, einmal pro Jahr', '{"custom":"wrapped_shared","scope":"community","levels":[1,2,3,5]}');

-- Changes to the catalog -----------------------------------------------------------------

-- Everyone gets recalculated, quietly: an edited rule shouldn't feel like an achievement.
create function badges.on_definition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  scope text := coalesce(new.rule, old.rule) ->> 'scope';
begin
  if tg_op <> 'DELETE' then
    perform badges.note(p.id, coalesce(scope, 'checkins'), true) from public.profiles p;
  end if;
  if (select auth.uid()) is not null then
    insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, diff)
    values (
      (select auth.uid()), lower(tg_op), 'badge_definition', coalesce(new.id, old.id),
      jsonb_build_object('name', coalesce(new.name, old.name), 'rule', coalesce(new.rule, old.rule))
    );
  end if;
  return null;
end;
$$;

create trigger badges_recalculate after insert or update or delete on public.badge_definitions
  for each row execute function badges.on_definition();

-- The one-time backfill: everyone, every scope, no notifications. The cron job picks it up.
select badges.note(p.id, s.scope, true)
from public.profiles p
cross join (values ('checkins'), ('reactions'), ('community')) as s (scope);

-- Function access -----------------------------------------------------------------------

revoke execute on all functions in schema badges from public, anon, authenticated;
revoke execute on function
  public.evaluate_my_badges(),
  public.get_badges(uuid),
  public.admin_preview_badge(jsonb, date, date)
from public, anon;
grant execute on function
  public.evaluate_my_badges(),
  public.get_badges(uuid),
  public.admin_preview_badge(jsonb, date, date)
to authenticated, service_role;
