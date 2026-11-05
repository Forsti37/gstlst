-- User data: check-ins, social graph, notifications, moderation.

create table public.friendships (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  requested_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b), -- one row per pair
  check (requested_by in (user_a, user_b))
);

create table public.invite_codes (
  code text primary key,
  created_by uuid references public.profiles (id) on delete set null,
  max_uses integer not null default 1 check (max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.event_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  rating numeric(2, 1) check (rating between 0 and 5 and rating * 2 = floor(rating * 2)),
  rating_sound numeric(2, 1) check (rating_sound between 0 and 5 and rating_sound * 2 = floor(rating_sound * 2)),
  rating_crowd numeric(2, 1) check (rating_crowd between 0 and 5 and rating_crowd * 2 = floor(rating_crowd * 2)),
  rating_location numeric(2, 1) check (rating_location between 0 and 5 and rating_location * 2 = floor(rating_location * 2)),
  rating_lineup numeric(2, 1) check (rating_lineup between 0 and 5 and rating_lineup * 2 = floor(rating_lineup * 2)),
  text text check (char_length(text) <= 2000),
  visibility public.visibility not null default 'friends',
  verified_gps boolean not null default false,
  verified_admin boolean not null default false,
  imported boolean not null default false,
  client_uuid uuid not null unique, -- offline dedupe
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, event_id)
);

-- Deviation from the spec: the rating is required, except for history brought in by the
-- import, which has no ratings. Clients can't set "imported" (see the column grants).
create table public.set_checkins (
  id uuid primary key default gen_random_uuid(),
  event_checkin_id uuid not null references public.event_checkins (id) on delete cascade,
  set_id uuid not null references public.sets (id) on delete cascade,
  rating numeric(2, 1) check (rating between 0 and 5 and rating * 2 = floor(rating * 2)),
  text text check (char_length(text) <= 2000),
  imported boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_checkin_id, set_id),
  check (rating is not null or imported)
);

create table public.set_checkin_genres (
  set_checkin_id uuid not null references public.set_checkins (id) on delete cascade,
  genre_id uuid not null references public.genres (id) on delete cascade,
  primary key (set_checkin_id, genre_id)
);

create table public.set_checkin_tags (
  set_checkin_id uuid not null references public.set_checkins (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (set_checkin_id, tag_id)
);

create table public.checkin_companions (
  event_checkin_id uuid not null references public.event_checkins (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.companion_status not null default 'tagged',
  created_at timestamptz not null default now(),
  primary key (event_checkin_id, user_id)
);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  event_checkin_id uuid not null references public.event_checkins (id) on delete cascade,
  set_checkin_id uuid references public.set_checkins (id) on delete cascade,
  storage_path text not null unique,
  moderation_status public.moderation_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.reactions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.reaction_target not null,
  target_id uuid not null,
  kind public.reaction_kind not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

create table public.going (
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create table public.wishlist_artists (
  user_id uuid not null references public.profiles (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, artist_id)
);

-- Strictly private: owner only, never in feeds, exports, Wrapped links or admin views.
create table public.private_checkin_data (
  event_checkin_id uuid primary key references public.event_checkins (id) on delete cascade,
  ticket_price numeric(8, 2) check (ticket_price >= 0),
  other_spend numeric(8, 2) check (other_spend >= 0),
  currency char(3) not null default 'EUR'
);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.badge_definitions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null,
  icon text,
  category text not null,
  valid_from date,
  valid_to date,
  rule jsonb not null,
  created_at timestamptz not null default now()
);

create table public.user_badges (
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge_id uuid not null references public.badge_definitions (id) on delete cascade,
  level smallint not null default 1 check (level > 0),
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create table public.checkin_fun_facts (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references public.event_checkins (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

create table public.change_requests (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  diff jsonb not null,
  status public.request_status not null default 'pending',
  reason text,
  created_by uuid references public.profiles (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  target_type text not null,
  target_id uuid not null,
  reason text not null check (char_length(reason) <= 1000),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  diff jsonb,
  created_at timestamptz not null default now()
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  text text not null check (char_length(text) <= 4000),
  app_version text,
  device text,
  github_issue_url text,
  created_at timestamptz not null default now()
);

create trigger event_checkins_updated_at
  before update on public.event_checkins
  for each row execute function public.set_updated_at();

create trigger set_checkins_updated_at
  before update on public.set_checkins
  for each row execute function public.set_updated_at();

-- A block ends any friendship between the two users.
create function public.end_friendship_on_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.friendships
  where user_a = least(new.blocker_id, new.blocked_id)
    and user_b = greatest(new.blocker_id, new.blocked_id);
  return new;
end;
$$;

create trigger blocks_end_friendship
  after insert on public.blocks
  for each row execute function public.end_friendship_on_block();

create index friendships_user_b on public.friendships (user_b);
create index event_checkins_event on public.event_checkins (event_id);
create index event_checkins_user_created on public.event_checkins (user_id, created_at desc);
create index event_checkins_public_feed on public.event_checkins (created_at desc) where visibility = 'public';
create index set_checkins_set on public.set_checkins (set_id);
create index checkin_companions_user on public.checkin_companions (user_id);
create index media_checkin on public.media (event_checkin_id);
create index media_moderation on public.media (moderation_status) where moderation_status = 'pending';
create index reactions_target on public.reactions (target_type, target_id);
create index going_event on public.going (event_id);
create index blocks_blocked on public.blocks (blocked_id);
create index notifications_recipient on public.notifications (recipient_id, created_at desc);
create index change_requests_pending on public.change_requests (status) where status = 'pending';
create index reports_open on public.reports (created_at) where resolved_at is null;
