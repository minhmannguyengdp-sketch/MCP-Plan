create table if not exists public.mcp_archive_intents (
  id text primary key,
  installation_id text not null,
  operation text not null check (operation in ('route.archive', 'route-customer.archive')),
  idempotency_key text not null,
  target_type text not null check (target_type in ('route', 'route_customer')),
  target_id text not null,
  request_payload jsonb not null default '{}'::jsonb,
  request_hash text not null,
  delete_job_id text references public.mcp_storage_delete_jobs(id),
  status text not null default 'pending' check (status in ('pending', 'processing', 'failed', 'completed')),
  response_status integer,
  response_payload jsonb,
  last_error text,
  attempt_count integer not null default 0,
  requested_by text,
  raw_payload jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (installation_id, operation, idempotency_key),
  unique (installation_id, target_type, target_id)
);

create index if not exists mcp_archive_intents_status_idx
  on public.mcp_archive_intents(installation_id, status, updated_at)
  where status in ('pending', 'processing', 'failed');

revoke all on table public.mcp_archive_intents from public, anon, authenticated;
grant select, insert, update on table public.mcp_archive_intents to service_role;

create or replace function public.mcp_claim_archive_intent(
  p_installation_id text,
  p_operation text,
  p_idempotency_key text,
  p_target_type text,
  p_target_id text,
  p_request_payload jsonb default '{}'::jsonb,
  p_context jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_intent public.mcp_archive_intents%rowtype;
  v_by_target public.mcp_archive_intents%rowtype;
  v_hash text;
  v_mode text := 'execute';
begin
  if nullif(btrim(coalesce(p_installation_id, '')), '') is null then
    raise exception 'installation_id_required' using errcode = '23514';
  end if;
  if p_operation not in ('route.archive', 'route-customer.archive') then
    raise exception 'invalid_archive_operation' using errcode = '23514';
  end if;
  if nullif(btrim(coalesce(p_idempotency_key, '')), '') is null then
    raise exception 'idempotency_key_required' using errcode = '23514';
  end if;
  if p_target_type not in ('route', 'route_customer') then
    raise exception 'invalid_archive_target_type' using errcode = '23514';
  end if;
  if nullif(btrim(coalesce(p_target_id, '')), '') is null then
    raise exception 'archive_target_id_required' using errcode = '23514';
  end if;
  if (p_operation = 'route.archive' and p_target_type <> 'route')
     or (p_operation = 'route-customer.archive' and p_target_type <> 'route_customer') then
    raise exception 'archive_operation_target_mismatch' using errcode = '23514';
  end if;

  v_hash := encode(digest(convert_to(coalesce(p_request_payload, '{}'::jsonb)::text, 'utf8'), 'sha256'), 'hex');

  select * into v_intent
    from public.mcp_archive_intents
   where installation_id = p_installation_id
     and operation = p_operation
     and idempotency_key = p_idempotency_key
   for update;

  if found then
    if v_intent.target_type is distinct from p_target_type
       or v_intent.target_id is distinct from p_target_id
       or v_intent.request_hash is distinct from v_hash then
      raise exception 'idempotency_key_conflict' using errcode = '23505';
    end if;
    v_mode := case when v_intent.status = 'completed' then 'replay' else 'resume' end;
    return jsonb_build_object('mode', v_mode, 'intent', to_jsonb(v_intent));
  end if;

  select * into v_by_target
    from public.mcp_archive_intents
   where installation_id = p_installation_id
     and target_type = p_target_type
     and target_id = p_target_id
   for update;

  if found then
    return jsonb_build_object(
      'mode', case when v_by_target.status = 'completed' then 'replay' else 'resume' end,
      'intent', to_jsonb(v_by_target)
    );
  end if;

  insert into public.mcp_archive_intents (
    id, installation_id, operation, idempotency_key,
    target_type, target_id, request_payload, request_hash,
    status, attempt_count, requested_by, raw_payload
  ) values (
    'mai_' || replace(gen_random_uuid()::text, '-', ''),
    p_installation_id,
    p_operation,
    p_idempotency_key,
    p_target_type,
    p_target_id,
    coalesce(p_request_payload, '{}'::jsonb),
    v_hash,
    'pending',
    0,
    nullif(btrim(coalesce(p_context ->> 'actorId', '')), ''),
    jsonb_build_object('request_context', coalesce(p_context, '{}'::jsonb))
  ) returning * into v_intent;

  return jsonb_build_object('mode', 'execute', 'intent', to_jsonb(v_intent));
end;
$function$;

create or replace function public.mcp_link_archive_intent_job(
  p_installation_id text,
  p_intent_id text,
  p_delete_job_id text,
  p_context jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_intent public.mcp_archive_intents%rowtype;
  v_job public.mcp_storage_delete_jobs%rowtype;
begin
  select * into v_intent
    from public.mcp_archive_intents
   where installation_id = p_installation_id
     and id = p_intent_id
   for update;
  if not found then raise exception 'archive_intent_not_found' using errcode = '23503'; end if;

  select * into v_job
    from public.mcp_storage_delete_jobs
   where installation_id = p_installation_id
     and id = p_delete_job_id
   for update;
  if not found then raise exception 'storage_delete_job_not_found' using errcode = '23503'; end if;

  if v_job.target_type is distinct from v_intent.target_type
     or v_job.target_id is distinct from v_intent.target_id then
    raise exception 'archive_intent_job_mismatch' using errcode = '23514';
  end if;
  if v_intent.delete_job_id is not null and v_intent.delete_job_id is distinct from v_job.id then
    raise exception 'archive_intent_job_conflict' using errcode = '23505';
  end if;

  update public.mcp_archive_intents
     set delete_job_id = v_job.id,
         status = case when status = 'completed' then 'completed' else 'processing' end,
         attempt_count = attempt_count + 1,
         last_error = null,
         raw_payload = coalesce(raw_payload, '{}'::jsonb) || jsonb_build_object(
           'link_context', coalesce(p_context, '{}'::jsonb)
         ),
         updated_at = now()
   where id = v_intent.id
   returning * into v_intent;

  return to_jsonb(v_intent);
end;
$function$;

create or replace function public.mcp_finish_archive_intent(
  p_installation_id text,
  p_intent_id text,
  p_succeeded boolean,
  p_response_status integer default null,
  p_response_payload jsonb default null,
  p_error text default null,
  p_context jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_intent public.mcp_archive_intents%rowtype;
begin
  select * into v_intent
    from public.mcp_archive_intents
   where installation_id = p_installation_id
     and id = p_intent_id
   for update;
  if not found then raise exception 'archive_intent_not_found' using errcode = '23503'; end if;

  if v_intent.status = 'completed' and coalesce(p_succeeded, false) is not true then
    raise exception 'archive_intent_already_completed' using errcode = '23514';
  end if;

  update public.mcp_archive_intents
     set status = case when coalesce(p_succeeded, false) then 'completed' else 'failed' end,
         response_status = case when coalesce(p_succeeded, false) then coalesce(p_response_status, 200) else null end,
         response_payload = case when coalesce(p_succeeded, false) then coalesce(p_response_payload, '{}'::jsonb) else response_payload end,
         last_error = case
           when coalesce(p_succeeded, false) then null
           else left(coalesce(nullif(btrim(p_error), ''), 'archive_failed'), 500)
         end,
         completed_at = case when coalesce(p_succeeded, false) then now() else null end,
         raw_payload = coalesce(raw_payload, '{}'::jsonb) || jsonb_build_object(
           'finish_context', coalesce(p_context, '{}'::jsonb)
         ),
         updated_at = now()
   where id = v_intent.id
   returning * into v_intent;

  return to_jsonb(v_intent);
end;
$function$;

revoke all on function public.mcp_claim_archive_intent(text, text, text, text, text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.mcp_claim_archive_intent(text, text, text, text, text, jsonb, jsonb)
  to service_role;

revoke all on function public.mcp_link_archive_intent_job(text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.mcp_link_archive_intent_job(text, text, text, jsonb)
  to service_role;

revoke all on function public.mcp_finish_archive_intent(text, text, boolean, integer, jsonb, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.mcp_finish_archive_intent(text, text, boolean, integer, jsonb, text, jsonb)
  to service_role;
