-- Phase 4: moderation queues, audit log, reports, roles, dashboard.
-- Decisions run through functions, so that each one is logged and its creator gets notified.

create function public.require_staff()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'Staff only' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

-- Merging is part of the queues, so moderators may do it too. Only the check changes.
do $$
declare
  fn text;
begin
  foreach fn in array array['merge_artist', 'merge_venue', 'merge_promoter', 'merge_event'] loop
    execute replace(
      pg_get_functiondef(format('public.%I(uuid, uuid)', fn)::regprocedure),
      'public.require_admin()',
      'public.require_staff()'
    );
  end loop;
end;
$$;

-- Audit: every change staff make to shared data, including direct edits in the catalog -----

create function public.audit_staff_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  new_row jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  changed jsonb;
begin
  if not public.is_staff() then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(n.key, jsonb_build_object('from', old_row -> n.key, 'to', n.value)), '{}')
      into changed
      from jsonb_each(new_row) n
      where n.value is distinct from old_row -> n.key;
    if changed = '{}' then
      return new;
    end if;
  else
    changed := coalesce(new_row, old_row);
  end if;
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, diff)
  values (
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    (coalesce(new_row, old_row) ->> 'id')::uuid,
    changed
  );
  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'venues', 'promoters', 'event_series', 'events', 'floors', 'artists', 'sets', 'tags', 'genres',
    'artist_aliases', 'artist_members', 'artist_default_genres', 'set_artists', 'event_promoters', 'event_event_tags'
  ] loop
    execute format(
      'create trigger audit_staff_change after insert or update or delete on public.%I for each row execute function public.audit_staff_change()',
      t
    );
  end loop;
end;
$$;

-- Helpers ------------------------------------------------------------------------------

create function public.log_decision(action text, entity_type text, entity_id uuid, details jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, diff)
  values ((select auth.uid()), action, entity_type, entity_id, details);
$$;

create function public.notify_decision(recipient uuid, kind text, payload jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (recipient_id, type, payload)
  select recipient, kind, payload
  where recipient is not null and recipient <> (select auth.uid());
$$;

-- Applies an edit, limited to the columns a reviewer may change. Empty values become null.
create function public.apply_entity_changes(entity_table text, entity_id uuid, changes jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed text[] := case entity_table
    when 'venues' then array['name', 'city', 'country_code', 'lat', 'lng', 'venue_type']
    when 'promoters' then array['name', 'instagram_url']
    when 'event_series' then array['name', 'default_promoter_id']
    when 'events' then array['name', 'date_start', 'date_end', 'series_id', 'venue_id']
    when 'floors' then array['name', 'sort']
    when 'artists' then array['name', 'kind', 'country_code', 'instagram_url']
    when 'sets' then array['set_type', 'floor_id', 'start_at', 'end_at']
    when 'tags' then array['name']
  end;
  setting record;
  column_type text;
begin
  if allowed is null then
    raise exception 'Unknown entity: %', entity_table using errcode = 'invalid_parameter_value';
  end if;
  for setting in select key, value from jsonb_each_text(coalesce(changes, '{}')) loop
    if not setting.key = any(allowed) then
      raise exception 'Field not editable: %', setting.key using errcode = 'invalid_parameter_value';
    end if;
    select format_type(a.atttypid, a.atttypmod) into strict column_type
      from pg_catalog.pg_attribute a
      where a.attrelid = format('public.%I', entity_table)::regclass and a.attname = setting.key;
    -- The search path is empty, so enum types have to be schema-qualified.
    if column_type in ('venue_type', 'artist_kind', 'set_type') then
      column_type := 'public.' || column_type;
    end if;
    execute format('update public.%I set %I = nullif($1, %L)::%s where id = $2', entity_table, setting.key, '', column_type)
      using setting.value, entity_id;
  end loop;
end;
$$;

-- Approving something also approves what it can't be shown without. Rejecting doesn't touch those.
create function public.approve_dependencies(entity_table text, entity_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if entity_table = 'events' then
    update public.venues v set status = 'approved' from public.events e where e.id = entity_id and v.id = e.venue_id and v.status = 'pending';
    update public.event_series s set status = 'approved' from public.events e where e.id = entity_id and s.id = e.series_id and s.status = 'pending';
    update public.promoters p set status = 'approved' from public.event_promoters ep where ep.event_id = entity_id and p.id = ep.promoter_id and p.status = 'pending';
  elsif entity_table = 'sets' then
    update public.artists a set status = 'approved' from public.set_artists sa where sa.set_id = entity_id and a.id = sa.artist_id and a.status = 'pending';
    update public.floors f set status = 'approved' from public.sets s where s.id = entity_id and f.id = s.floor_id and f.status = 'pending';
    perform public.approve_dependencies('events', s.event_id) from public.sets s where s.id = entity_id;
    update public.events e set status = 'approved' from public.sets s where s.id = entity_id and e.id = s.event_id and e.status = 'pending';
  elsif entity_table = 'floors' then
    perform public.approve_dependencies('events', f.event_id) from public.floors f where f.id = entity_id;
    update public.events e set status = 'approved' from public.floors f where f.id = entity_id and e.id = f.event_id and e.status = 'pending';
  end if;
end;
$$;

-- Master data queue --------------------------------------------------------------------

create function public.moderate_entity(entity_table text, entity_id uuid, decision text, reason text default null, changes jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  label text;
  creator uuid;
begin
  perform public.require_staff();
  if decision not in ('approve', 'reject') then
    raise exception 'Unknown decision: %', decision using errcode = 'invalid_parameter_value';
  end if;
  if decision = 'reject' and coalesce(trim(reason), '') = '' then
    raise exception 'reason_required';
  end if;

  perform public.apply_entity_changes(entity_table, entity_id, changes);

  execute format(
    case entity_table
      when 'sets' then
        $q$select coalesce((select string_agg(a.name, ' + ') from public.set_artists sa join public.artists a on a.id = sa.artist_id where sa.set_id = t.id), ''), t.created_by from public.%I t where t.id = $1$q$
      else
        $q$select t.name, t.created_by from public.%I t where t.id = $1$q$
    end,
    entity_table
  ) into label, creator using entity_id;
  if not found then
    raise exception 'entity_not_found';
  end if;

  execute format('update public.%I set status = $1 where id = $2', entity_table)
    using (case decision when 'approve' then 'approved' else 'rejected' end)::public.entity_status, entity_id;
  if decision = 'approve' then
    perform public.approve_dependencies(entity_table, entity_id);
  end if;

  perform public.log_decision(decision, entity_table, entity_id, jsonb_build_object('name', label, 'reason', reason, 'changes', changes));
  perform public.notify_decision(creator, 'data_decision', jsonb_build_object('entity_type', entity_table, 'name', label, 'decision', decision, 'reason', reason));
end;
$$;

-- Merges a pending entry into an existing one, and tells its creator.
create function public.moderate_merge(entity_table text, from_id uuid, to_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  label text;
  kept text;
  creator uuid;
begin
  perform public.require_staff();
  if entity_table not in ('artists', 'venues', 'promoters', 'events') then
    raise exception 'Unknown entity: %', entity_table using errcode = 'invalid_parameter_value';
  end if;
  execute format('select name, created_by from public.%I where id = $1', entity_table) into label, creator using from_id;
  execute format('select name from public.%I where id = $1', entity_table) into kept using to_id;
  case entity_table
    when 'artists' then perform public.merge_artist(from_id, to_id);
    when 'venues' then perform public.merge_venue(from_id, to_id);
    when 'promoters' then perform public.merge_promoter(from_id, to_id);
    when 'events' then perform public.merge_event(from_id, to_id);
  end case;
  perform public.notify_decision(creator, 'data_decision', jsonb_build_object('entity_type', entity_table, 'name', label, 'decision', 'merge', 'merged_into', kept));
end;
$$;

-- Change requests ----------------------------------------------------------------------

create function public.review_change_request(request_id uuid, decision text, reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  request public.change_requests;
  entry jsonb;
begin
  perform public.require_staff();
  select * into strict request from public.change_requests where id = request_id for update;
  if request.status <> 'pending' then
    raise exception 'already_reviewed';
  end if;
  if decision = 'reject' and coalesce(trim(reason), '') = '' then
    raise exception 'reason_required';
  end if;

  if decision = 'approve' then
    case request.entity_type
      when 'event_timetable' then
        for entry in select * from jsonb_array_elements(request.diff -> 'sets') loop
          update public.sets
            set start_at = (entry ->> 'start_at')::timestamptz,
                end_at = (entry ->> 'end_at')::timestamptz
            where id = (entry ->> 'set_id')::uuid and event_id = request.entity_id;
        end loop;
      when 'event_tags' then
        insert into public.event_event_tags (event_id, tag_id)
          select request.entity_id, value::uuid from jsonb_array_elements_text(request.diff -> 'add_tag_ids')
          on conflict do nothing;
      when 'event_correction' then
        perform public.apply_entity_changes('events', request.entity_id, request.diff);
      else
        raise exception 'Unknown request type: %', request.entity_type using errcode = 'invalid_parameter_value';
    end case;
  elsif decision <> 'reject' then
    raise exception 'Unknown decision: %', decision using errcode = 'invalid_parameter_value';
  end if;

  update public.change_requests
    set status = (case decision when 'approve' then 'approved' else 'rejected' end)::public.request_status,
        reason = review_change_request.reason,
        reviewed_by = (select auth.uid())
    where id = request_id;
  perform public.log_decision(decision, 'change_request', request_id, jsonb_build_object('type', request.entity_type, 'event', request.entity_id, 'reason', reason));
  perform public.notify_decision(request.created_by, 'request_decision', jsonb_build_object('entity_type', request.entity_type, 'decision', decision, 'reason', reason));
end;
$$;

-- Photos and reports -------------------------------------------------------------------

create function public.moderate_media(media_id uuid, decision text, reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  perform public.require_staff();
  if decision not in ('approve', 'reject') then
    raise exception 'Unknown decision: %', decision using errcode = 'invalid_parameter_value';
  end if;
  if decision = 'reject' and coalesce(trim(reason), '') = '' then
    raise exception 'reason_required';
  end if;
  update public.media
    set moderation_status = (case decision when 'approve' then 'approved' else 'rejected' end)::public.moderation_status
    where id = media_id
    returning owner_id into owner;
  if not found then
    raise exception 'entity_not_found';
  end if;
  perform public.log_decision(decision, 'media', media_id, jsonb_build_object('reason', reason));
  perform public.notify_decision(owner, 'photo_decision', jsonb_build_object('decision', decision, 'reason', reason));
end;
$$;

alter table public.profiles add column hidden_for_review boolean not null default false;
alter table public.reports add column previous_status public.moderation_status;
alter table public.reports add column resolution text;
alter table public.reports add column resolved_by uuid references public.profiles (id) on delete set null;
alter table public.reports add constraint reports_target_type_valid check (target_type in ('media', 'profile'));

create or replace function public.can_see_profile(profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select profile_id = (select auth.uid())
    or public.is_staff()
    or (
      not public.is_blocked_between(profile_id, (select auth.uid()))
      and not (select p.hidden_for_review from public.profiles p where p.id = profile_id)
      and (
        public.privacy_level(profile_id, 'profile') <> 'private'
        or exists (
          select 1 from public.friendships f
          where f.user_a = least(profile_id, (select auth.uid()))
            and f.user_b = greatest(profile_id, (select auth.uid()))
        )
      )
    );
$$;

create or replace function public.get_profile_by_username(target_username text)
returns table (id uuid, username text, display_name text, avatar_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_path
  from public.profiles p
  where p.username = lower(trim(target_username))
    and (select public.has_profile())
    and not public.is_blocked_between(p.id, (select auth.uid()))
    and (not p.hidden_for_review or p.id = (select auth.uid()) or public.is_staff());
$$;

create or replace function public.search_profiles(query text, max_results integer default 20)
returns table (id uuid, username text, display_name text, avatar_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_path
  from public.profiles p
  where (select public.has_profile())
    and p.id <> (select auth.uid())
    and not p.hidden_for_review
    and length(trim(query)) >= 2
    and public.privacy_level(p.id, 'profile') <> 'private'
    and not public.is_blocked_between(p.id, (select auth.uid()))
    and (
      p.username like lower(trim(query)) || '%'
      or extensions.similarity(p.username, lower(trim(query))) > 0.3
      or extensions.similarity(public.normalize_name(p.display_name), public.normalize_name(query)) > 0.3
    )
  order by extensions.similarity(p.username, lower(trim(query))) desc, p.username
  limit least(max_results, 50);
$$;

-- Reported content is hidden until it has been reviewed.
create function public.report_content(target_type text, target_id uuid, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous public.moderation_status;
begin
  if not public.has_profile() then
    raise exception 'not_authenticated' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(trim(reason), '') = '' then
    raise exception 'reason_required';
  end if;
  case target_type
    when 'media' then
      if not exists (select 1 from public.media m where m.id = target_id) then
        raise exception 'entity_not_found';
      end if;
      -- A photo that is already reported keeps the status it had before the first report.
      select m.moderation_status into previous from public.media m where m.id = target_id;
      if exists (select 1 from public.reports r where r.target_type = 'media' and r.target_id = report_content.target_id and r.resolved_at is null) then
        select r.previous_status into previous from public.reports r
          where r.target_type = 'media' and r.target_id = report_content.target_id and r.resolved_at is null
          limit 1;
      end if;
      update public.media set moderation_status = 'pending' where id = target_id;
    when 'profile' then
      update public.profiles set hidden_for_review = true where id = target_id;
      if not found then
        raise exception 'entity_not_found';
      end if;
    else
      raise exception 'Unknown target: %', target_type using errcode = 'invalid_parameter_value';
  end case;
  insert into public.reports (reporter_id, target_type, target_id, reason, previous_status)
  values ((select auth.uid()), target_type, target_id, trim(reason), previous);
end;
$$;

-- Dismiss brings the content back. Uphold removes the photo, or keeps the profile hidden.
create function public.resolve_report(report_id uuid, decision text, note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  report public.reports;
begin
  perform public.require_staff();
  if decision not in ('dismiss', 'uphold') then
    raise exception 'Unknown decision: %', decision using errcode = 'invalid_parameter_value';
  end if;
  select * into strict report from public.reports where id = report_id for update;
  if report.resolved_at is not null then
    raise exception 'already_reviewed';
  end if;

  -- All open reports about the same thing are settled together.
  if report.target_type = 'media' then
    update public.media
      set moderation_status = case decision when 'dismiss' then coalesce(report.previous_status, 'pending') else 'rejected'::public.moderation_status end
      where id = report.target_id;
  elsif decision = 'dismiss' then
    update public.profiles set hidden_for_review = false where id = report.target_id;
  end if;

  update public.reports
    set resolved_at = now(), resolved_by = (select auth.uid()), resolution = decision
    where target_type = report.target_type and target_id = report.target_id and resolved_at is null;
  perform public.log_decision(decision, 'report', report_id, jsonb_build_object('target_type', report.target_type, 'target_id', report.target_id, 'note', note));
end;
$$;

-- Clients go through the functions above, so that nothing skips the log.
revoke insert, update on public.reports from authenticated;
revoke update on public.media from authenticated;
revoke update on public.change_requests from authenticated;
drop policy create_own on public.reports;
drop policy resolve_staff on public.reports;
drop policy moderate_staff on public.media;
drop policy review_staff on public.change_requests;

-- Manual verification, roles, event lifecycle ------------------------------------------

-- Private check-ins stay out of this list too: staff get no view into them.
create function public.staff_list_checkins(target_username text)
returns table (id uuid, event_name text, date_start date, verified_gps boolean, verified_admin boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, e.name, e.date_start, c.verified_gps, c.verified_admin
  from public.event_checkins c
  join public.events e on e.id = c.event_id
  join public.profiles p on p.id = c.user_id
  where public.is_staff()
    and p.username = lower(trim(target_username))
    and coalesce(c.visibility, public.privacy_level(c.user_id, 'checkins')) <> 'private'
  order by e.date_start desc;
$$;

create function public.staff_verify_checkin(checkin_id uuid, verified boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_staff();
  update public.event_checkins set verified_admin = verified where id = checkin_id;
  if not found then
    raise exception 'entity_not_found';
  end if;
  perform public.log_decision(case when verified then 'verify' else 'unverify' end, 'event_checkin', checkin_id, null);
end;
$$;

create function public.set_event_lifecycle(event_id uuid, lifecycle public.event_lifecycle)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_staff();
  update public.events e set lifecycle = set_event_lifecycle.lifecycle where e.id = event_id;
  if not found then
    raise exception 'entity_not_found';
  end if;
end;
$$;

create function public.admin_list_members()
returns table (id uuid, username text, display_name text, role public.user_role, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.role, p.created_at
  from public.profiles p
  where public.is_admin()
  order by p.role desc, p.username;
$$;

-- Admins assign the moderator role, and nothing else: no second admin, and no self-demotion.
create function public.admin_set_moderator(target_user uuid, is_moderator boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  update public.profiles
    set role = case when is_moderator then 'moderator' else 'user' end::public.user_role
    where id = target_user and role <> 'admin';
  if not found then
    raise exception 'not_changeable';
  end if;
  perform public.log_decision(case when is_moderator then 'grant_moderator' else 'revoke_moderator' end, 'profile', target_user, null);
end;
$$;

-- Dashboard ----------------------------------------------------------------------------

create function public.staff_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_staff();
  return jsonb_build_object(
    'members', (select count(*) from public.profiles),
    'active_users_7d', (select count(distinct user_id) from public.event_checkins where created_at > now() - interval '7 days' and not imported),
    'checkins_per_week', (
      select coalesce(jsonb_agg(jsonb_build_object('week', w.week, 'count', w.count) order by w.week), '[]')
      from (
        select date_trunc('week', created_at)::date as week, count(*) as count
        from public.event_checkins
        where created_at > now() - interval '12 weeks' and not imported
        group by 1
      ) w
    ),
    'queues', jsonb_build_object(
      'data', (select sum(n) from (
        select count(*) as n from public.venues where status = 'pending'
        union all select count(*) from public.promoters where status = 'pending'
        union all select count(*) from public.event_series where status = 'pending'
        union all select count(*) from public.events where status = 'pending'
        union all select count(*) from public.floors where status = 'pending'
        union all select count(*) from public.artists where status = 'pending'
        union all select count(*) from public.sets where status = 'pending'
        union all select count(*) from public.tags where status = 'pending'
      ) q),
      'requests', (select count(*) from public.change_requests where status = 'pending'),
      'photos', (select count(*) from public.media where moderation_status = 'pending'),
      'reports', (select count(distinct (target_type, target_id)) from public.reports where resolved_at is null)
    )
  );
end;
$$;

-- Function access ----------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon;
grant execute on function public.keep_alive() to anon;
grant execute on function
  public.moderate_entity(text, uuid, text, text, jsonb),
  public.moderate_merge(text, uuid, uuid),
  public.review_change_request(uuid, text, text),
  public.moderate_media(uuid, text, text),
  public.report_content(text, uuid, text),
  public.resolve_report(uuid, text, text),
  public.staff_list_checkins(text),
  public.staff_verify_checkin(uuid, boolean),
  public.set_event_lifecycle(uuid, public.event_lifecycle),
  public.admin_list_members(),
  public.admin_set_moderator(uuid, boolean),
  public.staff_dashboard()
to authenticated;
grant execute on all functions in schema public to service_role;
