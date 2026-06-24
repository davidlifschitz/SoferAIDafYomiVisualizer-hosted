begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(15);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  (
    '20000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'owner@example.com',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'viewer@example.com',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.canonical_lectures (
  id,
  source_key,
  source_url,
  title
) values
  (
    '21000000-0000-0000-0000-000000000001',
    'public-lecture',
    'https://example.com/public',
    'Public lecture'
  ),
  (
    '21000000-0000-0000-0000-000000000002',
    'unlisted-lecture',
    'https://example.com/unlisted',
    'Unlisted lecture'
  ),
  (
    '21000000-0000-0000-0000-000000000003',
    'private-lecture',
    'https://example.com/private',
    'Private lecture'
  );

insert into public.analyses (
  id,
  canonical_lecture_id,
  requested_by,
  idempotency_key,
  status
) values
  (
    '22000000-0000-0000-0000-000000000001',
    '21000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'public-analysis',
    'complete'
  ),
  (
    '22000000-0000-0000-0000-000000000002',
    '21000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001',
    'unlisted-analysis',
    'complete'
  ),
  (
    '22000000-0000-0000-0000-000000000003',
    '21000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000001',
    'private-analysis',
    'complete'
  );

insert into public.user_results (
  id,
  user_id,
  analysis_id,
  publication_mode,
  public_id,
  title
) values
  (
    '23000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-000000000001',
    'public',
    '24000000-0000-0000-0000-000000000001',
    'Published result'
  ),
  (
    '23000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-000000000002',
    'unlisted',
    '24000000-0000-0000-0000-000000000002',
    'Unlisted result'
  ),
  (
    '23000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-000000000003',
    'private',
    '24000000-0000-0000-0000-000000000003',
    'Private result'
  );

insert into public.analysis_pages (
  analysis_id,
  page_number,
  daf_ref,
  storage_path,
  image_width,
  image_height
) values
  (
    '22000000-0000-0000-0000-000000000001',
    1,
    'Shabbat 2a',
    'public/page-1.png',
    1000,
    1400
  ),
  (
    '22000000-0000-0000-0000-000000000002',
    1,
    'Shabbat 3a',
    'unlisted/page-1.png',
    1000,
    1400
  ),
  (
    '22000000-0000-0000-0000-000000000003',
    1,
    'Shabbat 4a',
    'private/page-1.png',
    1000,
    1400
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-0000-0000-000000000001',
  true
);

select is(
  (select count(*)::integer from public.profiles),
  1,
  'a signed-in user can read only their own profile'
);

select is(
  (select count(*)::integer from public.user_results),
  3,
  'an owner can read all of their own results'
);

select lives_ok(
  $$update public.user_results
    set title = 'Corrected title',
        manual_start_ref = 'Shabbat 2a:1',
        manual_end_ref = 'Shabbat 2a:8',
        publication_mode = 'unlisted'
    where id = '23000000-0000-0000-0000-000000000003'$$,
  'an owner can update allowed result fields'
);

select is(
  (
    select title
    from public.user_results
    where id = '23000000-0000-0000-0000-000000000003'
  ),
  'Corrected title',
  'the allowed owner update is persisted'
);

select throws_ok(
  $$update public.user_results
    set user_id = '20000000-0000-0000-0000-000000000002'
    where id = '23000000-0000-0000-0000-000000000003'$$,
  '42501',
  'permission denied for table user_results',
  'an owner cannot transfer result ownership'
);

select throws_ok(
  $$update public.user_results
    set analysis_id = '22000000-0000-0000-0000-000000000002'
    where id = '23000000-0000-0000-0000-000000000003'$$,
  '42501',
  'permission denied for table user_results',
  'an owner cannot reassign a result analysis'
);

select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-0000-0000-000000000002',
  true
);

select is(
  (select count(*)::integer from public.user_results),
  1,
  'another signed-in user sees only published results'
);

create temporary table publication_rls_changed_count (changed_rows integer);

with changed as (
  update public.user_results
  set title = 'Unauthorized change'
  where id = '23000000-0000-0000-0000-000000000001'
  returning 1
)
insert into publication_rls_changed_count (changed_rows)
select count(*)::integer from changed;

select is(
  (select changed_rows from publication_rls_changed_count),
  0,
  'a non-owner cannot update a published result'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);

select is(
  (select count(*)::integer from public.user_results),
  1,
  'anonymous readers see listed public results'
);

select is(
  (
    select count(*)::integer
    from public.user_results
    where publication_mode = 'unlisted'
  ),
  0,
  'unlisted results are not directly anonymous'
);

select is(
  (
    select count(*)::integer
    from public.user_results
    where publication_mode = 'private'
  ),
  0,
  'private results are not directly anonymous'
);

select is(
  (select count(*)::integer from public.analyses),
  1,
  'anonymous readers see only analyses behind public results'
);

select is(
  (select count(*)::integer from public.analysis_pages),
  1,
  'anonymous readers see only pages behind public results'
);

select is(
  (select count(*)::integer from public.canonical_lectures),
  1,
  'anonymous readers see only lectures behind public results'
);

select throws_ok(
  $$select * from public.stripe_events$$,
  '42501',
  'permission denied for table stripe_events',
  'internal Stripe events are protected from anonymous reads'
);

reset role;
select * from finish();
rollback;
