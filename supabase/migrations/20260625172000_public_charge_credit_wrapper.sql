create or replace function public.charge_credit(
  p_user_id uuid,
  p_idempotency_key text,
  p_analysis_id uuid default null
)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select private.charge_credit(p_user_id, p_idempotency_key, p_analysis_id);
$$;

revoke all on function public.charge_credit(uuid, text, uuid) from public;
grant execute on function public.charge_credit(uuid, text, uuid) to service_role;