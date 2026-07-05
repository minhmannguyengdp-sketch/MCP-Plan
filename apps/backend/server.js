import http from "node:http";
import { randomUUID } from "node:crypto";
import { loadEnvFile } from "node:process";

try {
  loadEnvFile(".env");
} catch {}

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3001);
const SERVICE = "mcp-plan-backend";
const SUPABASE_URL = process.env.SUPABASE_URL?.trim();
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const MCP_SESSION_CUSTOMER_STATUSES = new Set(["pending", "visited", "skipped", "cancelled"]);

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": process.env.CORS_ORIGINS || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept"
  });
  res.end(body);
}

function wrap(data) {
  return { data, receivedAt: new Date().toISOString() };
}

function hasSupabaseConfig() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function assertSupabaseConfig() {
  if (!hasSupabaseConfig()) {
    const error = new Error("missing_supabase_config");
    error.statusCode = 503;
    throw error;
  }
}

function supabaseHeaders(extra = {}) {
  assertSupabaseConfig();
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    Accept: "application/json",
    ...extra
  };
}

function buildSupabaseUrl(table, params = {}) {
  assertSupabaseConfig();
  const url = new URL(`/rest/v1/${table}`, SUPABASE_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  });
  return url;
}

async function supabaseGet(table, params = {}, options = {}) {
  const response = await fetch(buildSupabaseUrl(table, params), { headers: supabaseHeaders(options.headers) });
  if (!response.ok) {
    const error = new Error("supabase_read_failed");
    error.statusCode = 502;
    error.detail = await response.text();
    error.table = table;
    throw error;
  }
  return response.json();
}

async function supabaseInsert(table, rows, params = {}) {
  const payload = Array.isArray(rows) ? rows : [rows];
  if (payload.length === 0) return [];
  const response = await fetch(buildSupabaseUrl(table, params), {
    method: "POST",
    headers: supabaseHeaders({ "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const error = new Error("supabase_insert_failed");
    error.statusCode = 502;
    error.detail = await response.text();
    error.table = table;
    throw error;
  }
  return response.json();
}

async function supabasePatch(table, values, params = {}) {
  const response = await fetch(buildSupabaseUrl(table, params), {
    method: "PATCH",
    headers: supabaseHeaders({ "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify(values)
  });
  if (!response.ok) {
    const error = new Error("supabase_update_failed");
    error.statusCode = 502;
    error.detail = await response.text();
    error.table = table;
    throw error;
  }
  return response.json();
}

async function proxySupabaseFunction(functionName, body, extraBody = {}) {
  assertSupabaseConfig();
  const response = await fetch(new URL(`/functions/v1/${functionName}`, SUPABASE_URL), {
    method: "POST",
    headers: supabaseHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ ...body, ...extraBody })
  });
  const text = await response.text();
  let payload = {};
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
  }
  if (!response.ok) {
    const error = new Error(payload.error || "edge_function_failed");
    error.statusCode = response.status || 502;
    error.detail = payload.detail || payload.raw || text;
    error.table = payload.table;
    throw error;
  }
  return payload.data ?? payload;
}

async function supabaseRpc(functionName, args = {}) {
  assertSupabaseConfig();
  const response = await fetch(new URL(`/rest/v1/rpc/${functionName}`, SUPABASE_URL), {
    method: "POST",
    headers: supabaseHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(args)
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
  }

  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error || "supabase_rpc_failed");
    error.statusCode = response.status || 502;
    error.detail = payload?.details || payload?.hint || payload?.raw || text;
    throw error;
  }

  return payload;
}

function normalizeOrderItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw badRequest("order_items_required");

  return items.map((item) => {
    const productName = String(item.productName || item.product_name || "").trim();
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice ?? item.unit_price ?? 0);
    const discount = Number(item.discount || 0);

    if (!productName) throw badRequest("product_name_required");
    if (!Number.isFinite(quantity) || quantity <= 0) throw badRequest("quantity_required");
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw badRequest("invalid_unit_price");
    if (!Number.isFinite(discount) || discount < 0) throw badRequest("invalid_discount");

    return {
      productId: String(item.productId || item.product_id || "").trim() || null,
      productName,
      sku: String(item.sku || "").trim() || null,
      unit: String(item.unit || "").trim() || null,
      quantity,
      unitPrice,
      discount,
      note: String(item.note || "").trim() || null
    };
  });
}

async function createMcpSessionCustomerOrder(body) {
  const sessionCustomerId = String(body.sessionCustomerId || body.session_customer_id || body.id || "").trim();
  if (!sessionCustomerId) throw badRequest("session_customer_id_required");

  const items = normalizeOrderItems(body.items);
  const note = String(body.note || "").trim();
  const status = String(body.status || "confirmed").trim() || "confirmed";

  return supabaseRpc("mcp_create_order_from_session_customer", {
    p_session_customer_id: sessionCustomerId,
    p_items: items,
    p_note: note || null,
    p_status: status
  });
}

function normalizeTestResults(results) {
  if (!Array.isArray(results) || results.length === 0) throw badRequest("test_results_required");

  return results.map((item) => {
    const productId = String(item.productId || item.product_id || "").trim();
    const productName = String(item.productName || item.product_name || "").trim();
    const status = String(item.status || "tested").trim() || "tested";
    const note = String(item.note || "").trim();

    if (!productId && !productName) throw badRequest("product_name_required");

    return {
      productId: productId || null,
      productName: productName || null,
      status,
      note: note || null
    };
  });
}

async function loadMcpTestOptions() {
  const [fileRows, productRows] = await Promise.all([
    supabaseGet("test_files", { select: "id,title,test_date,sales,status,note,created_at", order: "test_date.desc,created_at.desc", limit: 50 }),
    supabaseGet("test_file_products", { select: "id,file_id,product_name,sort_order,status", order: "sort_order.asc,created_at.asc", limit: 1000 })
  ]);

  const productsByFile = new Map();
  productRows.forEach((product) => {
    if (product.status === "deleted") return;
    if (!productsByFile.has(product.file_id)) productsByFile.set(product.file_id, []);
    productsByFile.get(product.file_id).push({
      id: product.id,
      productName: product.product_name || "Sáº£n pháº©m test"
    });
  });

  const files = fileRows
    .filter((file) => file.status !== "deleted")
    .map((file) => ({
      id: file.id,
      title: file.title || file.id,
      testDate: dateOnly(file.test_date || file.created_at),
      products: productsByFile.get(file.id) || []
    }));

  return { files };
}

async function createMcpSessionCustomerTest(body) {
  const sessionCustomerId = String(body.sessionCustomerId || body.session_customer_id || body.id || "").trim();
  if (!sessionCustomerId) throw badRequest("session_customer_id_required");

  const results = normalizeTestResults(body.results || body.items);
  const fileId = String(body.fileId || body.file_id || "").trim();
  const fileTitle = String(body.fileTitle || body.file_title || "").trim();
  const note = String(body.note || "").trim();
  const status = String(body.status || "tested").trim() || "tested";

  return supabaseRpc("mcp_create_test_from_session_customer", {
    p_session_customer_id: sessionCustomerId,
    p_file_id: fileId || null,
    p_file_title: fileTitle || null,
    p_results: results,
    p_note: note || null,
    p_status: status
  });
}

function normalizeReportType(value) {
  const reportType = String(value || "general").trim() || "general";
  const allowed = new Set(["price", "competitor", "display", "stock", "demand", "general"]);
  if (!allowed.has(reportType)) throw badRequest("invalid_report_type");
  return reportType;
}

async function createMcpSessionCustomerReport(body) {
  const sessionCustomerId = String(body.sessionCustomerId || body.session_customer_id || body.id || "").trim();
  if (!sessionCustomerId) throw badRequest("session_customer_id_required");

  const reportType = normalizeReportType(body.reportType || body.report_type);
  const content = String(body.content || body.note || "").trim();
  const priceSummary = String(body.priceSummary || body.price_summary || "").trim();
  const competitorSummary = String(body.competitorSummary || body.competitor_summary || "").trim();
  const displaySummary = String(body.displaySummary || body.display_summary || "").trim();
  const stockSummary = String(body.stockSummary || body.stock_summary || "").trim();
  const demandSummary = String(body.demandSummary || body.demand_summary || "").trim();
  const opportunitySummary = String(body.opportunitySummary || body.opportunity_summary || "").trim();
  const riskSummary = String(body.riskSummary || body.risk_summary || "").trim();
  const nextAction = String(body.nextAction || body.next_action || "").trim();

  if (!content && !priceSummary && !competitorSummary && !displaySummary && !stockSummary && !demandSummary && !opportunitySummary && !riskSummary && !nextAction) {
    throw badRequest("report_content_required");
  }

  return supabaseRpc("mcp_create_report_from_session_customer", {
    p_session_customer_id: sessionCustomerId,
    p_report_type: reportType,
    p_content: content || null,
    p_price_summary: priceSummary || null,
    p_competitor_summary: competitorSummary || null,
    p_display_summary: displaySummary || null,
    p_stock_summary: stockSummary || null,
    p_demand_summary: demandSummary || null,
    p_opportunity_summary: opportunitySummary || null,
    p_risk_summary: riskSummary || null,
    p_next_action: nextAction || null,
    p_note: content || null
  });
}

function normalizeFollowupPriority(value) {
  const priority = String(value || "medium").trim().toLowerCase() || "medium";
  const allowed = new Set(["low", "medium", "high", "urgent"]);
  if (!allowed.has(priority)) throw badRequest("invalid_priority");
  return priority;
}

async function createMcpSessionCustomerFollowup(body) {
  const sessionCustomerId = String(body.sessionCustomerId || body.session_customer_id || body.id || "").trim();
  if (!sessionCustomerId) throw badRequest("session_customer_id_required");

  const title = String(body.title || body.followupTitle || body.followup_title || "").trim();
  if (!title) throw badRequest("followup_title_required");

  const dueDate = String(body.dueDate || body.due_date || "").trim();
  const priority = normalizeFollowupPriority(body.priority);
  const owner = String(body.owner || "").trim();
  const note = String(body.note || "").trim();
  const followupType = String(body.followupType || body.followup_type || body.type || "general").trim() || "general";

  return supabaseRpc("mcp_create_followup_from_session_customer", {
    p_session_customer_id: sessionCustomerId,
    p_title: title,
    p_due_date: dueDate || null,
    p_priority: priority,
    p_owner: owner || null,
    p_note: note || null,
    p_followup_type: followupType
  });
}

function randomId(prefix) {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : "-";
}

function timeOnly(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(11, 16) || "-";
  return date.toISOString().slice(11, 16);
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function moneyShort(value) {
  const amount = numberValue(value);
  if (amount >= 1000000) return `${Math.round(amount / 100000) / 10}M`;
  if (amount >= 1000) return `${Math.round(amount / 1000)}K`;
  return amount;
}

function normalizeRouteStatus(route, planned = 0, visited = 0) {
  if (route.active === false) return "paused";
  if (planned > 0 && visited < planned) return "watch";
  return "active";
}

function normalizeOrderStatus(status) {
  if (status === "pending_confirm") return "confirmed";
  if (status === "done") return "delivered";
  if (status === "cancelled") return "cancelled";
  if (status === "draft") return "draft";
  return status || "confirmed";
}

function normalizeTestStatus(status) {
  if (status === "ok") return "opportunity";
  if (status === "retry") return "risk";
  return "normal";
}

function normalizeSessionCustomerStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  if (!MCP_SESSION_CUSTOMER_STATUSES.has(status)) throw badRequest("invalid_visit_status");
  return status;
}

function sessionCustomerStatusNeedsReason(status) {
  return status === "skipped" || status === "cancelled";
}

function getMcpNextAction({ hasOrder, hasTest, hasReport, followupCount }) {
  if (hasOrder) return "Theo đơn";
  if (Number(followupCount || 0) > 0) return "Follow-up";
  if (hasReport) return "Theo báo cáo";
  if (hasTest) return "Theo test";
  return "Chăm sóc";
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw badRequest("invalid_json_body"); }
}

async function supabaseCount(table, params = {}) {
  const response = await fetch(buildSupabaseUrl(table, { select: "id", limit: 1, ...params }), {
    headers: supabaseHeaders({ Prefer: "count=exact" })
  });
  if (!response.ok) {
    const error = new Error("supabase_count_failed");
    error.statusCode = 502;
    error.detail = await response.text();
    error.table = table;
    throw error;
  }
  const total = response.headers.get("content-range")?.split("/")[1];
  return Number(total || 0);
}

function healthPayload() {
  return {
    ok: true,
    project: "MCP-Plan",
    service: SERVICE,
    server: "backend-DO-02",
    time: new Date().toISOString(),
    supabase: hasSupabaseConfig() ? "configured" : "missing_config",
    message: "MCP-Plan backend VPS is ready"
  };
}

async function loadRoutes() {
  const [routeRows, customerRows, sessionRows] = await Promise.all([
    supabaseGet("mcp_routes", { select: "id,route_name,area,active,weekday,note,created_at", order: "created_at.desc", limit: 100 }),
    supabaseGet("mcp_route_customers", { select: "id,route_id,active", limit: 1000 }),
    supabaseGet("mcp_route_sessions", { select: "route_id,session_date,visited_customers,order_count,status", order: "session_date.desc,created_at.desc", limit: 1000 })
  ]);
  const customersByRoute = new Map();
  customerRows.forEach((customer) => {
    if (!customersByRoute.has(customer.route_id)) customersByRoute.set(customer.route_id, []);
    customersByRoute.get(customer.route_id).push(customer);
  });
  const latestSessionByRoute = new Map();
  sessionRows.forEach((session) => {
    if (!latestSessionByRoute.has(session.route_id)) latestSessionByRoute.set(session.route_id, session);
  });
  return routeRows.map((route) => {
    const customers = customersByRoute.get(route.id) || [];
    const plannedCustomers = customers.filter((customer) => customer.active !== false).length;
    const latestSession = latestSessionByRoute.get(route.id);
    const visitedCustomers = numberValue(latestSession?.visited_customers);
    const orderCount = numberValue(latestSession?.order_count);
    return {
      id: route.id,
      name: route.route_name || "Tuyến chưa đặt tên",
      area: route.area || "-",
      salesOwner: route.note?.includes("Khương") ? "Khương Bình" : "Sale",
      plannedCustomers,
      visitedCustomers,
      orderCount,
      lastVisitDate: dateOnly(latestSession?.session_date),
      status: normalizeRouteStatus(route, plannedCustomers, visitedCustomers)
    };
  });
}

async function loadRouteCustomers(routeId) {
  const params = {
    select: "id,route_id,customer_id,customer_name,phone,area,address,sort_order,active,note,geo_lat,geo_lng,geo_accuracy,geo_captured_at,google_maps_url",
    order: "sort_order.asc,created_at.asc",
    limit: 1000
  };
  if (routeId) params.route_id = `eq.${routeId}`;
  const [customerRows, routeRows] = await Promise.all([
    supabaseGet("mcp_route_customers", params),
    supabaseGet("mcp_routes", { select: "id,route_name", limit: 100 })
  ]);
  const routeNames = new Map(routeRows.map((route) => [route.id, route.route_name || route.id]));
  return customerRows.map((customer) => ({
    id: customer.id,
    routeId: customer.route_id,
    routeName: routeNames.get(customer.route_id) || customer.route_id,
    accountId: customer.customer_id || customer.id,
    accountName: customer.customer_name || "Khách chưa tên",
    contactName: customer.phone || "Chưa có SĐT",
    area: customer.area || "-",
    sortOrder: numberValue(customer.sort_order),
    status: customer.active === false ? "hidden" : customer.geo_lat && customer.geo_lng ? "active" : "needs_gps",
    gps: customer.geo_lat && customer.geo_lng ? {
      lat: numberValue(customer.geo_lat),
      lng: numberValue(customer.geo_lng),
      accuracyMeters: numberValue(customer.geo_accuracy),
      updatedAt: dateOnly(customer.geo_captured_at)
    } : undefined,
    note: customer.note || customer.address || ""
  }));
}

async function loadLatestSession() {
  const sessions = await supabaseGet("mcp_route_sessions", {
    select: "id,route_id,route_name,session_date,sales,area,status,planned_customers,visited_customers,order_count,test_count,report_count,created_at",
    order: "session_date.desc,created_at.desc",
    limit: 1
  });
  return sessions[0] || null;
}

async function loadSessionByRouteDate(routeId, sessionDate) {
  if (!routeId && !sessionDate) return loadLatestSession();
  if (!routeId || !sessionDate) throw badRequest("route_id_and_date_required");
  const sessions = await supabaseGet("mcp_route_sessions", {
    select: "id,route_id,route_name,session_date,sales,area,status,planned_customers,visited_customers,order_count,test_count,report_count,created_at",
    route_id: `eq.${routeId}`,
    session_date: `eq.${sessionDate}`,
    limit: 1
  });
  return sessions[0] || null;
}

function emptyMcpDayData(routeId, sessionDate) {
  return {
    sessionOpened: false,
    run: { id: "no-session", routeId: routeId || undefined, routeName: "Chưa mở phiên", date: sessionDate || "-", owner: "-", status: "cancelled", openedAt: "-" },
    kpis: [
      { label: "Trong phiên", value: 0, hint: "Chưa mở phiên" },
      { label: "Đã ghé", value: 0, hint: "Có kết quả" },
      { label: "Chờ xử lý", value: 0, hint: "Chưa ghé" },
      { label: "Phát sinh", value: 0, hint: "Thêm trong ngày" }
    ],
    lines: [],
    results: []
  };
}

async function loadMcpDayData(url = new URL("http://local/api/mcp-day/data")) {
  const routeId = url.searchParams.get("routeId") || url.searchParams.get("route_id") || "";
  const sessionDate = (url.searchParams.get("date") || url.searchParams.get("sessionDate") || url.searchParams.get("session_date") || "").slice(0, 10);
  const session = await loadSessionByRouteDate(routeId, sessionDate);
  if (!session) return emptyMcpDayData(routeId, sessionDate);

  const [snapshots, visits] = await Promise.all([
    supabaseGet("mcp_session_customers", {
      select: "id,session_id,route_id,route_customer_id,customer_id,customer_name,phone,area,address,sort_order,source,planned_status,visit_status,status_reason,visit_id,order_id,test_id,report_id,followup_count,note,created_at,updated_at",
      session_id: `eq.${session.id}`,
      order: "sort_order.asc,created_at.asc",
      limit: 2000
    }),
    supabaseGet("mcp_visits", {
      select: "id,session_id,route_id,route_customer_id,visit_date,status,has_order,has_test,has_report,order_id,test_id,report_id,checkin_at,note,created_at",
      session_id: `eq.${session.id}`,
      order: "checkin_at.asc,created_at.asc",
      limit: 1000
    })
  ]);

  const visitById = new Map();
  const visitByRouteCustomer = new Map();
  visits.forEach((visit) => {
    if (visit.id) visitById.set(visit.id, visit);
    if (visit.route_customer_id && !visitByRouteCustomer.has(visit.route_customer_id)) visitByRouteCustomer.set(visit.route_customer_id, visit);
  });
  const snapshotByVisitId = new Map();
  const snapshotByRouteCustomerId = new Map();
  const lines = snapshots.map((snapshot) => {
    const visit = visitById.get(snapshot.visit_id) || visitByRouteCustomer.get(snapshot.route_customer_id);
    const status = snapshot.visit_status || (visit ? "visited" : "pending");
    const orderId = snapshot.order_id || visit?.order_id || null;
    const testId = snapshot.test_id || visit?.test_id || null;
    const reportId = snapshot.report_id || visit?.report_id || null;
    const hasOrder = Boolean(visit?.has_order || orderId);
    const hasTest = Boolean(visit?.has_test || testId);
    const hasReport = Boolean(visit?.has_report || reportId);
    const followupCount = numberValue(snapshot.followup_count);
    if (visit?.id) snapshotByVisitId.set(visit.id, snapshot);
    if (snapshot.route_customer_id) snapshotByRouteCustomerId.set(snapshot.route_customer_id, snapshot);
    return {
      id: snapshot.id,
      sessionCustomerId: snapshot.id,
      routeCustomerId: snapshot.route_customer_id,
      sortOrder: numberValue(snapshot.sort_order),
      accountName: snapshot.customer_name || "Khách chưa tên",
      area: snapshot.area || "-",
      source: snapshot.source === "added" ? "added" : "planned",
      status,
      statusReason: snapshot.status_reason || undefined,
      note: snapshot.note || snapshot.address || "Từ snapshot ngày",
      result: visit?.note || snapshot.status_reason || undefined,
      orderId: orderId || undefined,
      testId: testId || undefined,
      reportId: reportId || undefined,
      hasOrder,
      hasTest,
      hasReport,
      followupCount,
      visitId: visit?.id || snapshot.visit_id || undefined
    };
  });
  const results = visits.map((visit) => {
    const snapshot = snapshotByVisitId.get(visit.id) || snapshotByRouteCustomerId.get(visit.route_customer_id);
    const checkin = visit.checkin_at || visit.created_at;
    const orderId = snapshot?.order_id || visit.order_id || null;
    const testId = snapshot?.test_id || visit.test_id || null;
    const reportId = snapshot?.report_id || visit.report_id || null;
    const hasOrder = Boolean(visit.has_order || orderId);
    const hasTest = Boolean(visit.has_test || testId);
    const hasReport = Boolean(visit.has_report || reportId);
    const followupCount = numberValue(snapshot?.followup_count);
    return {
      id: visit.id,
      lineId: snapshot?.id || visit.route_customer_id || visit.id,
      sessionCustomerId: snapshot?.id,
      routeCustomerId: visit.route_customer_id,
      accountName: snapshot?.customer_name || "Điểm bán",
      startTime: timeOnly(checkin),
      endTime: timeOnly(checkin),
      result: visit.note || visit.status || "Đã ghé",
      orderId: orderId || undefined,
      testId: testId || undefined,
      reportId: reportId || undefined,
      hasOrder,
      hasTest,
      hasReport,
      followupCount,
      nextAction: getMcpNextAction({ hasOrder, hasTest, hasReport, followupCount })
    };
  });
  const visited = lines.filter((line) => line.status === "visited").length;
  const pending = lines.filter((line) => line.status === "pending").length;
  const added = lines.filter((line) => line.source === "added").length;
  return {
    sessionOpened: true,
    run: { id: session.id, routeId: session.route_id, routeName: session.route_name || "Tuyến MCP", date: dateOnly(session.session_date), owner: session.sales || "Sale", status: session.status === "cancelled" ? "cancelled" : "opened", openedAt: timeOnly(session.created_at) },
    kpis: [
      { label: "Trong phiên", value: lines.length, hint: "Snapshot ngày" },
      { label: "Đã ghé", value: visited, hint: "Có kết quả" },
      { label: "Chờ xử lý", value: pending, hint: "Chưa ghé" },
      { label: "Phát sinh", value: added, hint: "Thêm trong ngày" }
    ],
    lines,
    results
  };
}

async function openMcpDaySession(body) {
  const routeId = String(body.routeId || body.route_id || "").trim();
  const sessionDate = String(body.sessionDate || body.session_date || todayDateOnly()).slice(0, 10);
  const owner = String(body.owner || body.sales || "").trim();
  if (!routeId) throw badRequest("route_id_required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) throw badRequest("invalid_session_date");

  const routes = await supabaseGet("mcp_routes", { select: "id,route_name,area,weekday,active,note", id: `eq.${routeId}`, limit: 1 });
  const route = routes[0];
  if (!route) throw badRequest("route_not_found");
  if (route.active === false) throw badRequest("route_inactive");

  const routeCustomers = await supabaseGet("mcp_route_customers", { select: "id,route_id,customer_id,customer_name,phone,area,address,sort_order,active,note,raw_payload", route_id: `eq.${routeId}`, order: "sort_order.asc,created_at.asc", limit: 1000 });
  const activeCustomers = routeCustomers.filter((customer) => customer.active !== false);
  const existingSessions = await supabaseGet("mcp_route_sessions", { select: "id,route_id,route_name,session_date,sales,area,status,planned_customers,visited_customers,order_count,test_count,report_count,created_at", route_id: `eq.${routeId}`, session_date: `eq.${sessionDate}`, limit: 1 });
  let session = existingSessions[0] || null;
  let createdSession = false;
  if (!session) {
    const inserted = await supabaseInsert("mcp_route_sessions", {
      id: randomId("mrs"), route_id: route.id, route_name: route.route_name || route.id, session_date: sessionDate, weekday: route.weekday,
      sales: owner || "Sale", area: route.area, status: "active", planned_customers: activeCustomers.length, visited_customers: 0, order_count: 0, test_count: 0, report_count: 0,
      note: "Opened by backend API", raw_payload: { source: "api_open_session", route_snapshot: route }
    });
    session = inserted[0];
    createdSession = true;
  }

  const existingSnapshots = await supabaseGet("mcp_session_customers", {
    select: "id,route_customer_id",
    session_id: `eq.${session.id}`,
    order: "created_at.asc",
    limit: 2000
  });
  const existingRouteCustomerIds = new Set(existingSnapshots.map((snapshot) => snapshot.route_customer_id).filter(Boolean));
  const missingCustomers = activeCustomers.filter((customer) => !existingRouteCustomerIds.has(customer.id));

  let insertedSnapshots = [];
  if (missingCustomers.length > 0) {
    const snapshotRows = missingCustomers.map((customer) => ({
      id: randomId("msc"), session_id: session.id, route_id: route.id, route_customer_id: customer.id, customer_id: customer.customer_id,
      customer_name: customer.customer_name || "Khách chưa tên", phone: customer.phone, area: customer.area, address: customer.address,
      sort_order: customer.sort_order || 0, source: "master", planned_status: "planned", visit_status: "pending", note: customer.note,
      raw_payload: { route_customer_snapshot: customer }
    }));
    insertedSnapshots = await supabaseInsert("mcp_session_customers", snapshotRows);
  }

  if (Number(session.planned_customers || 0) !== activeCustomers.length) {
    const now = new Date().toISOString();
    const updatedSessions = await supabasePatch("mcp_route_sessions", { planned_customers: activeCustomers.length, updated_at: now }, { id: `eq.${session.id}` });
    session = updatedSessions[0] || { ...session, planned_customers: activeCustomers.length, updated_at: now };
  }

  const snapshotCount = existingSnapshots.length + insertedSnapshots.length;
  return { session, createdSession, insertedSnapshotCount: insertedSnapshots.length, snapshotCount };
}

async function updateMcpSessionCustomerStatus(body) {
  const sessionCustomerId = String(body.sessionCustomerId || body.session_customer_id || body.id || "").trim();
  const visitStatus = normalizeSessionCustomerStatus(body.visitStatus || body.visit_status || body.status);
  const statusReason = String(body.statusReason || body.status_reason || body.reason || "").trim();
  const note = String(body.note || "").trim();
  const now = new Date().toISOString();
  if (!sessionCustomerId) throw badRequest("session_customer_id_required");
  if (sessionCustomerStatusNeedsReason(visitStatus) && !statusReason) throw badRequest("status_reason_required");
  const rows = await supabaseGet("mcp_session_customers", { select: "id,session_id,route_id,route_customer_id,customer_id,customer_name,visit_status,status_reason,visit_id,note", id: `eq.${sessionCustomerId}`, limit: 1 });
  const sessionCustomer = rows[0];
  if (!sessionCustomer) throw badRequest("session_customer_not_found");
  let visit = null;
  let createdVisit = false;
  if (visitStatus === "visited") {
    if (sessionCustomer.visit_id) {
      const updatedVisits = await supabasePatch("mcp_visits", { status: "visited", checkin_at: now, note: note || sessionCustomer.note || "Đã ghé", updated_at: now }, { id: `eq.${sessionCustomer.visit_id}` });
      visit = updatedVisits[0] || null;
    } else {
      const insertedVisits = await supabaseInsert("mcp_visits", { id: randomId("mcv"), session_id: sessionCustomer.session_id, route_id: sessionCustomer.route_id, route_customer_id: sessionCustomer.route_customer_id, visit_date: todayDateOnly(), status: "visited", has_order: false, has_test: false, has_report: false, checkin_at: now, note: note || "Đã ghé", raw_payload: { source: "api_session_customer_status", session_customer_id: sessionCustomer.id, customer_id: sessionCustomer.customer_id, customer_name: sessionCustomer.customer_name } });
      visit = insertedVisits[0] || null;
      createdVisit = Boolean(visit);
    }
  }
  const updatedSessionCustomers = await supabasePatch("mcp_session_customers", { visit_status: visitStatus, status_reason: sessionCustomerStatusNeedsReason(visitStatus) ? statusReason : null, visit_id: visit?.id || sessionCustomer.visit_id || null, note: note || sessionCustomer.note, updated_at: now }, { id: `eq.${sessionCustomer.id}` });
  const visitedCount = await supabaseCount("mcp_session_customers", { session_id: `eq.${sessionCustomer.session_id}`, visit_status: "eq.visited" });
  await supabasePatch("mcp_route_sessions", { visited_customers: visitedCount, updated_at: now }, { id: `eq.${sessionCustomer.session_id}` });
  return { sessionCustomer: updatedSessionCustomers[0], visit, createdVisit };
}

async function loadOrders(url) {
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search")?.trim().toLowerCase();
  const [orderRows, itemRows] = await Promise.all([
    supabaseGet("orders", { select: "id,order_code,order_date,sales,customer_name,area,source_type,status,grand_total,created_at", order: "order_date.desc,created_at.desc", limit: 500 }),
    supabaseGet("order_items", { select: "order_id,product_name,quantity", limit: 1000 })
  ]);
  const itemsByOrder = new Map();
  itemRows.forEach((item) => {
    if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
    itemsByOrder.get(item.order_id).push(item);
  });
  return orderRows.map((order) => {
    const items = itemsByOrder.get(order.id) || [];
    return { id: order.id, code: order.order_code || order.id, date: dateOnly(order.order_date || order.created_at), accountName: order.customer_name || "Khách chưa tên", routeName: order.area || "-", owner: order.sales || "Sale", source: order.source_type || "order", skuCount: items.length, quantity: items.reduce((sum, item) => sum + numberValue(item.quantity), 0), totalAmount: numberValue(order.grand_total), status: normalizeOrderStatus(order.status) };
  }).filter((order) => {
    if (status && order.status !== status) return false;
    if (!search) return true;
    return `${order.code} ${order.accountName} ${order.routeName} ${order.owner} ${order.source}`.toLowerCase().includes(search);
  });
}

async function loadMarketChecks(url) {
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search")?.trim().toLowerCase();
  const [results, customers] = await Promise.all([
    supabaseGet("test_customer_results", { select: "id,file_id,customer_id,product_name,status,note,updated_at,created_at", order: "updated_at.desc,created_at.desc", limit: 300 }),
    supabaseGet("test_customers", { select: "id,customer_name,area,status,note", limit: 1000 })
  ]);
  const customersById = new Map(customers.map((customer) => [customer.id, customer]));
  return results.map((result) => {
    const customer = customersById.get(result.customer_id);
    return { id: result.id, date: dateOnly(result.updated_at || result.created_at), routeName: customer?.area || "Test sản phẩm", accountName: customer?.customer_name || "Khách test", productName: result.product_name || "Sản phẩm test", competitorName: result.status || "-", shelfPrice: 0, stockStatus: result.status || "pending", note: result.note || customer?.note || "", status: normalizeTestStatus(result.status) };
  }).filter((check) => {
    if (status && check.status !== status) return false;
    if (!search) return true;
    return `${check.accountName} ${check.routeName} ${check.productName} ${check.competitorName} ${check.note}`.toLowerCase().includes(search);
  });
}

async function loadActions(url) {
  const [orders, checks, mcpData] = await Promise.all([
    loadOrders(new URL("http://local/api/orders")),
    loadMarketChecks(new URL("http://local/api/market-checks")),
    loadMcpDayData(new URL("http://local/api/mcp-day/data"))
  ]);
  const orderActions = orders.filter((order) => order.status !== "delivered" && order.status !== "cancelled").slice(0, 5).map((order) => ({ id: `order-action-${order.id}`, title: `Theo đơn ${order.code}`, accountName: order.accountName, routeName: order.routeName, owner: order.owner, source: "order", priority: "medium", status: "todo", dueDate: order.date, note: `${order.skuCount} SKU · ${order.totalAmount}` }));
  const testActions = checks.filter((check) => check.status !== "normal").slice(0, 5).map((check) => ({ id: `test-action-${check.id}`, title: `Theo test ${check.productName}`, accountName: check.accountName, routeName: check.routeName, owner: "Sale", source: "field_check", priority: check.status === "risk" ? "high" : "medium", status: "todo", dueDate: check.date, note: check.note || check.stockStatus }));
  const mcpActions = mcpData.lines.filter((line) => line.status === "pending").slice(0, 5).map((line) => ({ id: `mcp-action-${line.id}`, title: `Ghé ${line.accountName}`, accountName: line.accountName, routeName: mcpData.run.routeName, owner: mcpData.run.owner, source: "session", priority: "high", status: "todo", dueDate: mcpData.run.date, note: line.note }));
  const status = url.searchParams.get("status");
  const priority = url.searchParams.get("priority");
  const search = url.searchParams.get("search")?.trim().toLowerCase();
  return [...mcpActions, ...orderActions, ...testActions].filter((action) => {
    if (status && action.status !== status) return false;
    if (priority && action.priority !== priority) return false;
    if (!search) return true;
    return `${action.title} ${action.accountName} ${action.routeName} ${action.owner} ${action.source} ${action.note}`.toLowerCase().includes(search);
  });
}

async function getDashboardSummary() {
  const [routeCount, accountCount, visitCount, orders, actions] = await Promise.all([supabaseCount("mcp_routes"), supabaseCount("mcp_route_customers"), supabaseCount("mcp_visits"), loadOrders(new URL("http://local/api/orders")), loadActions(new URL("http://local/api/actions"))]);
  return { routeCount, accountCount, visitCount, orderAmount: orders.reduce((sum, order) => sum + numberValue(order.totalAmount), 0), actionCount: actions.length };
}

async function getDashboardOverview() {
  const [summary, routes, orders, checks, actions] = await Promise.all([getDashboardSummary(), loadRoutes(), loadOrders(new URL("http://local/api/orders")), loadMarketChecks(new URL("http://local/api/market-checks")), loadActions(new URL("http://local/api/actions"))]);
  const routeHealth = routes.slice(0, 5).map((route) => ({ routeName: route.name, area: route.area, planned: route.plannedCustomers, visited: route.visitedCustomers, orders: route.orderCount, status: route.status === "active" ? "good" : route.status === "watch" ? "watch" : "risk" }));
  const visitedRate = summary.accountCount > 0 ? Math.round((summary.visitCount / summary.accountCount) * 100) : 0;
  const orderRate = summary.visitCount > 0 ? Math.round((orders.length / summary.visitCount) * 1000) / 10 : 0;
  return { kpis: [{ label: "Doanh số hôm nay", value: moneyShort(summary.orderAmount), hint: "Supabase live", trend: `${orders.length} đơn` }, { label: "Tuyến active", value: summary.routeCount, hint: "Route master", trend: "Live" }, { label: "Điểm bán", value: summary.accountCount, hint: "Trong tuyến", trend: `${routeHealth.filter((route) => route.status !== "good").length} cần xem` }, { label: "Lượt ghé", value: summary.visitCount, hint: "Đã ghi nhận", trend: `${visitedRate}% phủ tuyến` }], routeHealth, actions: actions.slice(0, 4).map((action) => ({ title: action.title, description: action.note || `${action.accountName} · ${action.routeName}`, priority: action.priority, owner: action.owner })), insights: [{ label: "Tỷ lệ ghé thăm", value: `${visitedRate}%` }, { label: "Tỷ lệ có đơn", value: `${orderRate}%` }, { label: "Kết quả test", value: String(checks.length) }, { label: "Nguồn", value: "Supabase live" }] };
}

async function getRoutesList() {
  const routes = await loadRoutes();
  return routes.map((route) => ({ id: route.id, name: route.name, area: route.area, owner: route.salesOwner, active: route.status !== "paused" }));
}

async function getRoutesData() {
  const routes = await loadRoutes();
  const totalCustomers = routes.reduce((sum, route) => sum + route.plannedCustomers, 0);
  const totalVisited = routes.reduce((sum, route) => sum + route.visitedCustomers, 0);
  const watchRoutes = routes.filter((route) => route.status === "watch").length;
  return { kpis: [{ label: "Tuyến active", value: routes.filter((route) => route.status === "active").length, hint: "Supabase live" }, { label: "Tổng điểm bán", value: totalCustomers, hint: "Route master" }, { label: "Đã ghé", value: `${totalVisited}/${totalCustomers}`, hint: "Theo session" }, { label: "Tuyến cần theo dõi", value: watchRoutes, hint: "Cần xem lại lịch ghé" }], routes };
}

async function getRouteCustomersData(url) {
  const routeId = url.searchParams.get("routeId");
  const customers = await loadRouteCustomers(routeId);
  const withGps = customers.filter((customer) => Boolean(customer.gps)).length;
  const needsGps = customers.filter((customer) => customer.status === "needs_gps").length;
  const hidden = customers.filter((customer) => customer.status === "hidden").length;
  return { kpis: [{ label: "Khách trong tuyến", value: customers.length, hint: routeId || "Tất cả tuyến" }, { label: "Đã có GPS", value: withGps, hint: "Mở được bản đồ" }, { label: "Cần GPS", value: needsGps, hint: "Cần sale cập nhật" }, { label: "Đang ẩn", value: hidden, hint: "Không hard delete" }], customers };
}

async function getCurrentMcpDayRun(url) {
  const data = await loadMcpDayData(url);
  return data.run;
}

async function getMarketChecksData(url) {
  const checks = await loadMarketChecks(url);
  const opportunities = checks.filter((check) => check.status === "opportunity").length;
  const risks = checks.filter((check) => check.status === "risk").length;
  const skuCount = new Set(checks.map((check) => check.productName)).size;
  return { kpis: [{ label: "Điểm đã kiểm", value: checks.length, hint: "Supabase live" }, { label: "Cơ hội", value: opportunities, hint: "Kết quả OK" }, { label: "Rủi ro", value: risks, hint: "Cần thử lại" }, { label: "SKU", value: skuCount, hint: "Sản phẩm ghi nhận" }], checks };
}

async function getActionsData(url) {
  const items = await loadActions(url);
  return { kpis: [{ label: "Việc mở", value: items.filter((item) => item.status !== "done").length, hint: "Cần xử lý" }, { label: "Ưu tiên cao", value: items.filter((item) => item.priority === "high").length, hint: "Làm trước" }, { label: "Đang làm", value: items.filter((item) => item.status === "doing").length, hint: "Có owner" }, { label: "Bị chặn", value: items.filter((item) => item.status === "blocked").length, hint: "Cần gỡ vướng" }], items };
}

async function handlePost(req, url) {
  if (url.pathname === "/api/mcp-day/open-session") return wrap(await openMcpDaySession(await readJsonBody(req)));
  if (url.pathname === "/api/mcp-day/session-customer/status") return wrap(await updateMcpSessionCustomerStatus(await readJsonBody(req)));
  if (url.pathname === "/api/mcp-day/session-customer/order") return wrap(await createMcpSessionCustomerOrder(await readJsonBody(req)));
  if (url.pathname === "/api/mcp-day/session-customer/test") return wrap(await createMcpSessionCustomerTest(await readJsonBody(req)));
  if (url.pathname === "/api/mcp-day/session-customer/report") return wrap(await createMcpSessionCustomerReport(await readJsonBody(req)));
  if (url.pathname === "/api/mcp-day/session-customer/result") return wrap(await proxySupabaseFunction("mcp-day-8b3", await readJsonBody(req)));
  if (url.pathname === "/api/mcp-day/session-customer/add") return wrap(await proxySupabaseFunction("mcp-day-8b3", await readJsonBody(req), { action: "add" }));
  if (url.pathname === "/api/mcp-day/session-customer/followup") return wrap(await createMcpSessionCustomerFollowup(await readJsonBody(req)));
  const error = new Error("not_found");
  error.statusCode = 404;
  throw error;
}

async function handleGet(url) {
  if (url.pathname === "/" || url.pathname === "/health" || url.pathname === "/api/health") return healthPayload();
  if (url.pathname === "/api/dashboard/summary") return wrap(await getDashboardSummary());
  if (url.pathname === "/api/dashboard/overview") return wrap(await getDashboardOverview());
  if (url.pathname === "/api/routes") return wrap(await getRoutesList());
  if (url.pathname === "/api/routes/data") return wrap(await getRoutesData());
  if (url.pathname === "/api/routes/customers/data") return wrap(await getRouteCustomersData(url));
  if (url.pathname === "/api/mcp-day/current") return wrap(await getCurrentMcpDayRun(url));
  if (url.pathname === "/api/mcp-day/data") return wrap(await loadMcpDayData(url));
  if (url.pathname === "/api/mcp-day/test-options") return wrap(await loadMcpTestOptions());
  if (url.pathname === "/api/orders") return wrap(await loadOrders(url));
  if (url.pathname === "/api/tests") return wrap(await getMarketChecksData(url));
  if (url.pathname === "/api/market-checks") return wrap((await loadMarketChecks(url)).map((check) => ({ id: check.id, date: check.date, routeName: check.routeName, accountName: check.accountName, productName: check.productName, status: check.status })));
  if (url.pathname === "/api/market-checks/data") return wrap(await getMarketChecksData(url));
  if (url.pathname === "/api/actions") return wrap((await loadActions(url)).map((action) => ({ id: action.id, title: action.title, owner: action.owner, priority: action.priority, status: action.status, dueDate: action.dueDate })));
  if (url.pathname === "/api/actions/data") return wrap(await getActionsData(url));
  const error = new Error("not_found");
  error.statusCode = 404;
  throw error;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || `${HOST}:${PORT}`}`);
  if (req.method === "OPTIONS") {
    json(res, 204, {});
    return;
  }
  const handler = req.method === "GET" ? handleGet(url) : req.method === "POST" ? handlePost(req, url) : Promise.reject(Object.assign(new Error("method_not_allowed"), { statusCode: 405 }));
  handler.then((payload) => json(res, 200, payload)).catch((error) => json(res, error.statusCode || 500, { ok: false, service: SERVICE, error: error.message || "internal_error", detail: error.detail, table: error.table, path: url.pathname }));
});

server.listen(PORT, HOST, () => {
  console.log(`${SERVICE} listening on http://${HOST}:${PORT}`);
});


