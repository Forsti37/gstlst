-- Phase 8: Wrapped for a year, month, season, custom range or single event.
--
-- Everything goes through stats.visible_facts, so a shared link shows a viewer exactly what the
-- privacy settings allow them, and private spending has its own function for its owner alone.

create schema wrapped;
revoke all on schema wrapped from public, anon, authenticated;

create table wrapped.shares (
  user_id uuid not null references public.profiles (id) on delete cascade,
  year integer not null,
  shared_at timestamptz not null default now(),
  primary key (user_id, year)
);

create table wrapped.community_years (
  year integer primary key,
  unlocked_by uuid references public.profiles (id) on delete set null,
  unlocked_at timestamptz not null default now()
);

-- Periods -------------------------------------------------------------------------------

-- 2025 · 2025-03 · 2025-summer · 2025-01-01_2025-03-31 · event-<uuid>
-- Winter is the one that starts in December of that year.
create function wrapped.parse_period(period text)
returns table (kind text, date_from date, date_to date, event_id uuid, year integer)
language plpgsql
immutable
set search_path = ''
as $$
declare
  y integer;
begin
  begin
    if period ~ '^\d{4}$' then
      y := period::integer;
      return query select 'year'::text, make_date(y, 1, 1), make_date(y, 12, 31), null::uuid, y;
    elsif period ~ '^\d{4}-(0[1-9]|1[0-2])$' then
      return query select
        'month'::text,
        (period || '-01')::date,
        ((period || '-01')::date + interval '1 month' - interval '1 day')::date,
        null::uuid,
        left(period, 4)::integer;
    elsif period ~ '^\d{4}-(spring|summer|autumn|winter)$' then
      y := left(period, 4)::integer;
      return query select
        'season'::text,
        case split_part(period, '-', 2)
          when 'spring' then make_date(y, 3, 1)
          when 'summer' then make_date(y, 6, 1)
          when 'autumn' then make_date(y, 9, 1)
          else make_date(y, 12, 1)
        end,
        case split_part(period, '-', 2)
          when 'spring' then make_date(y, 5, 31)
          when 'summer' then make_date(y, 8, 31)
          when 'autumn' then make_date(y, 11, 30)
          else (make_date(y + 1, 3, 1) - 1)
        end,
        null::uuid,
        y;
    elsif period ~ '^\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}$' then
      if split_part(period, '_', 1)::date > split_part(period, '_', 2)::date then
        raise exception 'The range ends before it starts' using errcode = 'data_exception';
      end if;
      return query select
        'custom'::text,
        split_part(period, '_', 1)::date,
        split_part(period, '_', 2)::date,
        null::uuid,
        null::integer;
    elsif period ~ '^event-[0-9a-fA-F-]{36}$' then
      return query select 'event'::text, null::date, null::date, substr(period, 7)::uuid, null::integer;
    else
      raise exception 'Unknown period' using errcode = 'data_exception';
    end if;
  exception when data_exception or datetime_field_overflow or invalid_datetime_format or invalid_text_representation then
    raise exception 'Unknown period' using errcode = 'invalid_parameter_value';
  end;
end;
$$;

-- A year opens on December 1st. The rest of December gets added afterwards by itself.
create function wrapped.year_is_open(y integer)
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_date >= make_date(y, 12, 1);
$$;

-- Personas ------------------------------------------------------------------------------

create function wrapped.persona(facts stats.facts[])
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  event_count numeric;
  set_count numeric;
  city_count numeric;
  top_city_events numeric;
  subgenres numeric;
  share_neuro numeric;
  share_liquid numeric;
  share_jump_up numeric;
  share_closing numeric;
  share_warehouse numeric;
  share_festival numeric;
begin
  select count(distinct f.event_id), count(distinct f.set_checkin_id), count(distinct lower(f.city))
    into event_count, set_count, city_count
    from unnest(facts) f;
  if event_count < 3 then
    return 'fresh';
  end if;

  select max(n) into top_city_events from (
    select count(distinct f.event_id) as n from unnest(facts) f group by lower(f.city)
  ) c;

  select count(distinct l.sub_id) into subgenres
    from unnest(facts) f, unnest(f.genre_ids) g
    join stats.genre_lineage l on l.id = g
    where l.sub_id is not null;

  if set_count > 0 then
    select
      count(distinct f.set_checkin_id) filter (where s.slug = 'neurofunk') / set_count,
      count(distinct f.set_checkin_id) filter (where s.slug = 'liquid') / set_count,
      count(distinct f.set_checkin_id) filter (where s.slug = 'jump-up') / set_count
      into share_neuro, share_liquid, share_jump_up
      from unnest(facts) f, unnest(f.genre_ids) g
      join public.genres s on s.id = g;

    select count(distinct f.set_checkin_id) / set_count into share_closing
      from unnest(facts) f, unnest(f.tag_ids) t
      join public.tags tag on tag.id = t
      where tag.name = 'Closing';
  end if;

  select
    count(distinct f.event_id) filter (where v.venue_type = 'warehouse') / event_count,
    count(distinct f.event_id) filter (where v.venue_type = 'festival_site' or e.date_end > e.date_start) / event_count
    into share_warehouse, share_festival
    from unnest(facts) f
    join public.venues v on v.id = f.venue_id
    join public.events e on e.id = f.event_id;

  return case
    when set_count >= 5 and share_neuro >= 0.5 then 'neuro_purist'
    when set_count >= 5 and share_liquid >= 0.5 then 'liquid_soul'
    when set_count >= 5 and share_jump_up >= 0.5 then 'jump_up_menace'
    when set_count >= 5 and share_closing >= 0.3 then 'closing_crew'
    when share_warehouse >= 0.4 then 'warehouse_rat'
    when share_festival >= 0.4 then 'festival_tourist'
    when subgenres >= 8 then 'genre_hopper'
    when city_count >= 5 and city_count / event_count >= 0.4 then 'road_warrior'
    when top_city_events / event_count >= 0.8 then 'local_hero'
    else 'raver'
  end;
end;
$$;

-- Wrapped -------------------------------------------------------------------------------

-- Null: this person's Wrapped isn't for you. {"locked": ...}: the year hasn't opened yet.
create function public.get_wrapped(target_username text, period text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  owner public.profiles;
  parsed record;
  own boolean;
  viewer uuid := (select auth.uid());
  all_facts stats.facts[];
  facts stats.facts[];
  result jsonb;
  event_name text;
begin
  select * into parsed from wrapped.parse_period(period);
  if not public.has_profile() then
    return null;
  end if;

  select * into owner from public.profiles p where p.username = target_username;
  if owner.id is null then
    return null;
  end if;
  own := owner.id = viewer;
  if not own and not (public.can_see_profile(owner.id) and public.privacy_allows(owner.id, 'stats')) then
    return null;
  end if;
  if parsed.kind = 'year' and not wrapped.year_is_open(parsed.year) then
    return jsonb_build_object('locked', true, 'opens', make_date(parsed.year, 12, 1));
  end if;

  all_facts := array(select f from stats.visible_facts(owner.id, 'stats') f);
  facts := array(
    select f
    from unnest(all_facts) f
    where (parsed.date_from is null or f.event_date >= parsed.date_from)
      and (parsed.date_to is null or f.event_date <= parsed.date_to)
      and (parsed.event_id is null or f.event_id = parsed.event_id)
  );

  if parsed.event_id is not null and cardinality(facts) > 0 then
    select e.name into event_name from public.events e where e.id = parsed.event_id;
  end if;

  result := jsonb_build_object(
    'owner', jsonb_build_object('username', owner.username, 'display_name', owner.display_name, 'avatar_path', owner.avatar_path),
    'own', own,
    'period', jsonb_build_object('kind', parsed.kind, 'from', parsed.date_from, 'to', parsed.date_to, 'event_name', event_name),
    'in_progress', parsed.kind = 'year' and extract(year from current_date) = parsed.year
  );

  if cardinality(facts) = 0 then
    return result || jsonb_build_object('empty', true);
  end if;

  result := result || jsonb_build_object(
    'numbers', (
      select jsonb_build_object(
        'events', count(distinct f.event_id),
        'sets', count(distinct f.set_checkin_id),
        'venues', count(distinct f.venue_id),
        'cities', count(distinct lower(f.city)),
        'countries', count(distinct f.country_code),
        'avg_rating', round(avg(f.set_rating), 2),
        'artists', (select count(distinct a) from unnest(facts) x, unnest(x.artist_ids) a)
      )
      from unnest(facts) f
    ),
    'top_artist', (
      select to_jsonb(t) from (
        select d.key as id, d.label as name, count(distinct f.set_checkin_id) as sets
        from unnest(facts) f, lateral stats.fact_dim(f, 'artist', own) d
        group by d.key, d.label
        order by count(distinct f.set_checkin_id) desc, d.label
        limit 1
      ) t
    ),
    'top_venue', (
      select to_jsonb(t) from (
        select f.venue_id as id, f.venue_name as name, f.city, count(distinct f.event_id) as events
        from unnest(facts) f
        group by f.venue_id, f.venue_name, f.city
        order by count(distinct f.event_id) desc, f.venue_name
        limit 1
      ) t
    ),
    'genres', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select d.label, count(distinct f.set_checkin_id) as sets
        from unnest(facts) f, lateral stats.fact_dim(f, 'genre', own) d
        group by d.label
        order by count(distinct f.set_checkin_id) desc, d.label
        limit 5
      ) t
    ),
    'best_set', (
      select to_jsonb(t) from (
        select
          f.set_rating as rating,
          e.name as event,
          (
            select string_agg(a.name, ' & ' order by a.name)
            from public.set_artists sa
            join public.artists a on a.id = sa.artist_id
            where sa.set_id = f.set_id and (own or a.status = 'approved')
          ) as artists
        from unnest(facts) f
        join public.events e on e.id = f.event_id
        where f.set_rating is not null
        order by f.set_rating desc, f.event_date desc, f.set_id
        limit 1
      ) t
    ),
    'longest_night', (
      select to_jsonb(t) from (
        select e.name as event, f.event_date as date, count(distinct f.set_checkin_id) as sets
        from unnest(facts) f
        join public.events e on e.id = f.event_id
        group by e.name, f.event_date, f.checkin_id
        having count(distinct f.set_checkin_id) > 0
        order by count(distinct f.set_checkin_id) desc, f.event_date
        limit 1
      ) t
    ),
    'active_month', (
      select to_jsonb(t) from (
        select to_char(f.event_date, 'YYYY-MM') as month, count(distinct f.event_id) as events
        from unnest(facts) f
        group by to_char(f.event_date, 'YYYY-MM')
        order by count(distinct f.event_id) desc, to_char(f.event_date, 'YYYY-MM')
        limit 1
      ) t
    ),
    -- New means never seen before this period, as far as this viewer may know.
    'new_artists', (
      with firsts as (
        select a, min(x.event_date) as first_date
        from unnest(all_facts) x, unnest(x.artist_ids) a
        group by a
      ),
      fresh as (
        select distinct f.a
        from (select x.event_date, a from unnest(facts) x, unnest(x.artist_ids) a) f
        join firsts on firsts.a = f.a and firsts.first_date = f.event_date
        where parsed.date_from is null or firsts.first_date >= parsed.date_from
      )
      select jsonb_build_object(
        'count', (select count(*) from fresh),
        'names', (
          select coalesce(jsonb_agg(n.name order by n.name), '[]'::jsonb)
          from (
            select art.name
            from fresh
            join public.artists art on art.id = fresh.a and (own or art.status = 'approved')
            order by art.name
            limit 8
          ) n
        )
      )
    ),
    'persona', wrapped.persona(facts),
    -- Rave Buddy: the friend you went out with most, counting only what this viewer may see.
    'buddy', (
      select to_jsonb(t) from (
        select p.username, p.display_name, p.avatar_path, count(distinct c.event_id) as events
        from (select distinct f.event_id from unnest(facts) f) mine
        join public.event_checkins c on c.event_id = mine.event_id and c.user_id <> owner.id
        join public.friendships fr
          on fr.status = 'accepted' and fr.user_a = least(owner.id, c.user_id) and fr.user_b = greatest(owner.id, c.user_id)
        join public.profiles p on p.id = c.user_id
        where public.visibility_allows(c.user_id, coalesce(c.visibility, public.privacy_level(c.user_id, 'checkins')))
          and public.can_see_profile(p.id)
        group by p.username, p.display_name, p.avatar_path
        order by count(distinct c.event_id) desc, p.display_name
        limit 1
      ) t
    ),
    'badges', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', d.id,
        'category', d.category,
        'level', u.level,
        'name', coalesce(d.rule -> 'level_names' ->> (u.level - 1), d.name)
      ) order by u.awarded_at desc, d.name), '[]'::jsonb)
      from public.user_badges u
      join public.badge_definitions d on d.id = u.badge_id
      where u.user_id = owner.id
        and public.privacy_allows(owner.id, 'badges')
        and parsed.date_from is not null
        and u.awarded_at::date between parsed.date_from and parsed.date_to
    ),
    -- The map has its own privacy setting.
    'places', case when own or public.privacy_allows(owner.id, 'map') then (
      select jsonb_build_object(
        'countries', (select coalesce(jsonb_agg(distinct x.country_code), '[]'::jsonb) from unnest(facts) x),
        'cities', coalesce(jsonb_agg(c order by c.events desc, c.city), '[]'::jsonb)
      )
      from (
        select f.city, avg(f.lat) as lat, avg(f.lng) as lng, count(distinct f.event_id) as events
        from unnest(facts) f
        where f.lat is not null and f.lng is not null
        group by f.city
      ) c
    ) end,
    -- Own approved photos, plus a generated tile for every check-in without one.
    'collage', (
      with visible_checkins as (
        select f.checkin_id, f.event_id, f.event_date, f.venue_name,
          (array_agg(f.artist_ids[1]) filter (where cardinality(f.artist_ids) > 0))[1] as artist_id
        from unnest(facts) f
        group by f.checkin_id, f.event_id, f.event_date, f.venue_name
      ),
      photos as (
        select m.event_checkin_id, m.storage_path, v.event_date
        from public.media m
        join visible_checkins v on v.checkin_id = m.event_checkin_id
        where m.owner_id = owner.id
          and m.moderation_status = 'approved'
          and (own or public.privacy_allows(owner.id, 'photos'))
      )
      select coalesce(jsonb_agg(item.value order by item.sort_date desc), '[]'::jsonb)
      from (
        select p.event_date as sort_date, jsonb_build_object('type', 'photo', 'path', p.storage_path) as value
        from photos p
        union all
        select v.event_date, jsonb_build_object(
          'type', 'tile',
          'date', v.event_date,
          'venue', v.venue_name,
          'artist', (select a.name from public.artists a where a.id = v.artist_id and (own or a.status = 'approved'))
        )
        from visible_checkins v
        where not exists (select 1 from photos p where p.event_checkin_id = v.checkin_id)
      ) item
    )
  );
  return result;
end;
$$;

-- Strictly for the owner's own view: never part of get_wrapped, so never in a link or export.
create function public.get_my_spending(period text)
returns table (currency text, tickets numeric, other numeric, events bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select d.currency::text, coalesce(sum(d.ticket_price), 0), coalesce(sum(d.other_spend), 0), count(*)
  from public.private_checkin_data d
  join public.event_checkins c on c.id = d.event_checkin_id and c.user_id = (select auth.uid())
  join public.events e on e.id = c.event_id
  cross join wrapped.parse_period(period) p
  where (p.date_from is null or e.date_start >= p.date_from)
    and (p.date_to is null or e.date_start <= p.date_to)
    and (p.event_id is null or e.id = p.event_id)
    and (p.kind <> 'year' or wrapped.year_is_open(p.year))
  group by d.currency;
$$;

-- For the Wrapped badge: sharing your own yearly Wrapped.
create function public.mark_wrapped_shared(period text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  parsed record;
begin
  select * into parsed from wrapped.parse_period(period);
  if not public.has_profile() or parsed.kind <> 'year' or not wrapped.year_is_open(parsed.year) then
    return;
  end if;
  insert into wrapped.shares (user_id, year) values ((select auth.uid()), parsed.year)
  on conflict do nothing;
  perform badges.note((select auth.uid()), 'community');
end;
$$;

-- Community Wrapped ---------------------------------------------------------------------

create function public.list_community_wrapped()
returns setof integer
language sql
stable
security definer
set search_path = ''
as $$
  select y.year from wrapped.community_years y where public.has_profile() order by y.year desc;
$$;

-- Only what isn't private to its owner counts, and only once the admin has unlocked the year.
create function public.get_community_wrapped(for_year integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with shared as (
    select * from stats.shareable_facts() f where extract(year from f.event_date) = for_year
  )
  select jsonb_build_object(
    'year', for_year,
    'events', (select count(distinct event_id) from shared),
    'sets', (select count(distinct set_checkin_id) from shared),
    'ravers', (select count(distinct user_id) from shared),
    'top_artist', (
      select to_jsonb(t) from (
        select a.id, a.name, count(distinct f.set_checkin_id) as sets
        from shared f, unnest(f.artist_ids) x
        join public.artists a on a.id = x and a.status = 'approved'
        group by a.id, a.name
        order by count(distinct f.set_checkin_id) desc, a.name
        limit 1
      ) t
    ),
    'top_venue', (
      select to_jsonb(t) from (
        select f.venue_id as id, f.venue_name as name, f.city, count(distinct f.event_id) as events, count(distinct f.checkin_id) as checkins
        from shared f
        group by f.venue_id, f.venue_name, f.city
        order by count(distinct f.checkin_id) desc, f.venue_name
        limit 1
      ) t
    ),
    'best_sound', (
      select to_jsonb(t) from (
        select v.id, v.name, v.city, round(avg(c.rating_sound), 2) as rating
        from public.event_checkins c
        join public.events e on e.id = c.event_id and e.status = 'approved' and e.lifecycle = 'scheduled'
        join public.venues v on v.id = e.venue_id and v.status = 'approved'
        where extract(year from e.date_start) = for_year
          and coalesce(c.visibility, public.privacy_level(c.user_id, 'stats')) <> 'private'
        group by v.id, v.name, v.city
        having count(c.rating_sound) >= 2
        order by avg(c.rating_sound) desc, v.name
        limit 1
      ) t
    )
  )
  where public.has_profile()
    and exists (select 1 from wrapped.community_years y where y.year = for_year);
$$;

create function public.admin_set_community_wrapped(for_year integer, unlocked boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  if unlocked then
    insert into wrapped.community_years (year, unlocked_by) values (for_year, (select auth.uid()))
    on conflict do nothing;
  else
    delete from wrapped.community_years y where y.year = for_year;
  end if;
  insert into public.admin_audit_log (actor_id, action, entity_type, diff)
  values (
    (select auth.uid()),
    case when unlocked then 'unlock' else 'lock' end,
    'community_wrapped',
    jsonb_build_object('year', for_year)
  );
end;
$$;

-- Function access -----------------------------------------------------------------------

revoke execute on all functions in schema wrapped from public, anon, authenticated;
revoke execute on function
  public.get_wrapped(text, text),
  public.get_my_spending(text),
  public.mark_wrapped_shared(text),
  public.list_community_wrapped(),
  public.get_community_wrapped(integer),
  public.admin_set_community_wrapped(integer, boolean)
from public, anon;
grant execute on function
  public.get_wrapped(text, text),
  public.get_my_spending(text),
  public.mark_wrapped_shared(text),
  public.list_community_wrapped(),
  public.get_community_wrapped(integer),
  public.admin_set_community_wrapped(integer, boolean)
to authenticated, service_role;

-- The Wrapped badge counts the years you shared ------------------------------------------

create or replace function badges.custom_value(name text, uid uuid, facts badges.facts[], valid_from date, valid_to date)
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
    when 'wrapped_shared' then
      select count(*) into result from wrapped.shares s where s.user_id = uid;
    else
      result := 0;
  end case;
  return result;
end;
$$;
