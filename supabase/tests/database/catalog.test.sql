-- Instagram links and the genres added later. Rolled back after each run.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(5);

insert into public.artists (id, name, slug, status) values
  ('00000000-0000-4000-a900-000000000001', 'Test Insta', 'test-insta', 'approved');
insert into public.promoters (id, name, slug, status) values
  ('00000000-0000-4000-a900-000000000002', 'Test Insta Promoter', 'test-insta-promoter', 'approved');

select lives_ok($$ update public.artists set instagram_url = 'https://www.instagram.com/test.insta_1/' where id = '00000000-0000-4000-a900-000000000001' $$, 'A profile link is accepted');
select throws_ok($$ update public.artists set instagram_url = 'javascript:alert(1)' where id = '00000000-0000-4000-a900-000000000001' $$, '23514', null, 'A script link is rejected');
select throws_ok($$ update public.promoters set instagram_url = 'https://evil.example/instagram.com/x/' where id = '00000000-0000-4000-a900-000000000002' $$, '23514', null, 'Another site is rejected for promoters too');
select is((select count(*)::int from public.genres where slug in ('4x4', 'bounce', 'ukg')), 3, 'The added genres exist');
select is((select count(*)::int from public.badge_definitions where name in ('4x4 Fan', 'Bounce Fan', 'UKG Fan')), 3, 'Each added genre has its badge');

select * from finish();
rollback;
