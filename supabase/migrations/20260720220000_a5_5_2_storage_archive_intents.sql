create table if not exists public.mcp_storage_archive_intents (
  idempotency_record_id uuid primary key
    references public.mcp_idempotency_records(id) on delete cascade,
  installation_id text not null,
  operation text not null check (operation in ('route.archive', 'route-customer.archive')),
  target_type text not null check (target_type in ('route', 'route_customer')),
  target_id text not null,
  delete_job_id text not null
    references public.mcp_storage_delete_jobs(id) on delete restrict,
  status text not null default 'processing' check (status in ('processing', 'completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (installation_id, operation, idempotency_record_id)
);

create index if not exists mcp_storage_archive_intents_job_status_idx
  on public.mcp_storage_archive_intents(delete_job_id, status);

revoke all on table public.mcp_storage_archive_intents from public, anon, authenticated;
grant select on table public.mcp_storage_archive_intents to service_role;

create or replace function public.mcp_prepare_storage_archive_intent(
  p_target_type text,
  p_target_id text,
  p_context jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_context jsonb := coalesce(p_context, '{}'::jsonb);
  v_installation_id text;
  v_request_id text;
  v_key text;
  v_operation text;
  v_route text;
  v_action text;
  v_aggregate_type text;
  v_payload jsonb;
  v_hash text;
  v_record public.mcp_idempotency_records%rowtype;
  v_claim jsonb;
  v_job public.mcp_storage_delete_jobs%rowtype;
  v_parent_exists boolean := false;
  v_media_count integer := 0;
  v_previous_media_count integer := 0;
  v_mode text := 'execute';
  v_terminal jsonb;
  v_result jsonb;
begin
  if jsonb_typeof(v_context) <> 'object' then
    raise exception 'invalid_context' using errcode = '23514';
  end if;
  if p_target_type not in ('route', 'route_customer') then
    raise exception 'invalid_storage_archive_target_type' using errcode = '23514';
  end if;
  if nullif(btrim(coalesce(p_target_id, '')), '') is null then
    raise exception 'storage_archive_target_id_required' using errcode = '23514';
  end if;

  v_installation_id := nullif(btrim(coalesce(v_context ->> 'installationId', '')), '');
  v_request_id := nullif(btrim(coalesce(v_context ->> 'requestId', '')), '');
  v_key := nullif(btrim(coalesce(v_context ->> 'idempotencyKey', '')), '');
  if v_installation_id is null then
    raise exception 'installation_id_required' using errcode = '23514';
  end if;
  if v_request_id is null then
    raise exception 'request_id_required' using errcode = '23514';
  end if;
  if v_key is null then
    raise exception 'idempotency_key_required' using errcode = '23514';
  end if;

  if p_target_type = 'route' then
    v_operation := 'route.archive';
    v_route := '/api/routes/:id/archive';
    v_action := 'archive_route';
    v_aggregate_type := 'route';
    v_payload := jsonb_build_object('routeId', p_target_id);
  else
    v_operation := 'route-customer.archive';
    v_route := '/api/route-customers/:id/archive';
    v_action := 'archive_route_customer';
    v_aggregate_type := 'route_customer';
    v_payload := jsonb_build_object('routeCustomerId', p_target_id);
  end if;
  v_hash := public.mcp_idempotency_request_hash(v_operation, v_payload);

  select * into v_record
    from public.mcp_idempotency_records
   where installation_id = v_installation_id
     and operation = v_operation
     and idempotency_key = v_key
   for update;

  if found then
    if v_record.request_hash <> v_hash then
      raise exception 'idempotency_key_conflict' using errcode = '23514';
    end if;

    if v_record.status = 'completed' then
      v_claim := public.mcp_idempotency_begin(
        v_operation,
        'POST',
        v_route,
        v_action,
        v_aggregate_type,
        p_target_id,
        v_payload,
        v_context,
        300
      );
      return jsonb_build_object(
        'mode', 'replay',
        'result', jsonb_build_object(
          'data', v_claim -> 'responsePayload',
          'meta', jsonb_build_object(
            'idempotency', jsonb_build_object(
              'replayed', true,
              'originalRequestId', v_claim ->> 'originalRequestId'
            )
          )
        )
      );
    end if;

    v_mode := 'resume';
    update public.mcp_idempotency_records
       set status = 'processing',
           last_request_id = v_request_id,
           actor_id = nullif(btrim(coalesce(v_context ->> 'actorId', '')), ''),
           actor_type = nullif(btrim(coalesce(v_context ->> 'actorType', '')), ''),
           actor_authentication = nullif(btrim(coalesce(v_context ->> 'actorAuthentication', '')), ''),
           last_attempt_at = now(),
           locked_until = now() + interval '5 minutes',
           attempt_count = attempt_count + 1,
           response_status = null,
           response_payload = null,
           completed_at = null,
           expires_at = null,
           error_code = null,
           updated_at = now()
     where id = v_record.id
     returning * into v_record;
  else
    v_claim := public.mcp_idempotency_begin(
      v_operation,
      'POST',
      v_route,
      v_action,
      v_aggregate_type,
      p_target_id,
      v_payload,
      v_context,
      300
    );

    if v_claim ->> 'mode' = 'replay' then
      return jsonb_build_object(
        'mode', 'replay',
        'result', jsonb_build_object(
          'data', v_claim -> 'responsePayload',
          'meta', jsonb_build_object(
            'idempotency', jsonb_build_object(
              'replayed', true,
              'originalRequestId', v_claim ->> 'originalRequestId'
            )
          )
        )
      );
    end if;

    select * into v_record
      from public.mcp_idempotency_records
     where id = (v_claim ->> 'recordId')::uuid
     for update;
  end if;

  if p_target_type = 'route' then
    perform 1
      from public.mcp_routes
     where id = p_target_id
     for update;
    v_parent_exists := found;
  else
    perform 1
      from public.mcp_route_customers
     where id = p_target_id
     for update;
    v_parent_exists := found;
  end if;

  select * into v_job
    from public.mcp_storage_delete_jobs
   where installation_id = v_installation_id
     and target_type = p_target_type
     and target_id = p_target_id
   for update;

  if not found then
    if not v_parent_exists then
      if p_target_type = 'route' then
        raise exception 'route_not_found' using errcode = '23503';
      end if;
      raise exception 'route_customer_not_found' using errcode = '23503';
    end if;

    insert into public.mcp_storage_delete_jobs (
      id,
      installation_id,
      target_type,
      target_id,
      status,
      requested_by,
      raw_payload
    ) values (
      'msdj_' || replace(gen_random_uuid()::text, '-', ''),
      v_installation_id,
      p_target_type,
      p_target_id,
      'pending',
      nullif(btrim(coalesce(v_context ->> 'actorId', '')), ''),
      jsonb_build_object(
        'archive_intent_record_id', v_record.id,
        'archive_intent_context', v_context
      )
    ) returning * into v_job;
  end if;

  if v_job.status <> 'completed' and v_parent_exists then
    if p_target_type = 'route' then
      update public.mcp_routes
         set active = false,
             raw_payload = coalesce(raw_payload, '{}'::jsonb) || jsonb_build_object(
               'hard_delete_job_id', v_job.id,
               'archive_intent_record_id', v_record.id,
               'hard_delete_requested_context', v_context
             ),
             updated_at = now()
       where id = p_target_id;

      update public.mcp_route_customers
         set active = false,
             updated_at = now()
       where route_id = p_target_id;

      update public.mcp_outlet_media media
         set status = 'deleting',
             delete_requested_at = coalesce(media.delete_requested_at, now()),
             last_delete_error = null,
             updated_at = now()
       where media.installation_id = v_installation_id
         and media.route_customer_id in (
           select route_customer.id
             from public.mcp_route_customers route_customer
            where route_customer.route_id = p_target_id
         )
         and media.status <> 'deleted';

      select count(*) into v_media_count
        from public.mcp_outlet_media media
        join public.mcp_route_customers route_customer
          on route_customer.id = media.route_customer_id
       where media.installation_id = v_installation_id
         and route_customer.route_id = p_target_id
         and media.status <> 'deleted';
    else
      update public.mcp_route_customers
         set active = false,
             raw_payload = coalesce(raw_payload, '{}'::jsonb) || jsonb_build_object(
               'hard_delete_job_id', v_job.id,
               'archive_intent_record_id', v_record.id,
               'hard_delete_requested_context', v_context
             ),
             updated_at = now()
       where id = p_target_id;

      update public.mcp_outlet_media
         set status = 'deleting',
             delete_requested_at = coalesce(delete_requested_at, now()),
             last_delete_error = null,
             updated_at = now()
       where installation_id = v_installation_id
         and route_customer_id = p_target_id
         and status <> 'deleted';

      select count(*) into v_media_count
        from public.mcp_outlet_media
       where installation_id = v_installation_id
         and route_customer_id = p_target_id
         and status <> 'deleted';
    end if;
  end if;

  if coalesce(v_job.raw_payload ->> 'archive_media_count', '') ~ '^\d+$' then
    v_previous_media_count := (v_job.raw_payload ->> 'archive_media_count')::integer;
  end if;
  v_media_count := greatest(v_previous_media_count, v_media_count);

  update public.mcp_storage_delete_jobs
     set requested_by = nullif(btrim(coalesce(v_context ->> 'actorId', '')), ''),
         raw_payload = coalesce(raw_payload, '{}'::jsonb) || jsonb_build_object(
           'archive_media_count', v_media_count,
           'latest_archive_intent_record_id', v_record.id,
           'latest_archive_intent_context', v_context
         ),
         updated_at = now()
   where id = v_job.id
   returning * into v_job;

  insert into public.mcp_storage_archive_intents (
    idempotency_record_id,
    installation_id,
    operation,
    target_type,
    target_id,
    delete_job_id,
    status
  ) values (
    v_record.id,
    v_installation_id,
    v_operation,
    p_target_type,
    p_target_id,
    v_job.id,
    case when v_job.status = 'completed' then 'completed' else 'processing' end
  )
  on conflict (idempotency_record_id)
  do update set
    delete_job_id = excluded.delete_job_id,
    status = excluded.status,
    completed_at = case when excluded.status = 'completed' then now() else null end,
    updated_at = now();

  if v_job.status = 'completed' then
    v_terminal := jsonb_build_object(
      'archived', true,
      'targetType', p_target_type,
      'targetId', p_target_id,
      'deleteJobId', v_job.id,
      'deletedMediaCount', v_media_count,
      'status', 'completed'
    );
    v_result := public.mcp_idempotency_complete(v_record.id, 200, v_terminal, p_target_id);
    update public.mcp_storage_archive_intents
       set status = 'completed',
           completed_at = now(),
           updated_at = now()
     where idempotency_record_id = v_record.id;
    return jsonb_build_object('mode', 'completed', 'result', v_result);
  end if;

  return jsonb_build_object(
    'mode', v_mode,
    'recordId', v_record.id,
    'deleteJob', to_jsonb(v_job),
    'parentExists', v_parent_exists,
    'mediaCount', v_media_count
  );
end;
$function$;

create or replace function public.mcp_prepare_idempotent_route_archive(
  p_route_id text,
  p_context jsonb
)
returns jsonb
language sql
security definer
set search_path = public
as $function$
  select public.mcp_prepare_storage_archive_intent('route', p_route_id, p_context);
$function$;

create or replace function public.mcp_prepare_idempotent_route_customer_archive(
  p_route_customer_id text,
  p_context jsonb
)
returns jsonb
language sql
security definer
set search_path = public
as $function$
  select public.mcp_prepare_storage_archive_intent('route_customer', p_route_customer_id, p_context);
$function$;

create or replace function public.mcp_complete_storage_archive_intents_on_job_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_intent record;
  v_media_count integer := 0;
  v_terminal jsonb;
begin
  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;

  if coalesce(new.raw_payload ->> 'archive_media_count', '') ~ '^\d+$' then
    v_media_count := (new.raw_payload ->> 'archive_media_count')::integer;
  end if;
  v_terminal := jsonb_build_object(
    'archived', true,
    'targetType', new.target_type,
    'targetId', new.target_id,
    'deleteJobId', new.id,
    'deletedMediaCount', v_media_count,
    'status', 'completed'
  );

  for v_intent in
    select intent.idempotency_record_id, record.status as record_status
      from public.mcp_storage_archive_intents intent
      join public.mcp_idempotency_records record
        on record.id = intent.idempotency_record_id
     where intent.delete_job_id = new.id
       and intent.status <> 'completed'
     for update of intent, record
  loop
    if v_intent.record_status = 'failed' then
      update public.mcp_idempotency_records
         set status = 'processing',
             updated_at = now()
       where id = v_intent.idempotency_record_id;
    end if;

    perform public.mcp_idempotency_complete(
      v_intent.idempotency_record_id,
      200,
      v_terminal,
      new.target_id
    );

    update public.mcp_storage_archive_intents
       set status = 'completed',
           completed_at = now(),
           updated_at = now()
     where idempotency_record_id = v_intent.idempotency_record_id;
  end loop;

  return new;
end;
$function$;

drop trigger if exists mcp_storage_delete_jobs_complete_archive_intents
  on public.mcp_storage_delete_jobs;
create trigger mcp_storage_delete_jobs_complete_archive_intents
after update of status on public.mcp_storage_delete_jobs
for each row
execute function public.mcp_complete_storage_archive_intents_on_job_completed();

create or replace function public.mcp_get_storage_archive_intent_result(
  p_record_id uuid,
  p_context jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_installation_id text;
  v_record public.mcp_idempotency_records%rowtype;
  v_intent public.mcp_storage_archive_intents%rowtype;
begin
  v_installation_id := nullif(btrim(coalesce(p_context ->> 'installationId', '')), '');
  if v_installation_id is null then
    raise exception 'installation_id_required' using errcode = '23514';
  end if;
  if p_record_id is null then
    raise exception 'archive_intent_record_id_required' using errcode = '23514';
  end if;

  select * into v_intent
    from public.mcp_storage_archive_intents
   where idempotency_record_id = p_record_id
     and installation_id = v_installation_id;
  if not found then
    raise exception 'storage_archive_intent_not_found' using errcode = '23503';
  end if;

  select * into v_record
    from public.mcp_idempotency_records
   where id = p_record_id
     and installation_id = v_installation_id;
  if not found then
    raise exception 'idempotency_record_not_found' using errcode = '23503';
  end if;
  if v_record.status <> 'completed' or v_record.response_payload is null then
    raise exception 'storage_archive_intent_not_completed' using errcode = '55000';
  end if;

  return jsonb_build_object(
    'data', v_record.response_payload,
    'meta', jsonb_build_object(
      'idempotency', jsonb_build_object(
        'replayed', false,
        'originalRequestId', v_record.original_request_id
      )
    )
  );
end;
$function$;

revoke execute on function public.mcp_prepare_storage_archive_intent(text, text, jsonb)
  from public, anon, authenticated, service_role;
revoke execute on function public.mcp_complete_storage_archive_intents_on_job_completed()
  from public, anon, authenticated, service_role;

revoke execute on function public.mcp_prepare_idempotent_route_archive(text, jsonb)
  from public, anon, authenticated;
grant execute on function public.mcp_prepare_idempotent_route_archive(text, jsonb)
  to service_role;

revoke execute on function public.mcp_prepare_idempotent_route_customer_archive(text, jsonb)
  from public, anon, authenticated;
grant execute on function public.mcp_prepare_idempotent_route_customer_archive(text, jsonb)
  to service_role;

revoke execute on function public.mcp_get_storage_archive_intent_result(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.mcp_get_storage_archive_intent_result(uuid, jsonb)
  to service_role;
