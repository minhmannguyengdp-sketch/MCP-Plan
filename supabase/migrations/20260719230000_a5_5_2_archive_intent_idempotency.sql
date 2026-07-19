alter table public.mcp_storage_delete_jobs
  add column if not exists idempotency_record_id uuid,
  add column if not exists idempotency_operation text,
  add column if not exists idempotency_key text;

do $block$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.mcp_storage_delete_jobs'::regclass
       and conname = 'mcp_storage_delete_jobs_idempotency_record_fkey'
  ) then
    alter table public.mcp_storage_delete_jobs
      add constraint mcp_storage_delete_jobs_idempotency_record_fkey
      foreign key (idempotency_record_id)
      references public.mcp_idempotency_records(id)
      on delete set null;
  end if;
end;
$block$;

create unique index if not exists mcp_storage_delete_jobs_idempotency_record_uidx
  on public.mcp_storage_delete_jobs(idempotency_record_id)
  where idempotency_record_id is not null;

create or replace function public.mcp_storage_delete_terminal_response(
  p_target_type text,
  p_target_id text,
  p_job_id text,
  p_raw_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
set search_path = public
as $function$
declare
  v_count integer := 0;
  v_response jsonb;
begin
  if coalesce(p_raw_payload ->> 'claimed_media_count', '') ~ '^[0-9]+$' then
    v_count := greatest((p_raw_payload ->> 'claimed_media_count')::integer, 0);
  end if;

  v_response := jsonb_build_object(
    'deleted', true,
    'deletedMediaCount', v_count,
    'deleteJobId', p_job_id
  );

  if p_target_type = 'route_customer' then
    return v_response || jsonb_build_object('routeCustomerId', p_target_id);
  elsif p_target_type = 'route' then
    return v_response || jsonb_build_object('routeId', p_target_id);
  end if;

  raise exception 'invalid_storage_delete_target_type' using errcode = '23514';
end;
$function$;

create or replace function public.mcp_claim_storage_delete_archive_intent(
  p_installation_id text,
  p_target_type text,
  p_target_id text,
  p_context jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_operation text;
  v_route text;
  v_aggregate_type text;
  v_key text := nullif(btrim(coalesce(p_context ->> 'idempotencyKey', '')), '');
  v_begin jsonb;
  v_record_id uuid;
  v_job public.mcp_storage_delete_jobs%rowtype;
  v_route_row public.mcp_routes%rowtype;
  v_customer_row public.mcp_route_customers%rowtype;
  v_parent_found boolean := false;
  v_media jsonb := '[]'::jsonb;
  v_media_count integer := 0;
  v_existing_count integer := 0;
  v_response jsonb;
  v_completion jsonb;
begin
  if nullif(btrim(coalesce(p_installation_id, '')), '') is null then
    raise exception 'installation_id_required' using errcode = '23514';
  end if;
  if nullif(btrim(coalesce(p_target_id, '')), '') is null then
    raise exception 'archive_target_id_required' using errcode = '23514';
  end if;

  if p_target_type = 'route_customer' then
    v_operation := 'route-customer.archive';
    v_route := '/api/route-customers/:id/archive';
    v_aggregate_type := 'route_customer';
  elsif p_target_type = 'route' then
    v_operation := 'route.archive';
    v_route := '/api/routes/:id/archive';
    v_aggregate_type := 'route';
  else
    raise exception 'invalid_storage_delete_target_type' using errcode = '23514';
  end if;

  v_begin := public.mcp_idempotency_begin(
    v_operation,
    'POST',
    v_route,
    'archive',
    v_aggregate_type,
    p_target_id,
    jsonb_build_object('targetType', p_target_type, 'targetId', p_target_id),
    coalesce(p_context, '{}'::jsonb),
    300
  );

  if v_begin ->> 'mode' = 'replay' then
    return jsonb_build_object(
      'mode', 'replay',
      'data', v_begin -> 'responsePayload',
      'meta', jsonb_build_object(
        'idempotency', jsonb_build_object(
          'replayed', true,
          'originalRequestId', v_begin ->> 'originalRequestId'
        )
      )
    );
  end if;

  v_record_id := (v_begin ->> 'recordId')::uuid;
  perform pg_advisory_xact_lock(hashtextextended(p_installation_id || ':' || p_target_type || ':' || p_target_id, 0));

  select * into v_job
    from public.mcp_storage_delete_jobs
   where installation_id = p_installation_id
     and target_type = p_target_type
     and target_id = p_target_id
   for update;

  if found and v_job.status = 'completed' then
    v_response := coalesce(
      v_job.raw_payload -> 'terminal_response',
      public.mcp_storage_delete_terminal_response(v_job.target_type, v_job.target_id, v_job.id, v_job.raw_payload)
    );
    v_completion := public.mcp_idempotency_complete(v_record_id, 200, v_response, p_target_id);
    return v_completion || jsonb_build_object('mode', 'completed', 'deleteJob', to_jsonb(v_job));
  end if;

  if found and (
    (v_job.idempotency_record_id is not null and v_job.idempotency_record_id <> v_record_id)
    or (v_job.idempotency_key is not null and v_job.idempotency_key <> v_key)
  ) then
    raise exception 'archive_intent_conflict' using errcode = '23514';
  end if;

  if p_target_type = 'route_customer' then
    select * into v_customer_row
      from public.mcp_route_customers
     where id = p_target_id
     for update;
    v_parent_found := found;
    if not v_parent_found and v_job.id is null then
      raise exception 'route_customer_not_found' using errcode = '23503';
    end if;
  else
    select * into v_route_row
      from public.mcp_routes
     where id = p_target_id
     for update;
    v_parent_found := found;
    if not v_parent_found and v_job.id is null then
      raise exception 'route_not_found' using errcode = '23503';
    end if;
  end if;

  if v_job.id is null then
    insert into public.mcp_storage_delete_jobs (
      id, installation_id, target_type, target_id, status, requested_by,
      idempotency_record_id, idempotency_operation, idempotency_key, raw_payload
    ) values (
      'msdj_' || replace(gen_random_uuid()::text, '-', ''),
      p_installation_id,
      p_target_type,
      p_target_id,
      'pending',
      nullif(btrim(coalesce(p_context ->> 'actorId', '')), ''),
      v_record_id,
      v_operation,
      v_key,
      jsonb_build_object(
        'request_context', coalesce(p_context, '{}'::jsonb),
        'archive_intent', jsonb_build_object('operation', v_operation, 'recordId', v_record_id, 'key', v_key)
      )
    ) returning * into v_job;
  else
    update public.mcp_storage_delete_jobs
       set status = 'pending',
           requested_by = nullif(btrim(coalesce(p_context ->> 'actorId', '')), ''),
           idempotency_record_id = v_record_id,
           idempotency_operation = v_operation,
           idempotency_key = v_key,
           last_error = null,
           raw_payload = coalesce(raw_payload, '{}'::jsonb) || jsonb_build_object(
             'request_context', coalesce(p_context, '{}'::jsonb),
             'archive_intent', jsonb_build_object('operation', v_operation, 'recordId', v_record_id, 'key', v_key)
           ),
           updated_at = now()
     where id = v_job.id
     returning * into v_job;
  end if;

  if p_target_type = 'route_customer' then
    if v_parent_found then
      update public.mcp_route_customers
         set active = false,
             raw_payload = coalesce(raw_payload, '{}'::jsonb) || jsonb_build_object(
               'hard_delete_job_id', v_job.id,
               'hard_delete_requested_context', coalesce(p_context, '{}'::jsonb)
             ),
             updated_at = now()
       where id = p_target_id
       returning * into v_customer_row;
    end if;

    update public.mcp_outlet_media
       set status = 'deleting',
           delete_requested_at = coalesce(delete_requested_at, now()),
           delete_attempt_count = delete_attempt_count + 1,
           last_delete_error = null,
           updated_at = now()
     where installation_id = p_installation_id
       and route_customer_id = p_target_id
       and status <> 'deleted';

    select coalesce(jsonb_agg(to_jsonb(media) order by media.created_at), '[]'::jsonb), count(*)::integer
      into v_media, v_media_count
      from public.mcp_outlet_media media
     where media.installation_id = p_installation_id
       and media.route_customer_id = p_target_id
       and media.status <> 'deleted';
  else
    if v_parent_found then
      update public.mcp_routes
         set active = false,
             raw_payload = coalesce(raw_payload, '{}'::jsonb) || jsonb_build_object(
               'hard_delete_job_id', v_job.id,
               'hard_delete_requested_context', coalesce(p_context, '{}'::jsonb)
             ),
             updated_at = now()
       where id = p_target_id
       returning * into v_route_row;

      update public.mcp_route_customers
         set active = false,
             updated_at = now()
       where route_id = p_target_id;
    end if;

    update public.mcp_outlet_media media
       set status = 'deleting',
           delete_requested_at = coalesce(media.delete_requested_at, now()),
           delete_attempt_count = media.delete_attempt_count + 1,
           last_delete_error = null,
           updated_at = now()
     where media.installation_id = p_installation_id
       and media.route_customer_id in (
         select route_customer.id from public.mcp_route_customers route_customer
          where route_customer.route_id = p_target_id
       )
       and media.status <> 'deleted';

    select coalesce(jsonb_agg(to_jsonb(media) order by media.created_at), '[]'::jsonb), count(*)::integer
      into v_media, v_media_count
      from public.mcp_outlet_media media
      join public.mcp_route_customers route_customer on route_customer.id = media.route_customer_id
     where media.installation_id = p_installation_id
       and route_customer.route_id = p_target_id
       and media.status <> 'deleted';
  end if;

  if coalesce(v_job.raw_payload ->> 'claimed_media_count', '') ~ '^[0-9]+$' then
    v_existing_count := (v_job.raw_payload ->> 'claimed_media_count')::integer;
  end if;

  update public.mcp_storage_delete_jobs
     set raw_payload = jsonb_set(
           coalesce(raw_payload, '{}'::jsonb),
           '{claimed_media_count}',
           to_jsonb(greatest(v_existing_count, v_media_count)),
           true
         ),
         updated_at = now()
   where id = v_job.id
   returning * into v_job;

  return jsonb_build_object(
    'mode', 'execute',
    'recordId', v_record_id,
    'deleteJob', to_jsonb(v_job),
    'route', case when p_target_type = 'route' and v_parent_found then to_jsonb(v_route_row) else null end,
    'routeCustomer', case when p_target_type = 'route_customer' and v_parent_found then to_jsonb(v_customer_row) else null end,
    'media', v_media
  );
end;
$function$;

create or replace function public.mcp_claim_route_customer_media_delete(
  p_installation_id text,
  p_route_customer_id text,
  p_context jsonb default '{}'::jsonb
)
returns jsonb
language sql
security definer
set search_path = public
as $function$
  select public.mcp_claim_storage_delete_archive_intent(
    p_installation_id,
    'route_customer',
    p_route_customer_id,
    coalesce(p_context, '{}'::jsonb)
  );
$function$;

create or replace function public.mcp_claim_route_media_delete(
  p_installation_id text,
  p_route_id text,
  p_context jsonb default '{}'::jsonb
)
returns jsonb
language sql
security definer
set search_path = public
as $function$
  select public.mcp_claim_storage_delete_archive_intent(
    p_installation_id,
    'route',
    p_route_id,
    coalesce(p_context, '{}'::jsonb)
  );
$function$;

create or replace function public.mcp_finish_storage_delete_job(
  p_installation_id text,
  p_job_id text,
  p_succeeded boolean,
  p_error text default null,
  p_context jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_intent_id uuid;
  v_job public.mcp_storage_delete_jobs%rowtype;
  v_record public.mcp_idempotency_records%rowtype;
  v_response jsonb;
  v_completion jsonb := null;
begin
  if nullif(btrim(coalesce(p_installation_id, '')), '') is null then
    raise exception 'installation_id_required' using errcode = '23514';
  end if;
  if nullif(btrim(coalesce(p_job_id, '')), '') is null then
    raise exception 'delete_job_id_required' using errcode = '23514';
  end if;

  select idempotency_record_id into v_intent_id
    from public.mcp_storage_delete_jobs
   where installation_id = p_installation_id and id = p_job_id;
  if not found then
    raise exception 'storage_delete_job_not_found' using errcode = '23503';
  end if;

  if v_intent_id is not null then
    perform 1 from public.mcp_idempotency_records where id = v_intent_id for update;
  end if;

  select * into v_job
    from public.mcp_storage_delete_jobs
   where installation_id = p_installation_id and id = p_job_id
   for update;

  update public.mcp_storage_delete_jobs
     set status = case when coalesce(p_succeeded, false) then 'completed' else 'failed' end,
         completed_at = case when coalesce(p_succeeded, false) then now() else null end,
         last_error = case
           when coalesce(p_succeeded, false) then null
           else left(coalesce(nullif(btrim(p_error), ''), 'storage_parent_delete_failed'), 500)
         end,
         raw_payload = coalesce(raw_payload, '{}'::jsonb) || jsonb_build_object(
           'finish_context', coalesce(p_context, '{}'::jsonb)
         ),
         updated_at = now()
   where id = v_job.id
   returning * into v_job;

  if coalesce(p_succeeded, false) then
    v_response := public.mcp_storage_delete_terminal_response(v_job.target_type, v_job.target_id, v_job.id, v_job.raw_payload);
    update public.mcp_storage_delete_jobs
       set raw_payload = jsonb_set(coalesce(raw_payload, '{}'::jsonb), '{terminal_response}', v_response, true),
           updated_at = now()
     where id = v_job.id
     returning * into v_job;

    if v_intent_id is not null then
      select * into v_record from public.mcp_idempotency_records where id = v_intent_id;
      if v_record.status = 'processing' then
        v_completion := public.mcp_idempotency_complete(v_intent_id, 200, v_response, v_job.target_id);
      elsif v_record.status = 'completed' then
        v_completion := jsonb_build_object(
          'data', coalesce(v_record.response_payload, v_response),
          'meta', jsonb_build_object(
            'idempotency', jsonb_build_object(
              'replayed', true,
              'originalRequestId', v_record.original_request_id
            )
          )
        );
      else
        raise exception 'idempotency_record_not_processing' using errcode = '55000';
      end if;
    end if;
  end if;

  return to_jsonb(v_job) || jsonb_build_object('response', v_response, 'idempotency', v_completion);
end;
$function$;

revoke all on function public.mcp_storage_delete_terminal_response(text, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.mcp_claim_storage_delete_archive_intent(text, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.mcp_claim_route_customer_media_delete(text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.mcp_claim_route_media_delete(text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.mcp_finish_storage_delete_job(text, text, boolean, text, jsonb)
  from public, anon, authenticated;

grant execute on function public.mcp_storage_delete_terminal_response(text, text, text, jsonb) to service_role;
grant execute on function public.mcp_claim_storage_delete_archive_intent(text, text, text, jsonb) to service_role;
grant execute on function public.mcp_claim_route_customer_media_delete(text, text, jsonb) to service_role;
grant execute on function public.mcp_claim_route_media_delete(text, text, jsonb) to service_role;
grant execute on function public.mcp_finish_storage_delete_job(text, text, boolean, text, jsonb) to service_role;
