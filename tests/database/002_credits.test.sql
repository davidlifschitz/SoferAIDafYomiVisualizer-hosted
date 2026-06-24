begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(22);

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
    '10000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'delayed@example.com',
    '',
    null,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"provider":"google","email_verified":true}'::jsonb,
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'google@example.com',
    '',
    now(),
    '{"provider":"google","providers":["google"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'unverified@example.com',
    '',
    null,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

select is(
  (
    select count(*)::integer
    from public.profiles
    where id = '10000000-0000-0000-0000-000000000001'
  ),
  1,
  'an unverified auth user still receives a profile'
);

select is(
  (
    select coalesce(sum(amount), 0)::integer
    from public.credit_ledger
    where user_id = '10000000-0000-0000-0000-000000000001'
  ),
  0,
  'user metadata cannot spoof verification'
);

select is(
  (
    select count(*)::integer
    from public.credit_ledger
    where user_id = '10000000-0000-0000-0000-000000000003'
  ),
  0,
  'an unverified auth user receives no grant'
);

select is(
  (
    select coalesce(sum(amount), 0)::integer
    from public.credit_ledger
    where user_id = '10000000-0000-0000-0000-000000000002'
  ),
  5,
  'a verified Google auth user receives five credits'
);

select is(
  (
    select count(*)::integer
    from public.credit_ledger
    where user_id = '10000000-0000-0000-0000-000000000002'
      and reason = 'signup_grant'
  ),
  1,
  'the Google signup grant is recorded exactly once'
);

update auth.users
set email_confirmed_at = now(), updated_at = now()
where id = '10000000-0000-0000-0000-000000000001';

select is(
  (
    select coalesce(sum(amount), 0)::integer
    from public.credit_ledger
    where user_id = '10000000-0000-0000-0000-000000000001'
  ),
  5,
  'delayed email confirmation grants five credits'
);

update auth.users
set email_confirmed_at = email_confirmed_at, updated_at = now()
where id = '10000000-0000-0000-0000-000000000001';

select is(
  (
    select count(*)::integer
    from public.credit_ledger
    where user_id = '10000000-0000-0000-0000-000000000001'
      and reason = 'signup_grant'
  ),
  1,
  'repeated verification updates do not duplicate the grant'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);

select is(
  (select count(*)::integer from public.credit_ledger),
  1,
  'a user can select only their own ledger rows'
);

select is(
  public.get_credit_balance(),
  5::bigint,
  'the own-balance function returns the signed-in user balance'
);

select throws_ok(
  $$insert into public.credit_ledger (user_id, amount, reason, idempotency_key)
    values (
      '10000000-0000-0000-0000-000000000001',
      100,
      'admin_adjustment',
      'client-forgery'
    )$$,
  '42501',
  'permission denied for table credit_ledger',
  'an authenticated client cannot insert ledger entries'
);

select throws_ok(
  $$update public.credit_ledger set amount = 100$$,
  '42501',
  'permission denied for table credit_ledger',
  'an authenticated client cannot update ledger entries'
);

select throws_ok(
  $$delete from public.credit_ledger$$,
  '42501',
  'permission denied for table credit_ledger',
  'an authenticated client cannot delete ledger entries'
);

reset role;

select throws_ok(
  $$update public.credit_ledger
    set amount = amount + 1
    where user_id = '10000000-0000-0000-0000-000000000001'$$,
  'P0001',
  'credit_ledger is append-only',
  'even privileged updates are rejected'
);

select throws_ok(
  $$delete from public.credit_ledger
    where user_id = '10000000-0000-0000-0000-000000000001'$$,
  'P0001',
  'credit_ledger is append-only',
  'even privileged deletes are rejected'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000002',
  true
);

select is(
  (select count(*)::integer from public.credit_ledger),
  1,
  'ledger isolation also holds for a second user'
);

select is(
  public.get_credit_balance(),
  5::bigint,
  'the balance function cannot leak another user balance'
);

reset role;
set local role service_role;

select is(
  private.charge_credit(
    '10000000-0000-0000-0000-000000000001',
    'analysis:alpha',
    null
  ),
  4::bigint,
  'an atomic charge subtracts one credit'
);

select is(
  (
    select count(*)::integer
    from public.credit_ledger
    where user_id = '10000000-0000-0000-0000-000000000001'
      and amount = -1
      and idempotency_key = 'analysis:alpha'
  ),
  1,
  'the charge writes exactly one negative ledger row'
);

select is(
  private.charge_credit(
    '10000000-0000-0000-0000-000000000001',
    'analysis:alpha',
    null
  ),
  4::bigint,
  'repeating an idempotency key returns the stable balance'
);

select is(
  (
    select count(*)::integer
    from public.credit_ledger
    where user_id = '10000000-0000-0000-0000-000000000001'
      and amount = -1
      and idempotency_key = 'analysis:alpha'
  ),
  1,
  'an idempotent retry does not write another charge'
);

select throws_ok(
  $$select private.charge_credit(
      '10000000-0000-0000-0000-000000000003',
      'analysis:no-credit',
      null
    )$$,
  'P0001',
  'insufficient_credits',
  'charging a zero balance fails explicitly'
);

select is(
  (
    select count(*)::integer
    from public.credit_ledger
    where user_id = '10000000-0000-0000-0000-000000000003'
  ),
  0,
  'a failed charge writes no ledger row'
);

reset role;
select * from finish();
rollback;
