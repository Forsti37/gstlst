-- Grants and Row Level Security. See docs/SPEC.md, "Rules" and "Privacy".
-- Every table is login-only: the anon role gets nothing. Column grants keep clients away
-- from fields only the server may set (role, verified_*, imported, moderation_status).
-- Profile-area privacy (stats, map, ...) is enforced in phase 2.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant usage on schema public to authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Helpers ------------------------------------------------------------------------------
-- Security definer so that policies can read these tables without recursing into their RLS.

create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('moderator', 'admin')
  );
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships
    where user_a = least(a, b) and user_b = greatest(a, b) and status = 'accepted'
  );
$$;

create function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- Staff can't read private check-ins: their queues work on photos and master data.
create function public.can_view_checkin(checkin_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.event_checkins c
    where c.id = checkin_id
      and (
        c.user_id = (select auth.uid())
        or (
          not public.is_blocked_between(c.user_id, (select auth.uid()))
          and (
            c.visibility = 'public'
            or (c.visibility = 'friends' and public.are_friends(c.user_id, (select auth.uid())))
          )
        )
      )
  );
$$;

create function public.can_view_reaction_target(target public.reaction_target, id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case target
    when 'event_checkin' then public.can_view_checkin(id)
    else public.can_view_checkin((select s.event_checkin_id from public.set_checkins s where s.id = id))
  end;
$$;

-- Birth year and home region are not readable through the profiles table, even for the owner.
create function public.get_own_profile()
returns public.profiles
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.profiles where id = (select auth.uid());
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.normalize_name(text),
  public.is_staff(),
  public.is_admin(),
  public.are_friends(uuid, uuid),
  public.is_blocked_between(uuid, uuid),
  public.can_view_checkin(uuid),
  public.can_view_reaction_target(public.reaction_target, uuid),
  public.get_own_profile()
to authenticated;
grant execute on all functions in schema public to service_role;

-- Enable RLS everywhere ----------------------------------------------------------------

do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end;
$$;

-- Master data with a status ------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['venues', 'promoters', 'event_series', 'artists', 'tags'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format($p$
      create policy read_visible on public.%I for select to authenticated
      using (status = 'approved' or created_by = (select auth.uid()) or public.is_staff())
    $p$, t);
    execute format($p$
      create policy create_pending on public.%I for insert to authenticated
      with check (public.is_staff() or (created_by = (select auth.uid()) and status = 'pending'))
    $p$, t);
    execute format($p$
      create policy update_own_pending_or_staff on public.%I for update to authenticated
      using (public.is_staff() or (created_by = (select auth.uid()) and status = 'pending'))
      with check (public.is_staff() or (created_by = (select auth.uid()) and status = 'pending'))
    $p$, t);
    execute format($p$
      create policy delete_staff on public.%I for delete to authenticated
      using (public.is_staff())
    $p$, t);
  end loop;
end;
$$;

-- Events: cancelled and postponed events are hidden from everyone but staff.
grant select, insert, update, delete on public.events to authenticated;

create policy read_visible on public.events for select to authenticated
using (
  public.is_staff()
  or (lifecycle = 'scheduled' and (status = 'approved' or created_by = (select auth.uid())))
);
create policy create_pending on public.events for insert to authenticated
with check (public.is_staff() or (created_by = (select auth.uid()) and status = 'pending' and lifecycle = 'scheduled'));
create policy update_own_pending_or_staff on public.events for update to authenticated
using (public.is_staff() or (created_by = (select auth.uid()) and status = 'pending'))
with check (public.is_staff() or (created_by = (select auth.uid()) and status = 'pending' and lifecycle = 'scheduled'));
create policy delete_staff on public.events for delete to authenticated
using (public.is_staff());

-- Floors and sets also disappear with their event.
do $$
declare
  t text;
begin
  foreach t in array array['floors', 'sets'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format($p$
      create policy read_visible on public.%I for select to authenticated
      using (
        (status = 'approved' or created_by = (select auth.uid()) or public.is_staff())
        and exists (select 1 from public.events e where e.id = event_id)
      )
    $p$, t);
    execute format($p$
      create policy create_pending on public.%I for insert to authenticated
      with check (
        public.is_staff()
        or (
          created_by = (select auth.uid()) and status = 'pending'
          and exists (select 1 from public.events e where e.id = event_id)
        )
      )
    $p$, t);
    execute format($p$
      create policy update_own_pending_or_staff on public.%I for update to authenticated
      using (public.is_staff() or (created_by = (select auth.uid()) and status = 'pending'))
      with check (public.is_staff() or (created_by = (select auth.uid()) and status = 'pending'))
    $p$, t);
    execute format($p$
      create policy delete_staff on public.%I for delete to authenticated
      using (public.is_staff())
    $p$, t);
  end loop;
end;
$$;

-- Relations of master data: visible with their parent, editable by staff or by the
-- creator of a parent that is still pending.

grant select, insert, delete on public.event_promoters, public.set_artists, public.artist_aliases,
  public.artist_members, public.artist_default_genres to authenticated;
grant select, insert, delete on public.event_event_tags to authenticated;

create policy read_with_event on public.event_promoters for select to authenticated
using (exists (select 1 from public.events e where e.id = event_id));
create policy write_own_pending_or_staff on public.event_promoters for all to authenticated
using (public.is_staff() or exists (select 1 from public.events e where e.id = event_id and e.created_by = (select auth.uid()) and e.status = 'pending'))
with check (public.is_staff() or exists (select 1 from public.events e where e.id = event_id and e.created_by = (select auth.uid()) and e.status = 'pending'));

create policy read_with_set on public.set_artists for select to authenticated
using (exists (select 1 from public.sets s where s.id = set_id));
create policy write_own_pending_or_staff on public.set_artists for all to authenticated
using (public.is_staff() or exists (select 1 from public.sets s where s.id = set_id and s.created_by = (select auth.uid()) and s.status = 'pending'))
with check (public.is_staff() or exists (select 1 from public.sets s where s.id = set_id and s.created_by = (select auth.uid()) and s.status = 'pending'));

create policy read_with_artist on public.artist_aliases for select to authenticated
using (exists (select 1 from public.artists a where a.id = artist_id));
create policy write_own_pending_or_staff on public.artist_aliases for all to authenticated
using (public.is_staff() or exists (select 1 from public.artists a where a.id = artist_id and a.created_by = (select auth.uid()) and a.status = 'pending'))
with check (public.is_staff() or exists (select 1 from public.artists a where a.id = artist_id and a.created_by = (select auth.uid()) and a.status = 'pending'));

create policy read_with_artist on public.artist_members for select to authenticated
using (exists (select 1 from public.artists a where a.id = group_id));
create policy write_own_pending_or_staff on public.artist_members for all to authenticated
using (public.is_staff() or exists (select 1 from public.artists a where a.id = group_id and a.created_by = (select auth.uid()) and a.status = 'pending'))
with check (public.is_staff() or exists (select 1 from public.artists a where a.id = group_id and a.created_by = (select auth.uid()) and a.status = 'pending'));

create policy read_with_artist on public.artist_default_genres for select to authenticated
using (exists (select 1 from public.artists a where a.id = artist_id));
create policy write_own_pending_or_staff on public.artist_default_genres for all to authenticated
using (public.is_staff() or exists (select 1 from public.artists a where a.id = artist_id and a.created_by = (select auth.uid()) and a.status = 'pending'))
with check (public.is_staff() or exists (select 1 from public.artists a where a.id = artist_id and a.created_by = (select auth.uid()) and a.status = 'pending'));

-- Event tags are proposed through change_requests; only staff apply them.
create policy read_with_event on public.event_event_tags for select to authenticated
using (exists (select 1 from public.events e where e.id = event_id));
create policy write_staff on public.event_event_tags for all to authenticated
using (public.is_staff()) with check (public.is_staff());

grant select, insert, update, delete on public.genres to authenticated;
create policy read_all on public.genres for select to authenticated using (true);
create policy write_staff on public.genres for all to authenticated
using (public.is_staff()) with check (public.is_staff());

-- Profiles -----------------------------------------------------------------------------

grant select (id, username, display_name, avatar_path, role, language, privacy, created_at) on public.profiles to authenticated;
grant insert (id, username, display_name, avatar_path, home_city, birth_year, language, privacy) on public.profiles to authenticated;
grant update (username, display_name, avatar_path, home_city, language, privacy) on public.profiles to authenticated;

create policy read_unless_blocked on public.profiles for select to authenticated
using (id = (select auth.uid()) or public.is_staff() or not public.is_blocked_between(id, (select auth.uid())));
create policy create_own on public.profiles for insert to authenticated
with check (id = (select auth.uid()));
create policy update_own on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Social graph -------------------------------------------------------------------------

grant select, delete on public.friendships to authenticated;
grant insert (user_a, user_b, requested_by) on public.friendships to authenticated;
grant update (status) on public.friendships to authenticated;

create policy read_own on public.friendships for select to authenticated
using ((select auth.uid()) in (user_a, user_b));
create policy request on public.friendships for insert to authenticated
with check (
  requested_by = (select auth.uid())
  and status = 'pending'
  and not public.is_blocked_between(user_a, user_b)
);
create policy accept_received on public.friendships for update to authenticated
using ((select auth.uid()) in (user_a, user_b) and requested_by <> (select auth.uid()))
with check (status = 'accepted');
create policy remove_own on public.friendships for delete to authenticated
using ((select auth.uid()) in (user_a, user_b));

grant select, insert, delete on public.blocks to authenticated;
create policy own on public.blocks for all to authenticated
using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));

grant select, insert, update, delete on public.invite_codes to authenticated;
create policy admin_only on public.invite_codes for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Check-ins ----------------------------------------------------------------------------

grant select, delete on public.event_checkins to authenticated;
grant insert (id, user_id, event_id, rating, rating_sound, rating_crowd, rating_location, rating_lineup, text, visibility, client_uuid)
  on public.event_checkins to authenticated;
grant update (rating, rating_sound, rating_crowd, rating_location, rating_lineup, text, visibility)
  on public.event_checkins to authenticated;

create policy read_by_visibility on public.event_checkins for select to authenticated
using (public.can_view_checkin(id));
create policy create_own on public.event_checkins for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.events e where e.id = event_id)
);
create policy update_own on public.event_checkins for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy delete_own on public.event_checkins for delete to authenticated
using (user_id = (select auth.uid()));

grant select, delete on public.set_checkins to authenticated;
grant insert (id, event_checkin_id, set_id, rating, text) on public.set_checkins to authenticated;
grant update (rating, text) on public.set_checkins to authenticated;

create policy read_by_visibility on public.set_checkins for select to authenticated
using (public.can_view_checkin(event_checkin_id));
create policy create_own on public.set_checkins for insert to authenticated
with check (
  exists (select 1 from public.event_checkins c where c.id = event_checkin_id and c.user_id = (select auth.uid()))
  and exists (select 1 from public.sets s where s.id = set_id)
);
create policy update_own on public.set_checkins for update to authenticated
using (exists (select 1 from public.event_checkins c where c.id = event_checkin_id and c.user_id = (select auth.uid())))
with check (exists (select 1 from public.event_checkins c where c.id = event_checkin_id and c.user_id = (select auth.uid())));
create policy delete_own on public.set_checkins for delete to authenticated
using (exists (select 1 from public.event_checkins c where c.id = event_checkin_id and c.user_id = (select auth.uid())));

grant select, insert, delete on public.set_checkin_genres, public.set_checkin_tags to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['set_checkin_genres', 'set_checkin_tags'] loop
    execute format($p$
      create policy read_by_visibility on public.%I for select to authenticated
      using (exists (select 1 from public.set_checkins s where s.id = set_checkin_id))
    $p$, t);
    execute format($p$
      create policy write_own on public.%I for all to authenticated
      using (exists (
        select 1 from public.set_checkins s
        join public.event_checkins c on c.id = s.event_checkin_id
        where s.id = set_checkin_id and c.user_id = (select auth.uid())
      ))
      with check (exists (
        select 1 from public.set_checkins s
        join public.event_checkins c on c.id = s.event_checkin_id
        where s.id = set_checkin_id and c.user_id = (select auth.uid())
      ))
    $p$, t);
  end loop;
end;
$$;

grant select, delete on public.checkin_companions to authenticated;
grant insert (event_checkin_id, user_id) on public.checkin_companions to authenticated;
grant update (status) on public.checkin_companions to authenticated;

create policy read_involved on public.checkin_companions for select to authenticated
using (user_id = (select auth.uid()) or public.can_view_checkin(event_checkin_id));
create policy tag_friend on public.checkin_companions for insert to authenticated
with check (
  public.are_friends(user_id, (select auth.uid()))
  and exists (select 1 from public.event_checkins c where c.id = event_checkin_id and c.user_id = (select auth.uid()))
);
create policy adopt_own_tag on public.checkin_companions for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy remove_involved on public.checkin_companions for delete to authenticated
using (
  user_id = (select auth.uid())
  or exists (select 1 from public.event_checkins c where c.id = event_checkin_id and c.user_id = (select auth.uid()))
);

-- Photos are visible to others only after approval.
grant select, delete on public.media to authenticated;
grant insert (id, owner_id, event_checkin_id, set_checkin_id, storage_path) on public.media to authenticated;
grant update (moderation_status) on public.media to authenticated;

create policy read_approved_or_own_or_staff on public.media for select to authenticated
using (
  owner_id = (select auth.uid())
  or public.is_staff()
  or (moderation_status = 'approved' and public.can_view_checkin(event_checkin_id))
);
create policy create_own on public.media for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and exists (select 1 from public.event_checkins c where c.id = event_checkin_id and c.user_id = (select auth.uid()))
);
create policy moderate_staff on public.media for update to authenticated
using (public.is_staff()) with check (public.is_staff());
create policy delete_own_or_staff on public.media for delete to authenticated
using (owner_id = (select auth.uid()) or public.is_staff());

grant select, insert, delete on public.reactions to authenticated;
grant update (kind) on public.reactions to authenticated;

create policy read_with_target on public.reactions for select to authenticated
using (public.can_view_reaction_target(target_type, target_id) and not public.is_blocked_between(user_id, (select auth.uid())));
create policy create_own on public.reactions for insert to authenticated
with check (user_id = (select auth.uid()) and public.can_view_reaction_target(target_type, target_id));
create policy update_own on public.reactions for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy delete_own on public.reactions for delete to authenticated
using (user_id = (select auth.uid()));

-- Going and wishlist are visible to the user and their friends.
grant select, insert, delete on public.going, public.wishlist_artists to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['going', 'wishlist_artists'] loop
    execute format($p$
      create policy read_own_or_friends on public.%I for select to authenticated
      using (user_id = (select auth.uid()) or public.are_friends(user_id, (select auth.uid())))
    $p$, t);
    execute format($p$
      create policy create_own on public.%I for insert to authenticated
      with check (user_id = (select auth.uid()))
    $p$, t);
    execute format($p$
      create policy delete_own on public.%I for delete to authenticated
      using (user_id = (select auth.uid()))
    $p$, t);
  end loop;
end;
$$;

-- Owner only, without any exception for staff.
grant select, insert, update, delete on public.private_checkin_data to authenticated;
create policy owner_only on public.private_checkin_data for all to authenticated
using (exists (select 1 from public.event_checkins c where c.id = event_checkin_id and c.user_id = (select auth.uid())))
with check (exists (select 1 from public.event_checkins c where c.id = event_checkin_id and c.user_id = (select auth.uid())));

-- Badges, fun facts, notifications -----------------------------------------------------

grant select, insert, update, delete on public.badge_definitions to authenticated;
create policy read_all on public.badge_definitions for select to authenticated using (true);
create policy write_staff on public.badge_definitions for all to authenticated
using (public.is_staff()) with check (public.is_staff());

grant select on public.user_badges to authenticated;
create policy read_unless_blocked on public.user_badges for select to authenticated
using (not public.is_blocked_between(user_id, (select auth.uid())));

grant select on public.checkin_fun_facts to authenticated;
create policy owner_only on public.checkin_fun_facts for select to authenticated
using (exists (select 1 from public.event_checkins c where c.id = checkin_id and c.user_id = (select auth.uid())));

grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy recipient_only on public.notifications for select to authenticated
using (recipient_id = (select auth.uid()));
create policy mark_read on public.notifications for update to authenticated
using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));
create policy delete_own on public.notifications for delete to authenticated
using (recipient_id = (select auth.uid()));

grant select, insert, update, delete on public.push_subscriptions to authenticated;
create policy own on public.push_subscriptions for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Moderation ---------------------------------------------------------------------------

grant select on public.change_requests to authenticated;
grant insert (entity_type, entity_id, diff, created_by) on public.change_requests to authenticated;
grant update (status, reason, reviewed_by) on public.change_requests to authenticated;
create policy read_own_or_staff on public.change_requests for select to authenticated
using (created_by = (select auth.uid()) or public.is_staff());
create policy create_own on public.change_requests for insert to authenticated
with check (created_by = (select auth.uid()));
create policy review_staff on public.change_requests for update to authenticated
using (public.is_staff()) with check (public.is_staff());

grant select on public.reports to authenticated;
grant insert (reporter_id, target_type, target_id, reason) on public.reports to authenticated;
grant update (resolved_at) on public.reports to authenticated;
create policy read_staff on public.reports for select to authenticated using (public.is_staff());
create policy create_own on public.reports for insert to authenticated
with check (reporter_id = (select auth.uid()));
create policy resolve_staff on public.reports for update to authenticated
using (public.is_staff()) with check (public.is_staff());

grant select on public.admin_audit_log to authenticated;
create policy read_staff on public.admin_audit_log for select to authenticated using (public.is_staff());

grant select on public.feedback to authenticated;
grant insert (user_id, text, app_version, device) on public.feedback to authenticated;
create policy read_admin on public.feedback for select to authenticated using (public.is_admin());
create policy create_own on public.feedback for insert to authenticated
with check (user_id = (select auth.uid()));
