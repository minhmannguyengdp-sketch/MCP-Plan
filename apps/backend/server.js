import http from "node:http";
import { loadEnvFile } from "node:process";

try {
  loadEnvFile(".env");
} catch {
  // Production can also provide env vars through PM2/systemd.
}

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3001);
const SERVICE = "mcp-plan-backend";
const SUPABASE_URL = process.env.SUPABASE_URL?.trim();
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": process.env.CORS_ORIGINS || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept"
  });
  res.end(body);
}

function wrap(data) {
  return {
    data,
    receivedAt: new Date().toISOString()
  };
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
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return url;
}

async function supabaseGet(table, params = {}, options = {}) {
  const response = await fetch(buildSupabaseUrl(table, params), {
    headers: supabaseHeaders(options.headers)
  });

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error("supabase_read_failed");
    error.statusCode = 502;
    error.detail = detail;
    error.table = table;
    throw error;
  }

  return response.json();
}

async function supabaseCount(table, params = {}) {
  const response = await fetch(buildSupabaseUrl(table, { select: "id", limit: 1, ...params }), {
    headers: supabaseHeaders({ Prefer: "count=exact" })
  });

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error("supabase_count_failed");
    error.statusCode = 502;
    error.detail = detail;
    error.table = table;
    throw error;
  }

  const contentRange = response.headers.get("content-range");
  const total = contentRange?.split("/")[1];
  return Number(total || 0);
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

function moneyShort(value) {
  const amount = numberValue(value);
  if (amount >= 1000000) return `${Math.round(amount / 100000) / 10}M`;
  if (amount >= 1000) return `${Math.round(amount / 1000)}K`;
  return amount;
}

function normalizeOrderStatus(status) {
  if (status === "pending_confirm") return "confirmed";
  if (status === "done") return "delivered";
  if (status === "cancelled") return "cancelled";
  if (status === "draft") return "draft";
  return status || "confirmed";
}

function normalizeRouteStatus(route, planned = 0, visited = 0) {
  if (route.active === false) return "paused";
  if (planned > 0 && visited < planned) return "watch";
  return "active";
}

function normalizeLineStatus(visit) {
  if (!visit) return "pending";
  if (visit.status === "skipped" || visit.status === "cancelled") return visit.status;
  return "visited";
}

function normalizeTestStatus(status) {
  if (status === "ok") return "opportunity";
  if (status === "retry") return "risk";
  return "normal";
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

async function loadMcpDayData() {
  const session = await loadLatestSession();

  if (!session) {
    return {
      run: { id: "no-session", routeName: "Chưa có phiên", date: "-", owner: "-", status: "cancelled", openedAt: "-" },
      kpis: [
        { label: "Trong phiên", value: 0, hint: "Snapshot ngày" },
        { label: "Đã ghé", value: 0, hint: "Có kết quả" },
        { label: "Chờ xử lý", value: 0, hint: "Chưa ghé" },
        { label: "Phát sinh", value: 0, hint: "Thêm trong ngày" }
      ],
      lines: [],
      results: []
    };
  }

  const [customers, visits] = await Promise.all([
    loadRouteCustomers(session.route_id),
    supabaseGet("mcp_visits", {
      select: "id,session_id,route_id,route_customer_id,visit_date,status,has_order,has_test,has_report,checkin_at,note,created_at",
      session_id: `eq.${session.id}`,
      order: "checkin_at.asc,created_at.asc",
      limit: 1000
    })
  ]);

  const visitByRouteCustomer = new Map();
  visits.forEach((visit) => {
    if (visit.route_customer_id && !visitByRouteCustomer.has(visit.route_customer_id)) {
      visitByRouteCustomer.set(visit.route_customer_id, visit);
    }
  });

  const lines = customers.map((customer) => {
    const visit = visitByRouteCustomer.get(customer.id);
    return {
      id: customer.id,
      sortOrder: customer.sortOrder,
      accountName: customer.accountName,
      area: customer.area,
      source: "planned",
      status: normalizeLineStatus(visit),
      note: customer.note || "Từ tuyến gốc",
      result: visit?.note || undefined,
      hasOrder: Boolean(visit?.has_order)
    };
  });

  const results = visits.map((visit) => {
    const customer = customers.find((item) => item.id === visit.route_customer_id);
    const checkin = visit.checkin_at || visit.created_at;
    return {
      id: visit.id,
      lineId: visit.route_customer_id || visit.id,
      accountName: customer?.accountName || "Điểm bán",
      startTime: timeOnly(checkin),
      endTime: timeOnly(checkin),
      result: visit.note || visit.status || "Đã ghé",
      hasOrder: Boolean(visit.has_order),
      nextAction: visit.has_order ? "Theo đơn" : visit.has_test ? "Theo test" : visit.has_report ? "Theo báo cáo" : "Chăm sóc"
    };
  });

  const visited = lines.filter((line) => line.status === "visited").length;
  const pending = lines.filter((line) => line.status === "pending").length;

  return {
    run: {
      id: session.id,
      routeName: session.route_name || "Tuyến MCP",
      date: dateOnly(session.session_date),
      owner: session.sales || "Sale",
      status: session.status === "cancelled" ? "cancelled" : "opened",
      openedAt: timeOnly(session.created_at)
    },
    kpis: [
      { label: "Trong phiên", value: lines.length, hint: "Snapshot ngày" },
      { label: "Đã ghé", value: visited, hint: "Có kết quả" },
      { label: "Chờ xử lý", value: pending, hint: "Chưa ghé" },
      { label: "Phát sinh", value: 0, hint: "Thêm trong ngày" }
    ],
    lines,
    results
  };
}

async function loadOrders(url) {
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search")?.trim().toLowerCase();

  const [orderRows, itemRows] = await Promise.all([
    supabaseGet("orders", {
      select: "id,order_code,order_date,sales,customer_name,area,source_type,status,grand_total,created_at",
      order: "order_date.desc,created_at.desc",
      limit: 500
    }),
    supabaseGet("order_items", { select: "order_id,product_name,quantity", limit: 1000 })
  ]);

  const itemsByOrder = new Map();
  itemRows.forEach((item) => {
    if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
    itemsByOrder.get(item.order_id).push(item);
  });

  return orderRows
    .map((order) => {
      const items = itemsByOrder.get(order.id) || [];
      return {
        id: order.id,
        code: order.order_code || order.id,
        date: dateOnly(order.order_date || order.created_at),
        accountName: order.customer_name || "Khách chưa tên",
        routeName: order.area || "-",
        owner: order.sales || "Sale",
        source: order.source_type || "order",
        skuCount: items.length,
        quantity: items.reduce((sum, item) => sum + numberValue(item.quantity), 0),
        totalAmount: numberValue(order.grand_total),
        status: normalizeOrderStatus(order.status)
      };
    })
    .filter((order) => {
      if (status && order.status !== status) return false;
      if (search) {
        const haystack = `${order.code} ${order.accountName} ${order.routeName} ${order.owner} ${order.source}`.toLowerCase();
        return haystack.includes(search);
      }
      return true;
    });
}

async function loadMarketChecks(url) {
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search")?.trim().toLowerCase();

  const [results, customers] = await Promise.all([
    supabaseGet("test_customer_results", {
      select: "id,file_id,customer_id,product_name,status,note,updated_at,created_at",
      order: "updated_at.desc,created_at.desc",
      limit: 300
    }),
    supabaseGet("test_customers", { select: "id,customer_name,area,status,note", limit: 1000 })
  ]);

  const customersById = new Map(customers.map((customer) => [customer.id, customer]));

  return results
    .map((result) => {
      const customer = customersById.get(result.customer_id);
      const normalizedStatus = normalizeTestStatus(result.status);
      return {
        id: result.id,
        date: dateOnly(result.updated_at || result.created_at),
        routeName: customer?.area || "Test sản phẩm",
        accountName: customer?.customer_name || "Khách test",
        productName: result.product_name || "Sản phẩm test",
        competitorName: result.status || "-",
        shelfPrice: 0,
        stockStatus: result.status || "pending",
        note: result.note || customer?.note || "",
        status: normalizedStatus
      };
    })
    .filter((check) => {
      if (status && check.status !== status) return false;
      if (search) {
        const haystack = `${check.accountName} ${check.routeName} ${check.productName} ${check.competitorName} ${check.note}`.toLowerCase();
        return haystack.includes(search);
      }
      return true;
    });
}

async function loadActions(url) {
  const [orders, checks, mcpData] = await Promise.all([
    loadOrders(new URL("http://local/api/orders")),
    loadMarketChecks(new URL("http://local/api/market-checks")),
    loadMcpDayData()
  ]);

  const orderActions = orders
    .filter((order) => order.status !== "delivered" && order.status !== "cancelled")
    .slice(0, 5)
    .map((order) => ({
      id: `order-action-${order.id}`,
      title: `Theo đơn ${order.code}`,
      accountName: order.accountName,
      routeName: order.routeName,
      owner: order.owner,
      source: "order",
      priority: "medium",
      status: "todo",
      dueDate: order.date,
      note: `${order.skuCount} SKU · ${order.totalAmount}`
    }));

  const testActions = checks
    .filter((check) => check.status !== "normal")
    .slice(0, 5)
    .map((check) => ({
      id: `test-action-${check.id}`,
      title: `Theo test ${check.productName}`,
      accountName: check.accountName,
      routeName: check.routeName,
      owner: "Sale",
      source: "field_check",
      priority: check.status === "risk" ? "high" : "medium",
      status: "todo",
      dueDate: check.date,
      note: check.note || check.stockStatus
    }));

  const mcpActions = mcpData.lines
    .filter((line) => line.status === "pending")
    .slice(0, 5)
    .map((line) => ({
      id: `mcp-action-${line.id}`,
      title: `Ghé ${line.accountName}`,
      accountName: line.accountName,
      routeName: mcpData.run.routeName,
      owner: mcpData.run.owner,
      source: "session",
      priority: "high",
      status: "todo",
      dueDate: mcpData.run.date,
      note: line.note
    }));

  const status = url.searchParams.get("status");
  const priority = url.searchParams.get("priority");
  const search = url.searchParams.get("search")?.trim().toLowerCase();

  return [...mcpActions, ...orderActions, ...testActions].filter((action) => {
    if (status && action.status !== status) return false;
    if (priority && action.priority !== priority) return false;
    if (search) {
      const haystack = `${action.title} ${action.accountName} ${action.routeName} ${action.owner} ${action.source} ${action.note}`.toLowerCase();
      return haystack.includes(search);
    }
    return true;
  });
}

async function getDashboardSummary() {
  const [routeCount, accountCount, visitCount, orders, actions] = await Promise.all([
    supabaseCount("mcp_routes"),
    supabaseCount("mcp_route_customers"),
    supabaseCount("mcp_visits"),
    loadOrders(new URL("http://local/api/orders")),
    loadActions(new URL("http://local/api/actions"))
  ]);

  return {
    routeCount,
    accountCount,
    visitCount,
    orderAmount: orders.reduce((sum, order) => sum + numberValue(order.totalAmount), 0),
    actionCount: actions.length
  };
}

async function getDashboardOverview() {
  const [summary, routes, orders, checks, actions] = await Promise.all([
    getDashboardSummary(),
    loadRoutes(),
    loadOrders(new URL("http://local/api/orders")),
    loadMarketChecks(new URL("http://local/api/market-checks")),
    loadActions(new URL("http://local/api/actions"))
  ]);

  const routeHealth = routes.slice(0, 5).map((route) => ({
    routeName: route.name,
    area: route.area,
    planned: route.plannedCustomers,
    visited: route.visitedCustomers,
    orders: route.orderCount,
    status: route.status === "active" ? "good" : route.status === "watch" ? "watch" : "risk"
  }));

  const visitedRate = summary.accountCount > 0 ? Math.round((summary.visitCount / summary.accountCount) * 100) : 0;
  const orderRate = summary.visitCount > 0 ? Math.round((orders.length / summary.visitCount) * 1000) / 10 : 0;

  return {
    kpis: [
      { label: "Doanh số hôm nay", value: moneyShort(summary.orderAmount), hint: "Supabase live", trend: `${orders.length} đơn` },
      { label: "Tuyến active", value: summary.routeCount, hint: "Route master", trend: "Live" },
      { label: "Điểm bán", value: summary.accountCount, hint: "Trong tuyến", trend: `${routeHealth.filter((route) => route.status !== "good").length} cần xem` },
      { label: "Lượt ghé", value: summary.visitCount, hint: "Đã ghi nhận", trend: `${visitedRate}% phủ tuyến` }
    ],
    routeHealth,
    actions: actions.slice(0, 4).map((action) => ({
      title: action.title,
      description: action.note || `${action.accountName} · ${action.routeName}`,
      priority: action.priority,
      owner: action.owner
    })),
    insights: [
      { label: "Tỷ lệ ghé thăm", value: `${visitedRate}%` },
      { label: "Tỷ lệ có đơn", value: `${orderRate}%` },
      { label: "Kết quả test", value: String(checks.length) },
      { label: "Nguồn", value: "Supabase live" }
    ]
  };
}

async function getRoutesList() {
  const routes = await loadRoutes();
  return routes.map((route) => ({
    id: route.id,
    name: route.name,
    area: route.area,
    owner: route.salesOwner,
    active: route.status !== "paused"
  }));
}

async function getRoutesData() {
  const routes = await loadRoutes();
  const totalCustomers = routes.reduce((sum, route) => sum + route.plannedCustomers, 0);
  const totalVisited = routes.reduce((sum, route) => sum + route.visitedCustomers, 0);
  const watchRoutes = routes.filter((route) => route.status === "watch").length;

  return {
    kpis: [
      { label: "Tuyến active", value: routes.filter((route) => route.status === "active").length, hint: "Supabase live" },
      { label: "Tổng điểm bán", value: totalCustomers, hint: "Route master" },
      { label: "Đã ghé", value: `${totalVisited}/${totalCustomers}`, hint: "Theo session" },
      { label: "Tuyến cần theo dõi", value: watchRoutes, hint: "Cần xem lại lịch ghé" }
    ],
    routes
  };
}

async function getRouteCustomersData(url) {
  const routeId = url.searchParams.get("routeId");
  const customers = await loadRouteCustomers(routeId);
  const withGps = customers.filter((customer) => Boolean(customer.gps)).length;
  const needsGps = customers.filter((customer) => customer.status === "needs_gps").length;
  const hidden = customers.filter((customer) => customer.status === "hidden").length;

  return {
    kpis: [
      { label: "Khách trong tuyến", value: customers.length, hint: routeId || "Tất cả tuyến" },
      { label: "Đã có GPS", value: withGps, hint: "Mở được bản đồ" },
      { label: "Cần GPS", value: needsGps, hint: "Cần sale cập nhật" },
      { label: "Đang ẩn", value: hidden, hint: "Không hard delete" }
    ],
    customers
  };
}

async function getCurrentMcpDayRun() {
  const session = await loadLatestSession();
  if (!session) return { id: "no-session", routeName: "Chưa có phiên", date: "-", owner: "-", status: "cancelled" };
  return {
    id: session.id,
    routeName: session.route_name || "Tuyến MCP",
    date: dateOnly(session.session_date),
    owner: session.sales || "Sale",
    status: session.status === "cancelled" ? "cancelled" : "opened"
  };
}

async function getMarketChecksData(url) {
  const checks = await loadMarketChecks(url);
  const opportunities = checks.filter((check) => check.status === "opportunity").length;
  const risks = checks.filter((check) => check.status === "risk").length;
  const skuCount = new Set(checks.map((check) => check.productName)).size;

  return {
    kpis: [
      { label: "Điểm đã kiểm", value: checks.length, hint: "Supabase live" },
      { label: "Cơ hội", value: opportunities, hint: "Kết quả OK" },
      { label: "Rủi ro", value: risks, hint: "Cần thử lại" },
      { label: "SKU", value: skuCount, hint: "Sản phẩm ghi nhận" }
    ],
    checks
  };
}

async function getActionsData(url) {
  const items = await loadActions(url);
  const openItems = items.filter((item) => item.status !== "done").length;
  const highPriority = items.filter((item) => item.priority === "high").length;
  const doingItems = items.filter((item) => item.status === "doing").length;
  const blockedItems = items.filter((item) => item.status === "blocked").length;

  return {
    kpis: [
      { label: "Việc mở", value: openItems, hint: "Cần xử lý" },
      { label: "Ưu tiên cao", value: highPriority, hint: "Làm trước" },
      { label: "Đang làm", value: doingItems, hint: "Có owner" },
      { label: "Bị chặn", value: blockedItems, hint: "Cần gỡ vướng" }
    ],
    items
  };
}

async function handleGet(url) {
  if (url.pathname === "/" || url.pathname === "/health" || url.pathname === "/api/health") return healthPayload();
  if (url.pathname === "/api/dashboard/summary") return wrap(await getDashboardSummary());
  if (url.pathname === "/api/dashboard/overview") return wrap(await getDashboardOverview());
  if (url.pathname === "/api/routes") return wrap(await getRoutesList());
  if (url.pathname === "/api/routes/data") return wrap(await getRoutesData());
  if (url.pathname === "/api/routes/customers/data") return wrap(await getRouteCustomersData(url));
  if (url.pathname === "/api/mcp-day/current") return wrap(await getCurrentMcpDayRun());
  if (url.pathname === "/api/mcp-day/data") return wrap(await loadMcpDayData());
  if (url.pathname === "/api/orders") return wrap(await loadOrders(url));
  if (url.pathname === "/api/tests") return wrap(await getMarketChecksData(url));
  if (url.pathname === "/api/market-checks") {
    const checks = await loadMarketChecks(url);
    return wrap(checks.map((check) => ({
      id: check.id,
      date: check.date,
      routeName: check.routeName,
      accountName: check.accountName,
      productName: check.productName,
      status: check.status
    })));
  }
  if (url.pathname === "/api/market-checks/data") return wrap(await getMarketChecksData(url));
  if (url.pathname === "/api/actions") {
    const actions = await loadActions(url);
    return wrap(actions.map((action) => ({
      id: action.id,
      title: action.title,
      owner: action.owner,
      priority: action.priority,
      status: action.status,
      dueDate: action.dueDate
    })));
  }
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

  if (req.method !== "GET") {
    json(res, 405, {
      ok: false,
      service: SERVICE,
      error: "method_not_allowed",
      path: url.pathname
    });
    return;
  }

  handleGet(url)
    .then((payload) => json(res, 200, payload))
    .catch((error) => {
      json(res, error.statusCode || 500, {
        ok: false,
        service: SERVICE,
        error: error.message || "internal_error",
        table: error.table,
        path: url.pathname
      });
    });
});

server.listen(PORT, HOST, () => {
  console.log(`${SERVICE} listening on http://${HOST}:${PORT}`);
});
