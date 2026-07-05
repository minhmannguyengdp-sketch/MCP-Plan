export const dynamic = "force-dynamic";

function env() {
  const url = (process.env.SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) throw new Error("missing_supabase_config");
  return { url: url.replace(/\/+$/, ""), key };
}

function tableUrl(table: string, params: Record<string, string> = {}) {
  const { url } = env();
  const target = new URL(`/rest/v1/${table}`, url);
  Object.entries(params).forEach(([key, value]) => target.searchParams.set(key, value));
  return target;
}

function headers(extra: Record<string, string> = {}) {
  const { key } = env();
  return { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json", ...extra };
}

async function getRows<T>(table: string, params: Record<string, string>): Promise<T[]> {
  const response = await fetch(tableUrl(table, params), { cache: "no-store", headers: headers() });
  const payload = await response.json().catch(() => ([]));
  if (!response.ok) throw new Error(payload.message || payload.error || `supabase_${response.status}`);
  return Array.isArray(payload) ? payload : [];
}

async function removeRows(table: string, params: Record<string, string>) {
  const response = await fetch(tableUrl(table, params), { method: "DELETE", cache: "no-store", headers: headers({ Prefer: "return=representation" }) });
  const payload = await response.json().catch(() => ([]));
  if (!response.ok) throw new Error(payload.message || payload.error || `supabase_${response.status}`);
  return Array.isArray(payload) ? payload.length : 0;
}

function inFilter(values: string[]) {
  const unique = Array.from(new Set(values.filter(Boolean)));
  return unique.length ? `in.(${unique.map((value) => `"${value.replaceAll('"', '\\"')}"`).join(",")})` : "";
}

async function removeIn(table: string, column: string, values: string[]) {
  const filter = inFilter(values);
  if (!filter) return 0;
  return removeRows(table, { [column]: filter });
}

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const routeCustomerId = params.id;
    const routeCustomers = await getRows<{ id: string; route_id: string; customer_name: string }>("mcp_route_customers", { select: "id,route_id,customer_name", id: `eq.${routeCustomerId}`, limit: "1" });
    const routeCustomer = routeCustomers[0];
    if (!routeCustomer) throw new Error("route_customer_not_found");

    const sessionCustomers = await getRows<{ id: string; session_id?: string; visit_id?: string }>("mcp_session_customers", { select: "id,session_id,visit_id", route_customer_id: `eq.${routeCustomerId}`, limit: "2000" });
    const visits = await getRows<{ id: string; session_id?: string }>("mcp_visits", { select: "id,session_id", route_customer_id: `eq.${routeCustomerId}`, limit: "2000" });
    const sessionCustomerIds = sessionCustomers.map((row) => row.id);
    const visitIds = Array.from(new Set([...visits.map((row) => row.id), ...sessionCustomers.map((row) => row.visit_id || "").filter(Boolean)]));

    const followupsByRouteCustomer = await removeRows("mcp_followups", { route_customer_id: `eq.${routeCustomerId}` });
    const followupsBySessionCustomer = await removeIn("mcp_followups", "session_customer_id", sessionCustomerIds);
    const followupsByVisit = await removeIn("mcp_followups", "visit_id", visitIds);
    const deletedSessionCustomers = await removeRows("mcp_session_customers", { route_customer_id: `eq.${routeCustomerId}` });
    const deletedVisits = await removeRows("mcp_visits", { route_customer_id: `eq.${routeCustomerId}` });
    const deletedRouteCustomers = await removeRows("mcp_route_customers", { id: `eq.${routeCustomerId}` });

    return Response.json({
      data: {
        deleted: deletedRouteCustomers > 0,
        mode: "hard_delete",
        routeCustomerId,
        routeId: routeCustomer.route_id,
        customerName: routeCustomer.customer_name,
        deletedCounts: {
          followups: followupsByRouteCustomer + followupsBySessionCustomer + followupsByVisit,
          sessionCustomers: deletedSessionCustomers,
          visits: deletedVisits,
          routeCustomers: deletedRouteCustomers
        }
      },
      receivedAt: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "route_customer_hard_delete_failed" }, { status: 400 });
  }
}
