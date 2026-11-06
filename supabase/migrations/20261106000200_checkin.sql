-- Phase 3: GPS verification, event search, unique slugs, set ratings, photo storage.

-- When an event's night is over, plus the 12 hours a check-in counts as live. Without a
-- timetable, a night is taken to end at 06:00 on the morning after the last day.
create function public.event_live_until(target_event uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select max(s.end_at) from public.sets s where s.event_id = e.id),
    ((coalesce(e.date_end, e.date_start) + 1)::timestamp + interval '6 hours') at time zone 'Europe/Vienna'
  ) + interval '12 hours'
  from public.events e
  where e.id = target_event;
$$;

-- Great-circle distance in meters. Earth radius as used by GPS (WGS84 mean).
create function public.distance_meters(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 2 * 6371008.8 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )));
$$;

-- The coordinates are only compared here and never stored: only the result is. A negative
-- result leaves an existing verification alone, so that verification survives later edits.
create function public.verify_checkin_gps(checkin_id uuid, lat double precision, lng double precision, captured_at timestamptz)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
begin
  select c.verified_gps, c.event_id, e.date_start, v.lat as venue_lat, v.lng as venue_lng
    into target
    from public.event_checkins c
    join public.events e on e.id = c.event_id
    join public.venues v on v.id = e.venue_id
    where c.id = checkin_id and c.user_id = (select auth.uid());
  if not found then
    raise exception 'checkin_not_found' using errcode = 'insufficient_privilege';
  end if;
  if target.verified_gps then
    return true;
  end if;
  if target.venue_lat is null or target.venue_lng is null
    or lat is null or lng is null
    or captured_at > now() + interval '5 minutes'
    or captured_at < (target.date_start::timestamp at time zone 'Europe/Vienna')
    or captured_at > public.event_live_until(target.event_id)
    or public.distance_meters(lat, lng, target.venue_lat, target.venue_lng) > 500
  then
    return false;
  end if;
  update public.event_checkins set verified_gps = true where id = checkin_id;
  return true;
end;
$$;

-- Search --------------------------------------------------------------------------------

create or replace function public.search_entities(entity_type text, query text, max_results integer default 10)
returns table (id uuid, name text, score real, status public.entity_status)
language plpgsql
stable
set search_path = ''
as $$
declare
  q text := public.normalize_name(query);
begin
  if q = '' then
    return;
  end if;

  case entity_type
    when 'artist' then
      return query
        select a.id, a.name,
          greatest(
            extensions.similarity(a.name_normalized, q),
            coalesce(max(extensions.similarity(al.alias_normalized, q)), 0)
          ) as score,
          a.status
        from public.artists a
        left join public.artist_aliases al on al.artist_id = a.id
        group by a.id
        having extensions.similarity(a.name_normalized, q) > 0.25
          or a.name_normalized like q || '%'
          or coalesce(max(extensions.similarity(al.alias_normalized, q)), 0) > 0.25
        order by score desc, a.name
        limit max_results;
    when 'venue' then
      return query
        select v.id, v.name || ', ' || v.city, extensions.similarity(v.name_normalized, q) as score, v.status
        from public.venues v
        where extensions.similarity(v.name_normalized, q) > 0.25
          or v.name_normalized like q || '%'
          or public.normalize_name(v.city) like q || '%'
        order by score desc, v.name
        limit max_results;
    when 'promoter' then
      return query
        select p.id, p.name, extensions.similarity(p.name_normalized, q) as score, p.status
        from public.promoters p
        where extensions.similarity(p.name_normalized, q) > 0.25 or p.name_normalized like q || '%'
        order by score desc, p.name
        limit max_results;
    when 'series' then
      return query
        select s.id, s.name, extensions.similarity(public.normalize_name(s.name), q) as score, s.status
        from public.event_series s
        where extensions.similarity(public.normalize_name(s.name), q) > 0.25
          or public.normalize_name(s.name) like q || '%'
        order by score desc, s.name
        limit max_results;
    when 'event' then
      return query
        select e.id, e.name, extensions.similarity(e.name_normalized, q) as score, e.status
        from public.events e
        where extensions.similarity(e.name_normalized, q) > 0.25 or e.name_normalized like q || '%'
        order by score desc, e.date_start desc
        limit max_results;
    else
      raise exception 'Unknown entity type: %', entity_type using errcode = 'invalid_parameter_value';
  end case;
end;
$$;

-- Events with what a result list has to show. Security invoker: follows the caller's RLS.
create function public.search_events(query text, max_results integer default 20)
returns table (
  id uuid,
  name text,
  date_start date,
  date_end date,
  status public.entity_status,
  venue_name text,
  venue_city text
)
language sql
stable
set search_path = ''
as $$
  select e.id, e.name, e.date_start, e.date_end, e.status, v.name, v.city
  from public.events e
  left join public.venues v on v.id = e.venue_id
  where length(public.normalize_name(query)) >= 2
    and (
      extensions.similarity(e.name_normalized, public.normalize_name(query)) > 0.2
      or e.name_normalized like '%' || public.normalize_name(query) || '%'
    )
  order by extensions.similarity(e.name_normalized, public.normalize_name(query)) desc, e.date_start desc
  limit least(max_results, 50);
$$;

-- Average set ratings of an event, for the event page. Only ratings count, so the unrated
-- imported history stays out of it. Visibility of single check-ins doesn't matter for an average.
create function public.event_set_ratings(target_event uuid)
returns table (set_id uuid, average numeric, ratings bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select sc.set_id, round(avg(sc.rating), 1), count(sc.rating)
  from public.set_checkins sc
  join public.sets s on s.id = sc.set_id
  where s.event_id = target_event
    and sc.rating is not null
    and (select public.has_profile())
  group by sc.set_id;
$$;

-- Slugs: taken slugs get a suffix. Otherwise a hidden pending row of someone else would make
-- an insert fail for no reason the user could see.
create function public.ensure_unique_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  taken boolean;
begin
  loop
    execute format('select exists (select 1 from public.%I where slug = $1 and id <> $2)', tg_table_name)
      into taken using new.slug, new.id;
    exit when not taken;
    new.slug := new.slug || '-' || substr(md5(random()::text), 1, 4);
  end loop;
  return new;
end;
$$;

create trigger artists_unique_slug before insert on public.artists
  for each row execute function public.ensure_unique_slug();
create trigger promoters_unique_slug before insert on public.promoters
  for each row execute function public.ensure_unique_slug();
create trigger event_series_unique_slug before insert on public.event_series
  for each row execute function public.ensure_unique_slug();

-- Function access ----------------------------------------------------------------------

revoke execute on function
  public.event_live_until(uuid),
  public.distance_meters(double precision, double precision, double precision, double precision),
  public.verify_checkin_gps(uuid, double precision, double precision, timestamptz),
  public.search_entities(text, text, integer),
  public.search_events(text, integer),
  public.event_set_ratings(uuid),
  public.ensure_unique_slug()
from public, anon;

grant execute on function
  public.event_live_until(uuid),
  public.verify_checkin_gps(uuid, double precision, double precision, timestamptz),
  public.search_entities(text, text, integer),
  public.search_events(text, integer),
  public.event_set_ratings(uuid)
to authenticated;

-- Photos: a private bucket. Others read a photo only once its media row is visible to them,
-- which means approved, and allowed by the check-in and the owner's privacy settings ---------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 3145728, array['image/webp']);

create policy media_read_visible on storage.objects for select to authenticated
using (
  bucket_id = 'media'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (select 1 from public.media m where m.storage_path = name)
  )
);
create policy media_insert_own on storage.objects for insert to authenticated
with check (
  bucket_id = 'media'
  and (select public.has_profile())
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy media_delete_own on storage.objects for delete to authenticated
using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
