-- Profiles and master data: series -> event -> floor -> set -> set artists.
-- Deviation from the spec: junction tables replace the array columns, so that every
-- reference is a real foreign key (see docs/SPEC.md).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_.]{3,30}$'),
  display_name text not null check (char_length(display_name) between 1 and 60),
  avatar_path text,
  home_city text,
  birth_year smallint not null,
  role public.user_role not null default 'user',
  language text not null default 'en' check (language in ('en', 'de')),
  privacy jsonb not null default '{"profile":"friends","stats":"friends","checkins":"friends","photos":"friends","badges":"friends","map":"friends"}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Minimum age 16. A trigger, because a check constraint can't depend on the current date.
create function public.enforce_minimum_age()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if extract(year from now())::int - new.birth_year < 16 then
    raise exception 'GSTLST requires a minimum age of 16' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger profiles_minimum_age
  before insert or update of birth_year on public.profiles
  for each row execute function public.enforce_minimum_age();

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  name_normalized text generated always as (public.normalize_name(name)) stored,
  city text not null,
  country_code char(2) not null,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  venue_type public.venue_type not null default 'other',
  status public.entity_status not null default 'pending',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (name_normalized, city)
);

create table public.promoters (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  name_normalized text generated always as (public.normalize_name(name)) stored,
  slug text not null unique,
  instagram_url text,
  status public.entity_status not null default 'pending',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.event_series (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique,
  default_promoter_id uuid references public.promoters (id) on delete set null,
  status public.entity_status not null default 'pending',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  series_id uuid references public.event_series (id) on delete set null,
  name text not null check (char_length(name) between 1 and 160),
  name_normalized text generated always as (public.normalize_name(name)) stored,
  date_start date not null,
  date_end date,
  venue_id uuid not null references public.venues (id),
  status public.entity_status not null default 'pending',
  lifecycle public.event_lifecycle not null default 'scheduled',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (date_end is null or date_end >= date_start),
  unique (name_normalized, date_start, venue_id)
);

create table public.event_promoters (
  event_id uuid not null references public.events (id) on delete cascade,
  promoter_id uuid not null references public.promoters (id) on delete cascade,
  primary key (event_id, promoter_id)
);

create table public.floors (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  sort smallint not null default 0,
  status public.entity_status not null default 'pending',
  created_by uuid references public.profiles (id) on delete set null,
  unique (event_id, name)
);

create table public.artists (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  name_normalized text generated always as (public.normalize_name(name)) stored,
  slug text not null unique,
  kind public.artist_kind not null default 'person',
  country_code char(2),
  instagram_url text,
  avatar_path text,
  claimed_by_user_id uuid references public.profiles (id) on delete set null,
  status public.entity_status not null default 'pending',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.artist_aliases (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists (id) on delete cascade,
  alias text not null,
  alias_normalized text generated always as (public.normalize_name(alias)) stored unique
);

create table public.artist_members (
  group_id uuid not null references public.artists (id) on delete cascade,
  member_id uuid not null references public.artists (id) on delete cascade,
  primary key (group_id, member_id),
  check (group_id <> member_id)
);

create table public.genres (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  parent_id uuid references public.genres (id) on delete restrict
);

create table public.artist_default_genres (
  artist_id uuid not null references public.artists (id) on delete cascade,
  genre_id uuid not null references public.genres (id) on delete cascade,
  primary key (artist_id, genre_id)
);

create table public.sets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  floor_id uuid references public.floors (id) on delete set null,
  set_type public.set_type not null default 'solo',
  start_at timestamptz,
  end_at timestamptz,
  status public.entity_status not null default 'pending',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (end_at is null or start_at is null or end_at > start_at)
);

create table public.set_artists (
  set_id uuid not null references public.sets (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  role public.set_artist_role not null default 'dj',
  primary key (set_id, artist_id, role)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  scope public.tag_scope not null,
  status public.entity_status not null default 'pending',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (name, scope)
);

create table public.event_event_tags (
  event_id uuid not null references public.events (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (event_id, tag_id)
);

-- Duplicate search and lookups.
create index venues_name_trgm on public.venues using gin (name_normalized extensions.gin_trgm_ops);
create index promoters_name_trgm on public.promoters using gin (name_normalized extensions.gin_trgm_ops);
create index artists_name_trgm on public.artists using gin (name_normalized extensions.gin_trgm_ops);
create index artist_aliases_trgm on public.artist_aliases using gin (alias_normalized extensions.gin_trgm_ops);
create index events_name_trgm on public.events using gin (name_normalized extensions.gin_trgm_ops);

create index events_date_start on public.events (date_start);
create index events_venue on public.events (venue_id);
create index events_series on public.events (series_id);
create index floors_event on public.floors (event_id);
create index sets_event on public.sets (event_id);
create index sets_floor on public.sets (floor_id);
create index set_artists_artist on public.set_artists (artist_id);
create index artist_aliases_artist on public.artist_aliases (artist_id);
create index artist_members_member on public.artist_members (member_id);
create index event_promoters_promoter on public.event_promoters (promoter_id);
