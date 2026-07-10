const DEFAULT_SUPABASE_URL = "https://noiadkpkvdohljgopgfb.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_n6LXv-fd-ImF3XzeU2mrjg_G7tBGy66";

export type Dict = Record<string, unknown>;

export function isObj(value: unknown): value is Dict {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function text(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

export function eq(value: string) {
  return `eq.${encodeURIComponent(value)}`;
}

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

function headers(extra?: HeadersInit) {
  const cfg = env();
  return {
    apikey: cfg.key,
    Authorization: `Bearer ${cfg.key}`,
    Accept: "application/json",
    ...extra
  };
}

export async function supabaseGet<T>(path: string) {
  const cfg = env();
  const response = await fetch(`${cfg.url}${path}`, { cache: "no-store", headers: headers() });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `supabase_${response.status}`);
  return payload as T;
}

export async function supabasePatch<T>(path: string, body: Dict) {
  const cfg = env();
  const response = await fetch(`${cfg.url}${path}`, {
    method: "PATCH",
    cache: "no-store",
    headers: headers({ "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `supabase_${response.status}`);
  return payload as T;
}

export async function rpc<T>(name: string, args: Dict) {
  const cfg = env();
  const response = await fetch(`${cfg.url}/rest/v1/rpc/${name}`, {
    method: "POST",
    cache: "no-store",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(args)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `supabase_${response.status}`);
  return payload as T;
}

export async function resolveSessionCustomerId(input: string, body: Dict) {
  const direct = await supabaseGet<Array<{ id: string }>>(`/rest/v1/mcp_session_customers?id=${eq(input)}&select=id&limit=1`);
  if (direct[0]?.id) return direct[0].id;

  const context = isObj(body.context) ? body.context : {};
  const routeCustomerId = text(body.routeCustomerId || body.route_customer_id || context.routeCustomerId || context.route_customer_id) || (input.startsWith("mcp-route-customer") ? input : null);
  const sessionId = text(body.sessionId || body.session_id || context.sessionId || context.session_id);
  const routeId = text(body.routeId || body.route_id || context.routeId || context.route_id);
  const sessionDate = text(body.sessionDate || body.session_date || body.date || context.sessionDate || context.session_date || context.date)?.slice(0, 10);
  const customerName = text(body.customerName || body.customer_name || context.customerName || context.customer_name);

  if (routeCustomerId && sessionId) {
    const rows = await supabaseGet<Array<{ id: string }>>(`/rest/v1/mcp_session_customers?session_id=${eq(sessionId)}&route_customer_id=${eq(routeCustomerId)}&select=id&limit=1`);
    if (rows[0]?.id) return rows[0].id;
  }

  if (customerName && sessionId) {
    const rows = await supabaseGet<Array<{ id: string }>>(`/rest/v1/mcp_session_customers?session_id=${eq(sessionId)}&customer_name=${eq(customerName)}&select=id&limit=1`);
    if (rows[0]?.id) return rows[0].id;
  }

  if ((routeCustomerId || customerName) && routeId && sessionDate) {
    const sessions = await supabaseGet<Array<{ id: string }>>(`/rest/v1/mcp_route_sessions?route_id=${eq(routeId)}&session_date=${eq(sessionDate)}&select=id&limit=1`);
    const realSessionId = sessions[0]?.id;
    if (realSessionId && routeCustomerId) {
      const rows = await supabaseGet<Array<{ id: string }>>(`/rest/v1/mcp_session_customers?session_id=${eq(realSessionId)}&route_customer_id=${eq(routeCustomerId)}&select=id&limit=1`);
      if (rows[0]?.id) return rows[0].id;
    }
    if (realSessionId && customerName) {
      const rows = await supabaseGet<Array<{ id: string }>>(`/rest/v1/mcp_session_customers?session_id=${eq(realSessionId)}&customer_name=${eq(customerName)}&select=id&limit=1`);
      if (rows[0]?.id) return rows[0].id;
    }
  }

  throw new Error("session_customer_not_resolved");
}

export async function sessionCustomerAction<T>(request: Request, handler: (body: Dict, sessionCustomerId: string) => Promise<T>) {
  try {
    const body = await request.json().catch(() => ({}));
    const inputSessionCustomerId = text(body.sessionCustomerId || body.session_customer_id);
    if (!inputSessionCustomerId) throw new Error("session_customer_id_required");
    const sessionCustomerId = await resolveSessionCustomerId(inputSessionCustomerId, body);
    const data = await handler(body, sessionCustomerId);
    return Response.json({ data, receivedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "mcp_session_customer_action_failed" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
