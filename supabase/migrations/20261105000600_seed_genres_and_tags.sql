-- Curated reference data, needed in every environment, so it ships as a migration.

create function pg_temp.add_genres(parent text, names text[])
returns void
language sql
as $$
  insert into public.genres (name, slug, parent_id)
  select n,
    trim(both '-' from regexp_replace(lower(replace(n, '&', 'and')), '[^a-z0-9]+', '-', 'g')),
    (select id from public.genres where name = parent)
  from unnest(names) as n;
$$;

select pg_temp.add_genres(null, array['Electronic']);
select pg_temp.add_genres('Electronic', array['Drum & Bass', 'Techno', 'House', 'Dubstep', 'Trance', 'Hardstyle', 'Bass House', 'Breaks']);
select pg_temp.add_genres('Drum & Bass', array['Liquid', 'Neurofunk', 'Jump Up', 'Dancefloor', 'Jungle', 'Rollers/Minimal', 'Deep', 'Halftime', 'Crossbreed', 'Techstep', 'Drumfunk']);
select pg_temp.add_genres('Techno', array['Peak Time Techno', 'Hard Techno', 'Melodic Techno', 'Minimal Techno', 'Industrial Techno', 'Acid Techno']);
select pg_temp.add_genres('House', array['Deep House', 'Tech House', 'Progressive House', 'Afro House', 'Disco House']);
select pg_temp.add_genres('Dubstep', array['Brostep', 'Riddim', 'Deep Dubstep', 'Melodic Dubstep']);
select pg_temp.add_genres('Trance', array['Psytrance', 'Progressive Trance', 'Uplifting Trance', 'Hard Trance']);
select pg_temp.add_genres('Hardstyle', array['Euphoric Hardstyle', 'Rawstyle', 'Hardcore', 'Frenchcore']);
select pg_temp.add_genres('Bass House', array['UK Bass', 'G-House']);
select pg_temp.add_genres('Breaks', array['Breakbeat', 'Nu Skool Breaks', 'Big Beat']);

insert into public.tags (name, scope, status)
select n, 'set', 'approved'
from unnest(array[
  'Opening', 'Closing', 'Headliner', 'Vinyl', 'Showcase', 'Secret/Surprise Set', 'Extended Set',
  'All Night Long', 'Warm-up', 'Debut', 'Farewell/Last Gig', 'Classics Set', 'Special Guest',
  'Album/EP Launch', 'Dubplates'
]) as n;

insert into public.tags (name, scope, status)
select n, 'event', 'approved'
from unnest(array[
  'Festival', 'Private Party', 'Open Air', 'Club Night', 'Warehouse', 'Boat Party', 'Daytime',
  'Afterhour', 'Free Party', 'Pre-Party', 'Label Night', 'Charity', 'Theme Party',
  'Mixed Indoor/Outdoor', 'Multi-day'
]) as n;
