type AnyRecord = Record<string, any>;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey"
    }
  });
}

function badRequest(message: string): never {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = 400;
  throw error;
}

function randomId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function boolValue(value: unknown, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y", "co", "có"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "khong", "không"].includes(normalized)) return false;
  return fallback;
}

function supabaseUrl(table: string, params: AnyRecord = {}) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("missing_supabase_config");
  const url = new URL(`/rest/v1/${table}`, SUPABASE_URL);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }

  return url;
}

function headers(extra: HeadersInit = {}) {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    Accept: "application/json",
    ...extra
  };
}

async function supabaseGet(table: string, params: AnyRecord = {}) {
  const res = await fetch(supabaseUrl(table, params), { headers: headers() });
  if (!res.ok) throw Object.assign(new Error("supabase_read_failed"), { statusCode: 502, table, detail: await res.text() });
  return await res.json();
}

async function supabaseInsert(table: string, rows: AnyRecord | AnyRecord[], params: AnyRecord = {}) {
  const payload = Array.isArray(rows) ? rows : [rows];
  if (payload.length === 0) return [];

  const res = await fetch(supabaseUrl(table, params), {
    method: "POST",
    headers: headers({ "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify(payload)
  });

  if (!res.ok) throw Object.assign(new Error("supabase_insert_failed"), { statusCode: 502, table, detail: await res.text() });
  return await res.json();
}

async function supabasePatch(table: string, values: AnyRecord, params: AnyRecord = {}) {
  const res = await fetch(supabaseUrl(table, params), {
    method: "PATCH",
    headers: headers({ "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify(values)
  });

  if (!res.ok) throw Object.assign(new Error("supabase_update_failed"), { statusCode: 502, table, detail: await res.text() });
  return await res.json();
}

async function supabaseCount(table: string, params: AnyRecord = {}) {
  const res = await fetch(supabaseUrl(table, { select: "id", limit: 1, ...params }), {
    headers: headers({ Prefer: "count=exact" })
  });

  if (!res.ok) throw Object.assign(new Error("supabase_count_failed"), { statusCode: 502, table, detail: await res.text() });
  const total = res.headers.get("content-range")?.split("/")[1];
  return Number(total || 0);
}

async function recalcCounters(sessionId: string) {
  const [visitedCount, orderCount, testCount, reportCount, snapshotCount] = await Promise.all([
    supabaseCount("mcp_session_customers", { session_id: `eq.${sessionId}`, visit_status: "eq.visited" }),
    supabaseCount("mcp_visits", { session_id: `eq.${sessionId}`, has_order: "eq.true" }),
    supabaseCount("mcp_visits", { session_id: `eq.${sessionId}`, has_test: "eq.true" }),
    supabaseCount("mcp_visits", { session_id: `eq.${sessionId}`, has_report: "eq.true" }),
    supabaseCount("mcp_session_customers", { session_id: `eq.${sessionId}` })
  ]);

  const sessions = await supabasePatch("mcp_route_sessions", {
    planned_customers: snapshotCount,
    visited_customers: visitedCount,
    order_count: orderCount,
    test_count: testCount,
    report_count: reportCount,
    updated_at: new Date().toISOString()
  }, { id: `eq.${sessionId}` });

  return { session: sessions[0] || null, snapshotCount, visitedCount, orderCount, testCount, reportCount };
}

async function getSessionCustomer(sessionCustomerId: string) {
  const rows = await supabaseGet("mcp_session_customers", {
    select: "id,session_id,route_id,route_customer_id,customer_id,customer_name,visit_status,status_reason,visit_id,order_id,test_id,report_id,note",
    id: `eq.${sessionCustomerId}`,
    limit: 1
  });

  if (!rows[0]) badRequest("session_customer_not_found");
  return rows[0];
}

async function ensureVisit(sessionCustomer: AnyRecord, note: string, now: string) {
  if (sessionCustomer.visit_id) {
    const rows = await supabaseGet("mcp_visits", {
      select: "id,session_id,route_id,route_customer_id,status,has_order,has_test,has_report,order_id,test_id,report_id,checkin_at,note,created_at",
      id: `eq.${sessionCustomer.visit_id}`,
      limit: 1
    });

    if (rows[0]) return { visit: rows[0], createdVisit: false };
  }

  const rows = await supabaseInsert("mcp_visits", {
    id: randomId("mcv"),
    session_id: sessionCustomer.session_id,
    route_id: sessionCustomer.route_id,
    route_customer_id: sessionCustomer.route_customer_id,
    visit_date: todayDateOnly(),
    status: "visited",
    has_order: false,
    has_test: false,
    has_report: false,
    checkin_at: now,
    note: note || sessionCustomer.note || "Đã ghi kết quả",
    raw_payload: {
      source: "edge_mcp_day_8b3_result",
      session_customer_id: sessionCustomer.id,
      customer_id: sessionCustomer.customer_id,
      customer_name: sessionCustomer.customer_name
    }
  });

  return { visit: rows[0] || null, createdVisit: Boolean(rows[0]) };
}

async function handleResult(body: AnyRecord) {
  const sessionCustomerId = String(body.sessionCustomerId || body.session_customer_id || body.id || "").trim();
  const resultType = String(body.resultType || body.result_type || body.type || "").trim().toLowerCase();
  const note = String(body.note || body.result || body.resultNote || body.result_note || "").trim();
  const orderId = String(body.orderId || body.order_id || "").trim();
  const testId = String(body.testId || body.test_id || "").trim();
  const reportId = String(body.reportId || body.report_id || "").trim();
  const now = new Date().toISOString();

  if (!sessionCustomerId) badRequest("session_customer_id_required");
  if (resultType && !["order", "test", "report"].includes(resultType)) badRequest("invalid_result_type");

  if (!resultType && !note && !orderId && !testId && !reportId && body.hasOrder === undefined && body.has_order === undefined && body.hasTest === undefined && body.has_test === undefined && body.hasReport === undefined && body.has_report === undefined) {
    badRequest("result_required");
  }

  const sessionCustomer = await getSessionCustomer(sessionCustomerId);
  const ensured = await ensureVisit(sessionCustomer, note, now);
  let visit = ensured.visit;
  if (!visit) badRequest("visit_not_created");

  const finalOrderId = orderId || sessionCustomer.order_id || visit.order_id || null;
  const finalTestId = testId || sessionCustomer.test_id || visit.test_id || null;
  const finalReportId = reportId || sessionCustomer.report_id || visit.report_id || null;
  const hasOrder = boolValue(body.hasOrder ?? body.has_order, resultType === "order" || Boolean(finalOrderId) || Boolean(visit.has_order));
  const hasTest = boolValue(body.hasTest ?? body.has_test, resultType === "test" || Boolean(finalTestId) || Boolean(visit.has_test));
  const hasReport = boolValue(body.hasReport ?? body.has_report, resultType === "report" || Boolean(finalReportId) || Boolean(visit.has_report));

  const visits = await supabasePatch("mcp_visits", {
    status: "visited",
    has_order: hasOrder,
    has_test: hasTest,
    has_report: hasReport,
    order_id: finalOrderId,
    test_id: finalTestId,
    report_id: finalReportId,
    checkin_at: visit.checkin_at || now,
    note: note || visit.note || sessionCustomer.note || "Đã ghi kết quả",
    updated_at: now
  }, { id: `eq.${visit.id}` });

  visit = visits[0] || visit;

  const sessionCustomers = await supabasePatch("mcp_session_customers", {
    visit_status: "visited",
    status_reason: null,
    visit_id: visit.id,
    order_id: finalOrderId,
    test_id: finalTestId,
    report_id: finalReportId,
    note: note || sessionCustomer.note,
    updated_at: now
  }, { id: `eq.${sessionCustomer.id}` });

  const counters = await recalcCounters(sessionCustomer.session_id);
  return { sessionCustomer: sessionCustomers[0] || null, visit, createdVisit: ensured.createdVisit, counters };
}

async function handleAdd(body: AnyRecord) {
  const sessionId = String(body.sessionId || body.session_id || "").trim();
  const customerName = String(body.customerName || body.customer_name || body.accountName || body.account_name || "").trim();

  if (!customerName) badRequest("customer_name_required");

  let session = null;
  if (sessionId) {
    const rows = await supabaseGet("mcp_route_sessions", {
      select: "id,route_id,route_name,session_date,sales,area,status,created_at",
      id: `eq.${sessionId}`,
      limit: 1
    });
    session = rows[0] || null;
  } else {
    const rows = await supabaseGet("mcp_route_sessions", {
      select: "id,route_id,route_name,session_date,sales,area,status,created_at",
      order: "session_date.desc,created_at.desc",
      limit: 1
    });
    session = rows[0] || null;
  }

  if (!session) badRequest("session_not_found");
  if (session.status === "cancelled") badRequest("session_cancelled");

  const lastRows = await supabaseGet("mcp_session_customers", {
    select: "sort_order",
    session_id: `eq.${session.id}`,
    order: "sort_order.desc,created_at.desc",
    limit: 1
  });

  const now = new Date().toISOString();
  const rows = await supabaseInsert("mcp_session_customers", {
    id: randomId("msc"),
    session_id: session.id,
    route_id: session.route_id,
    route_customer_id: String(body.routeCustomerId || body.route_customer_id || "").trim() || null,
    customer_id: String(body.customerId || body.customer_id || "").trim() || null,
    customer_name: customerName,
    phone: String(body.phone || "").trim() || null,
    area: String(body.area || "").trim() || session.area || null,
    address: String(body.address || "").trim() || null,
    sort_order: Number(lastRows[0]?.sort_order || 0) + 1,
    source: "added",
    planned_status: "added",
    visit_status: "pending",
    note: String(body.note || "").trim() || "Khách phát sinh trong phiên",
    raw_payload: { source: "edge_mcp_day_8b3_add", received_at: now }
  });

  const counters = await recalcCounters(session.id);
  return { sessionCustomer: rows[0] || null, counters };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json(204, {});
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "").trim().toLowerCase();
    const data = action === "add" ? await handleAdd(body) : await handleResult(body);
    return json(200, { data, receivedAt: new Date().toISOString() });
  } catch (error) {
    const err = error as Error & { statusCode?: number; detail?: string; table?: string };
    return json(err.statusCode || 500, {
      ok: false,
      error: err.message || "internal_error",
      detail: err.detail,
      table: err.table
    });
  }
});
