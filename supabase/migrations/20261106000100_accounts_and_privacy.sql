-- Phase 2: invite-only sign-up, privacy enforcement, friends, GDPR functions, avatars.
-- See docs/SPEC.md, "Feed & social", "Privacy" and "Legal & Compliance".

alter table public.profiles add column terms_accepted_at timestamptz;

-- Privacy settings ---------------------------------------------------------------------

create function public.is_valid_privacy(value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(value) = 'object'
    and not exists (
      select 1 from jsonb_each_text(value) as setting (area, level)
      where setting.area not in ('profile', 'stats', 'checkins', 'photos', 'badges', 'map')
        or setting.level not in ('public', 'friends', 'private')
    );
$$;

alter table public.profiles add constraint profiles_privacy_valid check (public.is_valid_privacy(privacy));

-- The strictest of profile and area setting. "private" means only the owner, friends included.
-- The enum is declared public < friends < private, so greatest() is the strictest.
create function public.privacy_level(owner uuid, area text)
returns public.visibility
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    coalesce((p.privacy ->> 'profile')::public.visibility, 'friends'),
    coalesce((p.privacy ->> area)::public.visibility, 'friends')
  )
  from public.profiles p
  where p.id = owner;
$$;

create function public.visibility_allows(owner uuid, level public.visibility)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select owner = (select auth.uid())
    or (
      not public.is_blocked_between(owner, (select auth.uid()))
      and (
        level = 'public'
        or (level = 'friends' and public.are_friends(owner, (select auth.uid())))
      )
    );
$$;

create function public.privacy_allows(owner uuid, area text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.visibility_allows(owner, public.privacy_level(owner, area));
$$;

-- A check-in without its own visibility follows the owner's settings, so that changing them
-- also covers existing check-ins. An explicit visibility overrides the settings.
alter table public.event_checkins alter column visibility drop not null;
alter table public.event_checkins alter column visibility drop default;
update public.event_checkins set visibility = null where imported;

create or replace function public.can_view_checkin(checkin_id uuid)
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
      and public.visibility_allows(c.user_id, coalesce(c.visibility, public.privacy_level(c.user_id, 'checkins')))
  );
$$;

-- Only members count: signing in with Google alone gives no access ----------------------

create function public.has_profile()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()));
$$;

do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format($p$
      create policy members_only on public.%I as restrictive for all to authenticated
      using ((select public.has_profile()))
      with check ((select public.has_profile()))
    $p$, t.tablename);
  end loop;
end;
$$;

-- Profiles -----------------------------------------------------------------------------

-- Private profiles stay out of listings. They can still be opened by exact username through
-- get_profile_by_username, because the link and QR code have to keep working.
create function public.can_see_profile(profile_id uuid)
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

drop policy read_unless_blocked on public.profiles;
create policy read_visible on public.profiles for select to authenticated
using (public.can_see_profile(id));

-- Sign-up goes through complete_signup, and usernames are permanent: the link and QR code hang on them.
drop policy create_own on public.profiles;
revoke insert on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
revoke select on public.profiles from authenticated;
grant select (id, username, display_name, avatar_path, created_at) on public.profiles to authenticated;
grant update (display_name, avatar_path, home_city, language, privacy) on public.profiles to authenticated;

drop function public.get_own_profile();
create function public.get_own_profile()
returns setof public.profiles
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.profiles where id = (select auth.uid());
$$;

create function public.complete_signup(
  invite_code text,
  username text,
  display_name text,
  birth_year integer,
  language text,
  accepted_terms boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  created public.profiles;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  if exists (select 1 from public.profiles p where p.id = uid) then
    raise exception 'already_signed_up';
  end if;
  if not coalesce(accepted_terms, false) then
    raise exception 'terms_not_accepted';
  end if;
  -- Checked before the invite is used. The birth year of someone too young is never stored.
  if birth_year is null or birth_year < 1900 or extract(year from now())::int - birth_year < 16 then
    raise exception 'too_young';
  end if;
  if username !~ '^[a-z0-9_.]{3,30}$' then
    raise exception 'invalid_username';
  end if;
  if exists (select 1 from public.profiles p where p.username = complete_signup.username) then
    raise exception 'username_taken';
  end if;

  update public.invite_codes i
    set used_count = i.used_count + 1
    where i.code = trim(invite_code)
      and i.used_count < i.max_uses
      and (i.expires_at is null or i.expires_at > now());
  if not found then
    raise exception 'invalid_invite';
  end if;

  insert into public.profiles (id, username, display_name, birth_year, language, terms_accepted_at)
  values (uid, complete_signup.username, trim(complete_signup.display_name), complete_signup.birth_year, coalesce(complete_signup.language, 'en'), now())
  returning * into created;
  return created;
end;
$$;

create function public.get_profile_by_username(target_username text)
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
    and not public.is_blocked_between(p.id, (select auth.uid()));
$$;

-- Private profiles don't appear here.
create function public.search_profiles(query text, max_results integer default 20)
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

-- Friends and blocks -------------------------------------------------------------------

create function public.list_friendships()
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_path text,
  status public.friendship_status,
  requested_by uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_path, f.status, f.requested_by
  from public.friendships f
  join public.profiles p
    on p.id = case when f.user_a = (select auth.uid()) then f.user_b else f.user_a end
  where (select public.has_profile())
    and (select auth.uid()) in (f.user_a, f.user_b)
  order by p.username;
$$;

create function public.list_blocked()
returns table (id uuid, username text, display_name text, avatar_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_path
  from public.blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = (select auth.uid())
  order by p.username;
$$;

-- Invites ------------------------------------------------------------------------------

create function public.admin_create_invite(max_uses integer default 1, expires_at timestamptz default null)
returns public.invite_codes
language plpgsql
security definer
set search_path = ''
as $$
declare
  created public.invite_codes;
begin
  perform public.require_admin();
  insert into public.invite_codes (code, created_by, max_uses, expires_at)
  values (encode(extensions.gen_random_bytes(6), 'hex'), (select auth.uid()), admin_create_invite.max_uses, admin_create_invite.expires_at)
  returning * into created;
  insert into public.admin_audit_log (actor_id, action, entity_type, diff)
  values ((select auth.uid()), 'create_invite', 'invite_code', jsonb_build_object('max_uses', created.max_uses, 'expires_at', created.expires_at));
  return created;
end;
$$;

-- GDPR ---------------------------------------------------------------------------------

create function public.export_my_data()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
  my_checkins as (select c.* from public.event_checkins c, me where c.user_id = me.id)
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p, me where p.id = me.id),
    'friendships', (select coalesce(jsonb_agg(to_jsonb(f)), '[]') from public.friendships f, me where me.id in (f.user_a, f.user_b)),
    'blocks', (select coalesce(jsonb_agg(to_jsonb(b)), '[]') from public.blocks b, me where b.blocker_id = me.id),
    'event_checkins', (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from my_checkins c),
    'set_checkins', (select coalesce(jsonb_agg(to_jsonb(s)), '[]') from public.set_checkins s where s.event_checkin_id in (select id from my_checkins)),
    'private_checkin_data', (select coalesce(jsonb_agg(to_jsonb(d)), '[]') from public.private_checkin_data d where d.event_checkin_id in (select id from my_checkins)),
    'companions', (select coalesce(jsonb_agg(to_jsonb(cc)), '[]') from public.checkin_companions cc, me where cc.user_id = me.id or cc.event_checkin_id in (select id from my_checkins)),
    'media', (select coalesce(jsonb_agg(to_jsonb(m)), '[]') from public.media m, me where m.owner_id = me.id),
    'reactions', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from public.reactions r, me where r.user_id = me.id),
    'going', (select coalesce(jsonb_agg(to_jsonb(g)), '[]') from public.going g, me where g.user_id = me.id),
    'wishlist', (select coalesce(jsonb_agg(to_jsonb(w)), '[]') from public.wishlist_artists w, me where w.user_id = me.id),
    'badges', (select coalesce(jsonb_agg(to_jsonb(u)), '[]') from public.user_badges u, me where u.user_id = me.id),
    'notifications', (select coalesce(jsonb_agg(to_jsonb(n)), '[]') from public.notifications n, me where n.recipient_id = me.id),
    'push_subscriptions', (select coalesce(jsonb_agg(jsonb_build_object('endpoint', ps.endpoint, 'created_at', ps.created_at)), '[]') from public.push_subscriptions ps, me where ps.user_id = me.id),
    'change_requests', (select coalesce(jsonb_agg(to_jsonb(cr)), '[]') from public.change_requests cr, me where cr.created_by = me.id),
    'reports', (select coalesce(jsonb_agg(to_jsonb(rp)), '[]') from public.reports rp, me where rp.reporter_id = me.id),
    'feedback', (select coalesce(jsonb_agg(to_jsonb(fb)), '[]') from public.feedback fb, me where fb.user_id = me.id)
  );
$$;

-- Cascades through profiles to check-ins and reactions. Master data stays, anonymized by its
-- "on delete set null". The app removes the user's storage files first, because storage
-- objects can only be deleted through the storage API.
create function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated';
  end if;
  delete from auth.users where id = (select auth.uid());
end;
$$;

-- Function access ----------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon;
grant execute on function public.keep_alive() to anon;
grant execute on function
  public.normalize_name(text),
  public.is_valid_privacy(jsonb),
  public.is_staff(),
  public.is_admin(),
  public.has_profile(),
  public.are_friends(uuid, uuid),
  public.is_blocked_between(uuid, uuid),
  public.privacy_level(uuid, text),
  public.visibility_allows(uuid, public.visibility),
  public.privacy_allows(uuid, text),
  public.can_see_profile(uuid),
  public.can_view_checkin(uuid),
  public.can_view_reaction_target(public.reaction_target, uuid),
  public.get_own_profile(),
  public.complete_signup(text, text, text, integer, text, boolean),
  public.get_profile_by_username(text),
  public.search_profiles(text, integer),
  public.list_friendships(),
  public.list_blocked(),
  public.admin_create_invite(integer, timestamptz),
  public.export_my_data(),
  public.delete_own_account(),
  public.search_entities(text, text, integer),
  public.merge_artist(uuid, uuid),
  public.merge_venue(uuid, uuid),
  public.merge_promoter(uuid, uuid),
  public.merge_event(uuid, uuid)
to authenticated;
grant execute on all functions in schema public to service_role;

-- Privacy of photos and badges ----------------------------------------------------------

drop policy read_approved_or_own_or_staff on public.media;
create policy read_approved_or_own_or_staff on public.media for select to authenticated
using (
  owner_id = (select auth.uid())
  or public.is_staff()
  or (
    moderation_status = 'approved'
    and public.can_view_checkin(event_checkin_id)
    and public.privacy_allows(owner_id, 'photos')
  )
);

drop policy read_unless_blocked on public.user_badges;
create policy read_by_privacy on public.user_badges for select to authenticated
using (public.privacy_allows(user_id, 'badges'));

-- Avatars: a private bucket, read through signed URLs, written only to the user's own folder ---

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 524288, array['image/webp']);

create policy avatars_read_members on storage.objects for select to authenticated
using (bucket_id = 'avatars' and (select public.has_profile()));
create policy avatars_insert_own on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_update_own on storage.objects for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_delete_own on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
