-- Extensions, enums and name normalization. See docs/SPEC.md, "Data Model".

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

create type public.entity_status as enum ('pending', 'approved', 'rejected');
create type public.event_lifecycle as enum ('scheduled', 'cancelled', 'postponed');
create type public.venue_type as enum ('club', 'warehouse', 'open_air', 'festival_site', 'castle', 'pool', 'boat', 'other');
create type public.artist_kind as enum ('person', 'group');
create type public.set_type as enum ('solo', 'b2b', 'b2b2b', 'f2f', 'live', 'hybrid');
create type public.set_artist_role as enum ('dj', 'live', 'mc');
create type public.tag_scope as enum ('set', 'event');
create type public.user_role as enum ('user', 'moderator', 'admin');
create type public.friendship_status as enum ('pending', 'accepted');
create type public.visibility as enum ('public', 'friends', 'private');
create type public.companion_status as enum ('tagged', 'adopted');
create type public.moderation_status as enum ('pending', 'approved', 'rejected');
create type public.reaction_target as enum ('event_checkin', 'set_checkin');
create type public.reaction_kind as enum ('bassface', 'dance', 'fire');
create type public.request_status as enum ('pending', 'approved', 'rejected');

-- Lowercase, no accents, "&" and "+" unified, punctuation removed: "A.M.C." -> "amc",
-- "Camo & Krooked" -> "camo and krooked". Immutable so that it can back generated columns.
create function public.normalize_name(value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select trim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(value, ''))),
          '\s*[&+]\s*', ' and ', 'g'
        ),
        '[^[:alnum:] ]', '', 'g'
      ),
      '\s+', ' ', 'g'
    )
  );
$$;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
