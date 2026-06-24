-- Application enums
create type public.profile_role as enum ('user', 'admin');
create type public.analysis_status as enum (
  'pending',
  'processing',
  'partial',
  'complete',
  'failed'
);
create type public.publication_mode as enum ('private', 'unlisted', 'public');
create type public.credit_reason as enum (
  'signup_grant',
  'analysis_charge',
  'purchase',
  'refund',
  'admin_adjustment'
);

-- Privileged schema for server-only database routines
create schema private;
revoke all on schema private from public;
grant usage on schema private to postgres, service_role;

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.profile_role not null default 'user',
  created_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);

-- Canonical lectures
create table public.canonical_lectures (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  source_url text not null,
  title text not null,
  created_at timestamptz not null default now(),
  constraint canonical_lectures_source_key_key unique (source_key)
);

-- Analyses
create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  canonical_lecture_id uuid not null references public.canonical_lectures (id),
  requested_by uuid not null references public.profiles (id),
  idempotency_key text not null,
  status public.analysis_status not null default 'pending',
  created_at timestamptz not null default now(),
  constraint analyses_idempotency_key_key unique (idempotency_key)
);

create index analyses_canonical_lecture_id_idx on public.analyses (canonical_lecture_id);
create index analyses_requested_by_idx on public.analyses (requested_by);
create index analyses_status_idx on public.analyses (status);

-- Append-only credit ledger
create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  amount integer not null,
  reason public.credit_reason not null,
  idempotency_key text not null,
  analysis_id uuid references public.analyses (id),
  created_at timestamptz not null default now(),
  constraint credit_ledger_idempotency_key_key unique (idempotency_key)
);

create index credit_ledger_user_id_idx on public.credit_ledger (user_id);
create index credit_ledger_analysis_id_idx on public.credit_ledger (analysis_id);

-- User-owned publication records
create table public.user_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  analysis_id uuid not null references public.analyses (id),
  publication_mode public.publication_mode not null default 'private',
  public_id uuid not null default gen_random_uuid(),
  title text not null,
  manual_start_ref text,
  manual_end_ref text,
  created_at timestamptz not null default now(),
  constraint user_results_analysis_id_key unique (analysis_id),
  constraint user_results_public_id_key unique (public_id)
);

create index user_results_user_id_idx on public.user_results (user_id);
create index user_results_publication_mode_idx on public.user_results (publication_mode);

-- Captured Mercava pages
create table public.analysis_pages (
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  page_number integer not null,
  daf_ref text not null,
  storage_path text not null,
  image_width integer not null,
  image_height integer not null,
  created_at timestamptz not null default now(),
  primary key (analysis_id, page_number)
);

-- Stripe customer mapping
create table public.stripe_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  stripe_customer_id text not null,
  created_at timestamptz not null default now(),
  constraint stripe_customers_user_id_key unique (user_id),
  constraint stripe_customers_stripe_customer_id_key unique (stripe_customer_id)
);

create index stripe_customers_user_id_idx on public.stripe_customers (user_id);

-- Stripe webhook idempotency log
create table public.stripe_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null,
  event_type text not null,
  created_at timestamptz not null default now(),
  constraint stripe_events_stripe_event_id_key unique (stripe_event_id)
);

-- Singleton operational settings
create table public.app_settings (
  id integer primary key default 1,
  submissions_paused boolean not null default false,
  monthly_spend_cap_cents integer,
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);

create index app_settings_updated_by_idx on public.app_settings (updated_by);

insert into public.app_settings (id) values (1);

-- Auth lifecycle: profile provisioning
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function private.handle_new_user();

-- Auth lifecycle: verified signup grant (+5 once)
create or replace function private.grant_signup_credits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is not null
    and (tg_op = 'INSERT' or old.email_confirmed_at is null)
  then
    insert into public.credit_ledger (user_id, amount, reason, idempotency_key)
    values (new.id, 5, 'signup_grant', 'signup:' || new.id::text)
    on conflict (idempotency_key) do nothing;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_verified
after insert or update of email_confirmed_at on auth.users
for each row
execute function private.grant_signup_credits();

-- Ledger immutability
create or replace function private.prevent_credit_ledger_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'credit_ledger is append-only'
    using errcode = 'P0001';
end;
$$;

create trigger credit_ledger_no_update
before update on public.credit_ledger
for each row
execute function private.prevent_credit_ledger_mutation();

create trigger credit_ledger_no_delete
before delete on public.credit_ledger
for each row
execute function private.prevent_credit_ledger_mutation();

-- Result ownership immutability
create or replace function private.prevent_user_result_reassignment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
    or new.analysis_id is distinct from old.analysis_id
  then
    raise exception 'permission denied for table user_results'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger user_results_immutable_refs
before update on public.user_results
for each row
execute function private.prevent_user_result_reassignment();

-- Exposed balance helper for the signed-in user only
create or replace function public.get_credit_balance()
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum(amount), 0)::bigint
  from public.credit_ledger
  where user_id = auth.uid();
$$;

-- Atomic, idempotent credit charge for trusted server callers
create or replace function private.charge_credit(
  p_user_id uuid,
  p_idempotency_key text,
  p_analysis_id uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance bigint;
begin
  perform 1
  from public.profiles
  where id = p_user_id
  for update;

  if exists (
    select 1
    from public.credit_ledger
    where idempotency_key = p_idempotency_key
  ) then
    return (
      select coalesce(sum(amount), 0)::bigint
      from public.credit_ledger
      where user_id = p_user_id
    );
  end if;

  select coalesce(sum(amount), 0)::bigint
  into v_balance
  from public.credit_ledger
  where user_id = p_user_id;

  if v_balance < 1 then
    raise exception 'insufficient_credits'
      using errcode = 'P0001';
  end if;

  insert into public.credit_ledger (
    user_id,
    amount,
    reason,
    idempotency_key,
    analysis_id
  )
  values (
    p_user_id,
    -1,
    'analysis_charge',
    p_idempotency_key,
    p_analysis_id
  );

  return v_balance - 1;
end;
$$;

revoke all on function private.charge_credit(uuid, text, uuid) from public;
grant execute on function private.charge_credit(uuid, text, uuid) to service_role;

-- Row level security
alter table public.profiles enable row level security;
alter table public.canonical_lectures enable row level security;
alter table public.analyses enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.user_results enable row level security;
alter table public.analysis_pages enable row level security;
alter table public.stripe_customers enable row level security;
alter table public.stripe_events enable row level security;
alter table public.app_settings enable row level security;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

create policy credit_ledger_select_own
on public.credit_ledger
for select
to authenticated
using (user_id = (select auth.uid()));

create policy user_results_select_visible
on public.user_results
for select
to authenticated, anon
using (
  publication_mode = 'public'::public.publication_mode
  or user_id = (select auth.uid())
);

create policy user_results_update_own
on public.user_results
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy analyses_select_visible
on public.analyses
for select
to authenticated, anon
using (
  requested_by = (select auth.uid())
  or exists (
    select 1
    from public.user_results ur
    where ur.analysis_id = analyses.id
      and ur.publication_mode = 'public'::public.publication_mode
  )
);

create policy analysis_pages_select_visible
on public.analysis_pages
for select
to authenticated, anon
using (
  exists (
    select 1
    from public.analyses a
    where a.id = analysis_pages.analysis_id
      and (
        a.requested_by = (select auth.uid())
        or exists (
          select 1
          from public.user_results ur
          where ur.analysis_id = a.id
            and ur.publication_mode = 'public'::public.publication_mode
        )
      )
  )
);

create policy canonical_lectures_select_visible
on public.canonical_lectures
for select
to authenticated, anon
using (
  exists (
    select 1
    from public.analyses a
    join public.user_results ur on ur.analysis_id = a.id
    where a.canonical_lecture_id = canonical_lectures.id
      and (
        a.requested_by = (select auth.uid())
        or ur.publication_mode = 'public'::public.publication_mode
      )
  )
);

-- Client privileges
grant select on public.profiles to authenticated;
grant select on public.credit_ledger to authenticated;
grant select, update on public.user_results to authenticated;
grant select on public.user_results to anon;
grant select on public.analyses to authenticated, anon;
grant select on public.analysis_pages to authenticated, anon;
grant select on public.canonical_lectures to authenticated, anon;
grant execute on function public.get_credit_balance() to authenticated;

revoke insert, update, delete on public.credit_ledger from anon, authenticated;
grant select on public.credit_ledger to service_role;
revoke all on table public.stripe_customers from anon, authenticated;
revoke all on table public.stripe_events from anon, authenticated;
revoke all on table public.app_settings from anon, authenticated;