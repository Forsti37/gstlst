-- Fuzzy duplicate search and admin merge functions.

-- Security invoker: results follow the caller's RLS, so pending entries of others stay hidden.
create function public.search_entities(entity_type text, query text, max_results integer default 10)
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
        select v.id, v.name, extensions.similarity(v.name_normalized, q) as score, v.status
        from public.venues v
        where extensions.similarity(v.name_normalized, q) > 0.25 or v.name_normalized like q || '%'
        order by score desc, v.name
        limit max_results;
    when 'promoter' then
      return query
        select p.id, p.name, extensions.similarity(p.name_normalized, q) as score, p.status
        from public.promoters p
        where extensions.similarity(p.name_normalized, q) > 0.25 or p.name_normalized like q || '%'
        order by score desc, p.name
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

create function public.require_admin()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

create function public.log_merge(action text, entity_type text, kept uuid, removed uuid, removed_name text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, diff)
  values ((select auth.uid()), action, entity_type, kept, jsonb_build_object('merged_id', removed, 'merged_name', removed_name));
$$;

create function public.merge_artist(from_id uuid, to_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_name text;
begin
  perform public.require_admin();
  if from_id = to_id then
    raise exception 'Cannot merge an artist into itself';
  end if;
  select name into strict old_name from public.artists where id = from_id;
  perform 1 from public.artists where id = to_id;
  if not found then
    raise exception 'Target artist not found';
  end if;

  insert into public.set_artists (set_id, artist_id, role)
    select set_id, to_id, role from public.set_artists where artist_id = from_id
    on conflict do nothing;
  insert into public.artist_default_genres (artist_id, genre_id)
    select to_id, genre_id from public.artist_default_genres where artist_id = from_id
    on conflict do nothing;
  insert into public.wishlist_artists (user_id, artist_id, created_at)
    select user_id, to_id, created_at from public.wishlist_artists where artist_id = from_id
    on conflict do nothing;
  insert into public.artist_members (group_id, member_id)
    select to_id, member_id from public.artist_members where group_id = from_id and member_id <> to_id
    on conflict do nothing;
  insert into public.artist_members (group_id, member_id)
    select group_id, to_id from public.artist_members where member_id = from_id and group_id <> to_id
    on conflict do nothing;

  update public.artist_aliases set artist_id = to_id where artist_id = from_id;
  delete from public.artists where id = from_id;

  -- The old name stays findable, unless it normalizes to the kept name or an existing alias.
  insert into public.artist_aliases (artist_id, alias)
    select to_id, old_name
    where public.normalize_name(old_name) <> (select name_normalized from public.artists where id = to_id)
    on conflict (alias_normalized) do nothing;

  perform public.log_merge('merge_artist', 'artist', to_id, from_id, old_name);
end;
$$;

create function public.merge_venue(from_id uuid, to_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_name text;
begin
  perform public.require_admin();
  if from_id = to_id then
    raise exception 'Cannot merge a venue into itself';
  end if;
  select name into strict old_name from public.venues where id = from_id;
  update public.events set venue_id = to_id where venue_id = from_id;
  delete from public.venues where id = from_id;
  perform public.log_merge('merge_venue', 'venue', to_id, from_id, old_name);
end;
$$;

create function public.merge_promoter(from_id uuid, to_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_name text;
begin
  perform public.require_admin();
  if from_id = to_id then
    raise exception 'Cannot merge a promoter into itself';
  end if;
  select name into strict old_name from public.promoters where id = from_id;
  insert into public.event_promoters (event_id, promoter_id)
    select event_id, to_id from public.event_promoters where promoter_id = from_id
    on conflict do nothing;
  update public.event_series set default_promoter_id = to_id where default_promoter_id = from_id;
  delete from public.promoters where id = from_id;
  perform public.log_merge('merge_promoter', 'promoter', to_id, from_id, old_name);
end;
$$;

create function public.merge_event(from_id uuid, to_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_name text;
  c record;
  kept_checkin uuid;
begin
  perform public.require_admin();
  if from_id = to_id then
    raise exception 'Cannot merge an event into itself';
  end if;
  select name into strict old_name from public.events where id = from_id;

  -- Floors with the same name collapse into the kept event's floor.
  update public.sets s
    set floor_id = kept.id
    from public.floors old
    join public.floors kept on kept.event_id = to_id and kept.name = old.name
    where old.event_id = from_id and s.floor_id = old.id;
  delete from public.floors old
    where old.event_id = from_id
      and exists (select 1 from public.floors kept where kept.event_id = to_id and kept.name = old.name);
  update public.floors set event_id = to_id where event_id = from_id;

  update public.sets set event_id = to_id where event_id = from_id;

  -- A user who checked in to both keeps one check-in that holds all their sets.
  for c in select * from public.event_checkins where event_id = from_id loop
    select id into kept_checkin from public.event_checkins where event_id = to_id and user_id = c.user_id;
    if kept_checkin is null then
      update public.event_checkins set event_id = to_id where id = c.id;
    else
      update public.set_checkins set event_checkin_id = kept_checkin where event_checkin_id = c.id;
      update public.media set event_checkin_id = kept_checkin where event_checkin_id = c.id;
      update public.event_checkins
        set verified_gps = verified_gps or c.verified_gps,
            verified_admin = verified_admin or c.verified_admin
        where id = kept_checkin;
      delete from public.event_checkins where id = c.id;
    end if;
  end loop;

  insert into public.event_promoters (event_id, promoter_id)
    select to_id, promoter_id from public.event_promoters where event_id = from_id
    on conflict do nothing;
  insert into public.event_event_tags (event_id, tag_id)
    select to_id, tag_id from public.event_event_tags where event_id = from_id
    on conflict do nothing;
  insert into public.going (user_id, event_id, created_at)
    select user_id, to_id, created_at from public.going where event_id = from_id
    on conflict do nothing;

  delete from public.events where id = from_id;
  perform public.log_merge('merge_event', 'event', to_id, from_id, old_name);
end;
$$;

revoke execute on function
  public.search_entities(text, text, integer),
  public.require_admin(),
  public.log_merge(text, text, uuid, uuid, text),
  public.merge_artist(uuid, uuid),
  public.merge_venue(uuid, uuid),
  public.merge_promoter(uuid, uuid),
  public.merge_event(uuid, uuid)
from public, anon;

grant execute on function
  public.search_entities(text, text, integer),
  public.merge_artist(uuid, uuid),
  public.merge_venue(uuid, uuid),
  public.merge_promoter(uuid, uuid),
  public.merge_event(uuid, uuid)
to authenticated;
