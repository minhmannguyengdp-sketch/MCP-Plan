begin;

-- Route sessions are operational daily runs. A route cannot be operated by two
-- active sessions at once. Lock writes while historical duplicate state is
-- normalized and the invariant is installed.
lock table public.mcp_route_sessions in share row exclusive mode;

do $migration$
declare
  v_duplicate record;
  v_session public.mcp_route_sessions%rowtype;
  v_has_activity boolean;
begin
  for v_duplicate in
    with ranked as (
      select
        id,
        row_number() over (
          partition by route_id
          order by session_date desc, created_at desc, id desc
        ) as active_rank
      from public.mcp_route_sessions
      where lower(coalesce(status, 'active')) = 'active'
    )
    select id
    from ranked
    where active_rank > 1
    order by id
  loop
    perform public.mcp_recalc_route_session_counters(v_duplicate.id);

    select *
      into v_session
      from public.mcp_route_sessions
     where id = v_duplicate.id
     for update;

    if not found or lower(coalesce(v_session.status, 'active')) <> 'active' then
      continue;
    end if;

    v_has_activity :=
      coalesce(v_session.visited_customers, 0) > 0
      or coalesce(v_session.order_count, 0) > 0
      or coalesce(v_session.test_count, 0) > 0
      or coalesce(v_session.report_count, 0) > 0
      or coalesce(v_session.followup_count, 0) > 0
      or exists (
        select 1
          from public.mcp_visits
         where session_id = v_session.id
      )
      or exists (
        select 1
          from public.mcp_session_customers
         where session_id = v_session.id
           and (
             checkin_at is not null
             or visit_status in ('visited', 'skipped', 'cancelled')
             or visit_id is not null
             or order_id is not null
             or test_id is not null
             or report_id is not null
             or coalesce(followup_count, 0) > 0
           )
      );

    if v_has_activity then
      -- Use the canonical close path so counters and the report snapshot stay
      -- consistent. Existing visit/check-in/result/order/report/follow-up rows
      -- are preserved.
      perform public.mcp_update_route_session(
        v_session.id,
        v_session.session_date,
        'done',
        null
      );
    else
      -- An abandoned session with no operational activity is cancelled rather
      -- than represented as a completed field run.
      perform public.mcp_update_route_session(
        v_session.id,
        v_session.session_date,
        'cancelled',
        null
      );
    end if;
  end loop;
end;
$migration$;

create unique index if not exists mcp_route_sessions_one_active_per_route_uidx
  on public.mcp_route_sessions (route_id)
  where lower(coalesce(status, 'active')) = 'active';

comment on index public.mcp_route_sessions_one_active_per_route_uidx is
  'Operational invariant: a route has at most one active session. Historical duplicate actives are normalized before this index is installed.';

commit;
