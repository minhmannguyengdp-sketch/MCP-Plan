export const dynamic = "force-dynamic";

type Dict = Record<string, unknown>;
type RouteRow = {
  id: string;
  route_name: string | null;
  weekday: number | null;
  area: string | null;
  active: boolean | null;
  note: string | null;
  raw_payload?: unknown;
};
type SessionRow = {
  id: string;
  route_id: string;
  route_name: string | null;
  session_date: string;
  weekday: number | null;
  sales: string | null;
  area: string | null;
  status: string | null;
  planned_customers: number | null;
  visited_customers: number | null;
  order_count: number | null;
  test_count: number | null;
  report_count: number | null;
  followup_count?: number | null;
  note: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const DEFAULT_SUPABASE_URL = "https://noiadkpkvdohljgopgfb.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_n6LXv-fd-ImF3XzeU2mrjg_G7tBGy66";

function env() {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim().replace(/\/+$/, "");
  const key = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    DEFAULT_SUPABASE_PUBLISHABLE_KEY
  ).trim();
  if (!url || !key) throw new Error("missing_supabase_config");
  return { url, key };
}

function text(value: unknown) {
  const valueText = String(value ?? "").trim();
  return valueText || null;
}

function dateOnly(value: unknown) {
  const raw = String(value ?? "").trim();
  const fallback = new Date().toISOString().slice(0, 10);
  const candidate = raw ? raw.slice(0, 10) : fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) throw new Error("invalid_session_date");
  return candidate;
}

function weekdayFromDate(dateText: string) {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) ? date.getUTCDay() : null;
}

function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

async function supabaseFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, key } = env();
  const response = await fetch(`${url}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorPayload = payload as { message?: string; error?: string; details?: string };
    throw new Error(errorPayload.message || errorPayload.error || errorPayload.details || `supabase_${response.status}`);
  }
  return payload as T;
}

function eq(value: string) {
  return `eq.${encodeURIComponent(value)}`;
}

async function getRoute(routeId: string) {
  const rows = await supabaseFetch<RouteRow[]>(
    `/rest/v1/mcp_routes?id=${eq(routeId)}&select=id,route_name,weekday,area,active,note,raw_payload&limit=1`
  );
  return rows[0] || null;
}

async function getSession(routeId: string, sessionDate: string) {
  const rows = await supabaseFetch<SessionRow[]>(
    `/rest/v1/mcp_route_sessions?route_id=${eq(routeId)}&session_date=${eq(sessionDate)}&select=*&limit=1`
  );
  return rows[0] || null;
}

async function createSession(route: RouteRow, sessionDate: string, owner: string | null) {
  const now = new Date().toISOString();
  const sessionPayload = {
    id: newId("mrs"),
    route_id: route.id,
    route_name: route.route_name || "Tuyến chưa tên",
    session_date: sessionDate,
    weekday: weekdayFromDate(sessionDate) ?? route.weekday,
    sales: owner || "Sale",
    area: route.area,
    status: "active",
    planned_customers: 0,
    visited_customers: 0,
    order_count: 0,
    test_count: 0,
    report_count: 0,
    note: "Opened by Next API",
    sync_status: "synced",
    raw_payload: {
      source: "next_open_session",
      route_snapshot: {
        id: route.id,
        route_name: route.route_name,
        weekday: route.weekday,
        area: route.area,
        active: route.active,
        note: route.note
      }
    },
    created_at: now,
    updated_at: now
  };

  const rows = await supabaseFetch<SessionRow[]>("/rest/v1/mcp_route_sessions?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(sessionPayload)
  });
  return rows[0] || null;
}

async function backfillSessionCustomers(sessionId: string) {
  return supabaseFetch<Dict>("/rest/v1/rpc/mcp_backfill_session_customers_from_route", {
    method: "POST",
    body: JSON.stringify({ p_session_id: sessionId, p_only_if_empty: false })
  });
}

function normalizeSession(session: SessionRow, backfill: Dict | null) {
  return {
    id: session.id,
    sessionId: session.id,
    routeId: session.route_id,
    routeName: session.route_name,
    sessionDate: session.session_date,
    date: session.session_date,
    weekday: session.weekday,
    owner: session.sales || "Sale",
    area: session.area,
    status: session.status === "completed" ? "done" : session.status || "active",
    plannedCustomers: session.planned_customers ?? Number(backfill?.activeRouteCustomers || 0),
    visitedCustomers: session.visited_customers ?? 0,
    orderCount: session.order_count ?? 0,
    testCount: session.test_count ?? 0,
    reportCount: session.report_count ?? 0,
    followupCount: session.followup_count ?? 0,
    note: session.note,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
    snapshot: backfill
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const routeId = text(body.routeId || body.route_id);
    const sessionDate = dateOnly(body.sessionDate || body.session_date || body.date);
    const owner = text(body.owner || body.sales || body.salesOwner || body.sales_owner);

    if (!routeId) throw new Error("route_id_required");

    const route = await getRoute(routeId);
    if (!route) throw new Error("route_not_found");
    if (route.active === false) throw new Error("route_inactive");

    let created = false;
    let session = await getSession(routeId, sessionDate);
    if (!session) {
      session = await createSession(route, sessionDate, owner);
      created = true;
    }
    if (!session?.id) throw new Error("route_session_create_failed");

    const backfill = await backfillSessionCustomers(session.id);
    const refreshed = await getSession(routeId, sessionDate);

    return Response.json(
      {
        data: {
          created,
          session: normalizeSession(refreshed || session, backfill),
          backfill
        },
        receivedAt: new Date().toISOString()
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "open_session_failed" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
