create or replace function public.mcp_assert_open_session_customer_v1(p_session_customer_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sc public.mcp_session_customers%rowtype;
  sess public.mcp_route_sessions%rowtype;
begin
  if p_session_customer_id is null or length(trim(p_session_customer_id)) = 0 then
    raise exception 'session_customer_id_required' using errcode = '23514';
  end if;

  select * into sc
  from public.mcp_session_customers
  where id = p_session_customer_id
  for update;

  if sc.id is null then
    raise exception 'session_customer_not_found' using errcode = '23503';
  end if;

  select * into sess
  from public.mcp_route_sessions
  where id = sc.session_id
  for update;

  if sess.id is null then
    raise exception 'session_not_found' using errcode = '23503';
  end if;

  if lower(coalesce(sess.status, 'active')) in ('done', 'completed', 'cancelled') then
    raise exception 'session_closed' using errcode = '55000';
  end if;

  return jsonb_build_object(
    'sessionCustomerId', sc.id,
    'sessionId', sess.id,
    'sessionDate', sess.session_date,
    'status', sess.status
  );
end;
$$;

create or replace function public.mcp_update_session_customer_status_v1(
  p_session_customer_id text,
  p_visit_status text,
  p_status_reason text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sc public.mcp_session_customers%rowtype;
  sess public.mcp_route_sessions%rowtype;
  v_status text;
  v_reason text;
  v_visit_id text;
  now_ts timestamptz := now();
begin
  perform public.mcp_assert_open_session_customer_v1(p_session_customer_id);

  v_status := lower(coalesce(nullif(trim(coalesce(p_visit_status, '')), ''), 'visited'));
  if v_status not in ('pending', 'visited', 'skipped', 'cancelled') then
    raise exception 'invalid_visit_status' using errcode = '23514';
  end if;

  v_reason := nullif(trim(coalesce(p_status_reason, '')), '');
  if v_status in ('skipped', 'cancelled') and v_reason is null then
    raise exception 'status_reason_required' using errcode = '23514';
  end if;

  select * into sc from public.mcp_session_customers where id = p_session_customer_id for update;
  select * into sess from public.mcp_route_sessions where id = sc.session_id for update;

  if sc.visit_id is not null then
    update public.mcp_visits
       set visit_date = sess.session_date,
           status = v_status,
           checkin_at = case when v_status = 'visited' then coalesce(checkin_at, now_ts) else checkin_at end,
           note = coalesce(nullif(trim(coalesce(p_note, '')), ''), note),
           updated_at = now_ts
     where id = sc.visit_id
     returning id into v_visit_id;
  end if;

  if v_status = 'visited' and v_visit_id is null then
    insert into public.mcp_visits (
      id, session_id, route_id, route_customer_id, visit_date, status,
      has_order, has_test, has_report, checkin_at, note, raw_payload,
      created_at, updated_at
    ) values (
      'mcv_' || replace(gen_random_uuid()::text, '-', ''),
      sc.session_id, sc.route_id, sc.route_customer_id, sess.session_date, 'visited',
      false, false, false, now_ts,
      coalesce(nullif(trim(coalesce(p_note, '')), ''), 'Đã ghé'),
      jsonb_build_object('source', 'mcp_update_session_customer_status_v1', 'session_customer_id', sc.id),
      now_ts, now_ts
    ) returning id into v_visit_id;
  end if;

  update public.mcp_session_customers
     set visit_status = v_status,
         status_reason = case when v_status in ('skipped', 'cancelled') then v_reason else null end,
         visit_id = coalesce(v_visit_id, visit_id),
         note = coalesce(nullif(trim(coalesce(p_note, '')), ''), note),
         updated_at = now_ts
   where id = sc.id;

  perform public.mcp_recalc_route_session_counters(sc.session_id);

  return jsonb_build_object(
    'sessionCustomerId', sc.id,
    'sessionId', sc.session_id,
    'visitId', v_visit_id,
    'visitStatus', v_status,
    'statusReason', case when v_status in ('skipped', 'cancelled') then v_reason else null end,
    'visitDate', sess.session_date
  );
end;
$$;

create or replace function public.mcp_create_order_from_session_customer_v1(
  p_session_customer_id text,
  p_items jsonb,
  p_note text default null,
  p_status text default 'confirmed'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.mcp_assert_open_session_customer_v1(p_session_customer_id);
  return public.mcp_create_order_from_session_customer(p_session_customer_id, p_items, p_note, p_status);
end;
$$;

create or replace function public.mcp_create_test_from_session_customer_v1(
  p_session_customer_id text,
  p_file_id text default null,
  p_file_title text default null,
  p_results jsonb default '[]'::jsonb,
  p_note text default null,
  p_status text default 'tested'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  v_status text;
  allowed constant text[] := array['pending','tested','ok','interested','sample','follow','bad','retry'];
begin
  perform public.mcp_assert_open_session_customer_v1(p_session_customer_id);

  v_status := lower(coalesce(nullif(trim(coalesce(p_status, '')), ''), 'tested'));
  if not (v_status = any(allowed)) then
    raise exception 'invalid_test_status' using errcode = '23514';
  end if;

  if p_results is null or jsonb_typeof(p_results) <> 'array' or jsonb_array_length(p_results) = 0 then
    raise exception 'test_results_required' using errcode = '23514';
  end if;

  for item in select value from jsonb_array_elements(p_results) loop
    v_status := lower(coalesce(nullif(trim(coalesce(item->>'status', '')), ''), 'tested'));
    if not (v_status = any(allowed)) then
      raise exception 'invalid_test_status' using errcode = '23514';
    end if;
  end loop;

  return public.mcp_create_test_from_session_customer(
    p_session_customer_id, p_file_id, p_file_title, p_results, p_note, p_status
  );
end;
$$;

create or replace function public.mcp_create_report_from_session_customer_v1(
  p_session_customer_id text,
  p_report_type text default 'general',
  p_content text default null,
  p_price_summary text default null,
  p_competitor_summary text default null,
  p_display_summary text default null,
  p_stock_summary text default null,
  p_demand_summary text default null,
  p_opportunity_summary text default null,
  p_risk_summary text default null,
  p_next_action text default null,
  p_note text default null,
  p_raw_payload jsonb default '{}'::jsonb,
  p_selected_competitor_ids text[] default array[]::text[],
  p_selected_used_product_ids text[] default array[]::text[],
  p_selected_setting_item_ids text[] default array[]::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.mcp_assert_open_session_customer_v1(p_session_customer_id);
  return public.mcp_create_report_from_session_customer(
    p_session_customer_id,
    p_report_type,
    p_content,
    p_price_summary,
    p_competitor_summary,
    p_display_summary,
    p_stock_summary,
    p_demand_summary,
    p_opportunity_summary,
    p_risk_summary,
    p_next_action,
    p_note,
    p_raw_payload,
    p_selected_competitor_ids,
    p_selected_used_product_ids,
    p_selected_setting_item_ids
  );
end;
$$;

create or replace function public.mcp_create_followup_from_session_customer_v1(
  p_session_customer_id text,
  p_title text,
  p_due_date date default null,
  p_priority text default 'medium',
  p_owner text default null,
  p_note text default null,
  p_followup_type text default 'general'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.mcp_assert_open_session_customer_v1(p_session_customer_id);
  return public.mcp_create_followup_from_session_customer(
    p_session_customer_id, p_title, p_due_date, p_priority, p_owner, p_note, p_followup_type
  );
end;
$$;

create or replace function public.mcp_update_route_session_v1(
  p_session_id text,
  p_session_date date default null,
  p_status text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sess public.mcp_route_sessions%rowtype;
begin
  if p_session_id is null or length(trim(p_session_id)) = 0 then
    raise exception 'session_id_required' using errcode = '23514';
  end if;

  select * into sess from public.mcp_route_sessions where id = p_session_id for update;
  if sess.id is null then
    raise exception 'session_not_found' using errcode = '23503';
  end if;

  if lower(coalesce(sess.status, 'active')) in ('done', 'completed', 'cancelled') then
    raise exception 'session_closed' using errcode = '55000';
  end if;

  return public.mcp_update_route_session(p_session_id, p_session_date, p_status, p_note);
end;
$$;

revoke all on function public.mcp_assert_open_session_customer_v1(text) from public, anon, authenticated;
revoke all on function public.mcp_update_session_customer_status_v1(text, text, text, text) from public, anon, authenticated;
revoke all on function public.mcp_create_order_from_session_customer_v1(text, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.mcp_create_test_from_session_customer_v1(text, text, text, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.mcp_create_report_from_session_customer_v1(text, text, text, text, text, text, text, text, text, text, text, text, jsonb, text[], text[], text[]) from public, anon, authenticated;
revoke all on function public.mcp_create_followup_from_session_customer_v1(text, text, date, text, text, text, text) from public, anon, authenticated;
revoke all on function public.mcp_update_route_session_v1(text, date, text, text) from public, anon, authenticated;

grant execute on function public.mcp_assert_open_session_customer_v1(text) to service_role;
grant execute on function public.mcp_update_session_customer_status_v1(text, text, text, text) to service_role;
grant execute on function public.mcp_create_order_from_session_customer_v1(text, jsonb, text, text) to service_role;
grant execute on function public.mcp_create_test_from_session_customer_v1(text, text, text, jsonb, text, text) to service_role;
grant execute on function public.mcp_create_report_from_session_customer_v1(text, text, text, text, text, text, text, text, text, text, text, text, jsonb, text[], text[], text[]) to service_role;
grant execute on function public.mcp_create_followup_from_session_customer_v1(text, text, date, text, text, text, text) to service_role;
grant execute on function public.mcp_update_route_session_v1(text, date, text, text) to service_role;

revoke execute on function public.mcp_create_order_from_session_customer(text, jsonb, text, text) from public, anon, authenticated;
revoke execute on function public.mcp_create_test_from_session_customer(text, text, text, jsonb, text, text) from public, anon, authenticated;
revoke execute on function public.mcp_create_report_from_session_customer(text, text, text, text, text, text, text, text, text, text, text, text, jsonb, text[], text[], text[]) from public, anon, authenticated;
revoke execute on function public.mcp_create_followup_from_session_customer(text, text, date, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.mcp_update_route_session(text, date, text, text) from public, anon, authenticated;
