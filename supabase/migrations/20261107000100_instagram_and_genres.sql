-- Instagram links in one safe form, and three genres from the first round of artist genres.

-- Only real Instagram profile links, so that a link can never point anywhere else.
alter table public.artists add constraint artists_instagram_url_valid
  check (instagram_url is null or instagram_url ~ '^https://www\.instagram\.com/[A-Za-z0-9._]{1,30}/$');
alter table public.promoters add constraint promoters_instagram_url_valid
  check (instagram_url is null or instagram_url ~ '^https://www\.instagram\.com/[A-Za-z0-9._]{1,30}/$');

-- Bounce is a kind of techno. 4x4 and UKG stay main genres for now.
insert into public.genres (name, slug, parent_id)
select n, s, (select id from public.genres where name = parent)
from (values ('4x4', '4x4', 'Electronic'), ('Bounce', 'bounce', 'Techno'), ('UKG', 'ukg', 'Electronic')) as new_genres (n, s, parent)
where not exists (select 1 from public.genres g where g.slug = new_genres.s);

-- Like every other genre, each gets its badge.
insert into public.badge_definitions (category, name, description, description_de, rule)
select
  'genre',
  g.name || ' Fan',
  'Different artists with ' || g.name || ' sets',
  'Verschiedene Artists mit ' || g.name || '-Sets',
  jsonb_build_object('metric', 'count_distinct', 'subject', 'artist', 'filter', jsonb_build_object('genre', g.slug), 'levels', '[5,10,25,50]'::jsonb)
from public.genres g
where g.slug in ('4x4', 'bounce', 'ukg')
  and not exists (select 1 from public.badge_definitions d where d.name = g.name || ' Fan');
