begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(17);

select ok(
  (
    select array_agg(t.typname::text order by t.typname)
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname in (
        'analysis_status',
        'credit_reason',
        'profile_role',
        'publication_mode'
      )
  ) = array[
    'analysis_status',
    'credit_reason',
    'profile_role',
    'publication_mode'
  ],
  'required enums exist'
);

select ok(
  (
    select enum_range(null::public.profile_role)::text[]
  ) = array['user', 'admin'],
  'profile roles are constrained'
);

select ok(
  (
    select enum_range(null::public.analysis_status)::text[]
  ) = array['pending', 'processing', 'partial', 'complete', 'failed'],
  'analysis statuses cover the workflow'
);

select ok(
  (
    select enum_range(null::public.publication_mode)::text[]
  ) = array['private', 'unlisted', 'public'],
  'publication modes are constrained'
);

select ok(
  (
    select enum_range(null::public.credit_reason)::text[]
  ) = array[
    'signup_grant',
    'analysis_charge',
    'purchase',
    'refund',
    'admin_adjustment'
  ],
  'credit reasons are constrained'
);

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname in (
        'profiles',
        'canonical_lectures',
        'analyses',
        'credit_ledger',
        'user_results',
        'analysis_pages',
        'stripe_customers',
        'stripe_events',
        'app_settings'
      )
  ),
  9,
  'all required tables exist'
);

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'profiles',
        'canonical_lectures',
        'analyses',
        'credit_ledger',
        'user_results',
        'analysis_pages',
        'stripe_customers',
        'stripe_events',
        'app_settings'
      )
      and c.relrowsecurity
  ),
  9,
  'RLS is enabled on every public application table'
);

select is(
  (
    select count(*)::integer
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and constraint_type = 'FOREIGN KEY'
      and table_name in (
        'profiles',
        'canonical_lectures',
        'analyses',
        'credit_ledger',
        'user_results',
        'analysis_pages',
        'stripe_customers',
        'stripe_events',
        'app_settings'
      )
  ),
  10,
  'all required foreign keys exist'
);

select is(
  (
    with foreign_keys as (
      select
        con.conrelid,
        con.conkey
      from pg_constraint con
      join pg_namespace n on n.oid = con.connamespace
      where n.nspname = 'public'
        and con.contype = 'f'
    )
    select count(*)::integer
    from foreign_keys fk
    where not exists (
      select 1
      from pg_index i
      where i.indrelid = fk.conrelid
        and i.indisvalid
        and (i.indkey::smallint[])[0:cardinality(fk.conkey) - 1] = fk.conkey
    )
  ),
  0,
  'every foreign key has a leading index'
);

select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'public'
      and table_name in (
        'profiles',
        'canonical_lectures',
        'analyses',
        'credit_ledger',
        'user_results',
        'analysis_pages',
        'stripe_customers',
        'stripe_events',
        'app_settings'
      )
      and column_name = 'created_at'
      and is_nullable = 'NO'
  ),
  9,
  'all application tables have non-null creation timestamps'
);

select is(
  (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_credit_balance'
      and p.pronargs = 0
  ),
  1,
  'the exposed balance function accepts no target user'
);

select is(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_credit_balance'
      and p.pronargs = 0
  ),
  false,
  'the balance function is security invoker'
);

select ok(
  (
    select p.proconfig::text[]
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'charge_credit'
  ) && array['search_path=""']::text[],
  'the private charge function has an empty search path'
);

select is(
  (
    select has_function_privilege(
      'authenticated',
      p.oid,
      'EXECUTE'
    )
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'charge_credit'
  ),
  false,
  'authenticated clients cannot execute the charge function'
);

select is(
  (
    select has_function_privilege(
      'service_role',
      p.oid,
      'EXECUTE'
    )
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'charge_credit'
  ),
  true,
  'the service role can execute the charge function'
);

select ok(
  not has_table_privilege('authenticated', 'public.credit_ledger', 'INSERT')
  and not has_table_privilege('authenticated', 'public.credit_ledger', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.credit_ledger', 'DELETE'),
  'authenticated clients cannot mutate the ledger'
);

select ok(
  not has_table_privilege('anon', 'public.stripe_customers', 'SELECT')
  and not has_table_privilege('authenticated', 'public.stripe_customers', 'SELECT')
  and not has_table_privilege('anon', 'public.stripe_events', 'SELECT')
  and not has_table_privilege('authenticated', 'public.stripe_events', 'SELECT')
  and not has_table_privilege('anon', 'public.app_settings', 'SELECT')
  and not has_table_privilege('authenticated', 'public.app_settings', 'SELECT'),
  'internal tables have no client read grants'
);

select * from finish();
rollback;
