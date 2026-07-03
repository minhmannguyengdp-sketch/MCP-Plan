import http from "node:http";

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3001);
const SERVICE = "mcp-plan-backend";

const routes = [
  { id: "route-cho-gao-center", name: "Tuyen Cho Gao trung tam", area: "Cho Gao", salesOwner: "Sale A", plannedCustomers: 18, visitedCustomers: 17, orderCount: 2, lastVisitDate: "2026-06-30", status: "active" },
  { id: "route-my-tho-east", name: "Tuyen My Tho phia Dong", area: "My Tho", salesOwner: "Sale B", plannedCustomers: 14, visitedCustomers: 11, orderCount: 0, lastVisitDate: "2026-06-30", status: "watch" },
  { id: "route-go-cong-river", name: "Tuyen Go Cong ven song", area: "Go Cong", salesOwner: "Sale C", plannedCustomers: 12, visitedCustomers: 7, orderCount: 0, lastVisitDate: "2026-06-29", status: "watch" },
  { id: "route-cai-be-new-agent", name: "Tuyen Cai Be dai ly moi", area: "Cai Be", salesOwner: "Sale A", plannedCustomers: 9, visitedCustomers: 9, orderCount: 1, lastVisitDate: "2026-06-30", status: "active" },
  { id: "route-maintenance", name: "Tuyen bao tri du lieu", area: "Tong hop", salesOwner: "Admin NPP", plannedCustomers: 0, visitedCustomers: 0, orderCount: 0, lastVisitDate: "-", status: "paused" }
];

const routeCustomers = [
  { id: "rc-001", routeId: "route-cho-gao-center", routeName: "Tuyen Cho Gao trung tam", accountId: "acc-cho-gao-001", accountName: "Tap hoa Minh Chau", contactName: "Chi Chau", area: "Cho Gao", sortOrder: 1, status: "active", gps: { lat: 10.35431, lng: 106.46412, accuracyMeters: 18, updatedAt: "2026-06-30" }, note: "Diem ban tier A, uu tien ghe dau tuyen." },
  { id: "rc-002", routeId: "route-cho-gao-center", routeName: "Tuyen Cho Gao trung tam", accountId: "acc-cho-gao-002", accountName: "Dai ly Thanh Phat", contactName: "Anh Phat", area: "Cho Gao", sortOrder: 2, status: "active", gps: { lat: 10.35911, lng: 106.47042, accuracyMeters: 22, updatedAt: "2026-06-30" }, note: "Co don thuong xuyen." },
  { id: "rc-003", routeId: "route-my-tho-east", routeName: "Tuyen My Tho phia Dong", accountId: "acc-my-tho-001", accountName: "Cua hang Huong Que", contactName: "Chi Huong", area: "My Tho", sortOrder: 3, status: "needs_gps", note: "Can cap nhat GPS khi ghe lai." },
  { id: "rc-004", routeId: "route-go-cong-river", routeName: "Tuyen Go Cong ven song", accountId: "acc-go-cong-001", accountName: "Tap hoa Ven Song", contactName: "Anh Nam", area: "Go Cong", sortOrder: 4, status: "active", gps: { lat: 10.36982, lng: 106.59877, accuracyMeters: 35, updatedAt: "2026-06-25" }, note: "Duong ven song, can mo Maps truoc khi di." },
  { id: "rc-005", routeId: "route-cai-be-new-agent", routeName: "Tuyen Cai Be dai ly moi", accountId: "acc-cai-be-001", accountName: "Dai ly Tan Loi", contactName: "Chi Loi", area: "Cai Be", sortOrder: 5, status: "active", gps: { lat: 10.33542, lng: 106.03252, accuracyMeters: 24, updatedAt: "2026-06-30" }, note: "Khach moi co tiem nang." },
  { id: "rc-006", routeId: "route-maintenance", routeName: "Tuyen bao tri du lieu", accountId: "acc-data-001", accountName: "Diem ban thieu thong tin", contactName: "Chua cap nhat", area: "Tong hop", sortOrder: 99, status: "hidden", note: "Tam an khoi tuyen ngay, khong hard delete." }
];

const orders = [
  { id: "order-001", code: "DH-0001", date: "2026-07-03", accountName: "Diem ban Minh Chau", routeName: "Tuyen Cho Gao", owner: "Sale A", source: "MCP session", skuCount: 4, quantity: 36, totalAmount: 2450000, status: "confirmed" },
  { id: "order-002", code: "DH-0002", date: "2026-07-03", accountName: "Diem ban Thanh Phat", routeName: "Tuyen Cho Gao", owner: "Sale A", source: "Visit result", skuCount: 3, quantity: 24, totalAmount: 1780000, status: "delivered" },
  { id: "order-003", code: "DH-0003", date: "2026-07-02", accountName: "Diem ban Tan Loi", routeName: "Tuyen Cai Be", owner: "Sale B", source: "Phone", skuCount: 5, quantity: 42, totalAmount: 3150000, status: "confirmed" }
];

const marketChecks = [
  { id: "check-001", date: "2026-07-03", routeName: "Tuyen Cho Gao", accountName: "Diem ban Minh Chau", productName: "Sua hop 180ml", competitorName: "Doi thu A", shelfPrice: 8200, stockStatus: "Con hang", note: "Gia on dinh, co the tang trung bay", status: "opportunity" },
  { id: "check-002", date: "2026-07-03", routeName: "Tuyen Cho Gao", accountName: "Diem ban Thanh Phat", productName: "Nuoc giai khat chai", competitorName: "Doi thu B", shelfPrice: 10500, stockStatus: "Sap het", note: "Can bo sung hang truoc cuoi tuan", status: "risk" },
  { id: "check-003", date: "2026-07-03", routeName: "Tuyen My Tho", accountName: "Diem ban Huong Que", productName: "Banh goi nho", competitorName: "Khong ro", shelfPrice: 15000, stockStatus: "Con hang", note: "Ban cham, can theo doi them", status: "normal" },
  { id: "check-004", date: "2026-07-02", routeName: "Tuyen Go Cong", accountName: "Diem ban Ven Song", productName: "Sua chua uong", competitorName: "Doi thu C", shelfPrice: 7200, stockStatus: "Het hang", note: "Mat vi tri ke hang vao doi thu", status: "risk" },
  { id: "check-005", date: "2026-07-02", routeName: "Tuyen Cai Be", accountName: "Diem ban Tan Loi", productName: "Tra dong chai", competitorName: "Doi thu A", shelfPrice: 9000, stockStatus: "Con hang", note: "Co co hoi khuyen mai combo", status: "opportunity" }
];

const actions = [
  { id: "act-001", title: "Ghe lai diem ban dong cua", accountName: "Diem ban Ven Song", routeName: "Tuyen Go Cong", owner: "Sale C", source: "session", priority: "high", status: "todo", dueDate: "2026-07-04", note: "Bo qua trong phien gan nhat" },
  { id: "act-002", title: "Bo sung hang sap het", accountName: "Diem ban Thanh Phat", routeName: "Tuyen Cho Gao", owner: "Sale A", source: "field_check", priority: "high", status: "doing", dueDate: "2026-07-04", note: "Ton kho thap" },
  { id: "act-003", title: "Theo don cho giao", accountName: "Diem ban Minh Chau", routeName: "Tuyen Cho Gao", owner: "Kho", source: "order", priority: "medium", status: "doing", dueDate: "2026-07-05", note: "Don da chot" },
  { id: "act-004", title: "De xuat them diem phat sinh vao tuyen", accountName: "Diem ban Phat Sinh", routeName: "Tuyen Cho Gao", owner: "Admin", source: "session", priority: "medium", status: "todo", dueDate: "2026-07-06", note: "Can duyet vao tuyen goc" },
  { id: "act-005", title: "Kiem tra gia doi thu", accountName: "Diem ban Tan Loi", routeName: "Tuyen Cai Be", owner: "Sale B", source: "field_check", priority: "low", status: "blocked", dueDate: "2026-07-05", note: "Thieu anh ke hang" }
];

const mcpDay = {
  run: { id: "day-001", routeName: "Tuyen Cho Gao", date: "2026-07-03", owner: "Sale A", status: "opened", openedAt: "08:00" },
  lines: [
    { id: "line-001", sortOrder: 1, accountName: "Diem ban Minh Chau", area: "Cho Gao", source: "planned", status: "visited", note: "Tu tuyen goc", result: "Co nhu cau", hasOrder: true },
    { id: "line-002", sortOrder: 2, accountName: "Diem ban Thanh Phat", area: "Cho Gao", source: "planned", status: "visited", note: "Tu tuyen goc", result: "Co don", hasOrder: true },
    { id: "line-003", sortOrder: 3, accountName: "Diem ban Huong Que", area: "Cho Gao", source: "planned", status: "pending", note: "Con trong lich", hasOrder: false },
    { id: "line-004", sortOrder: 4, accountName: "Diem ban Ven Song", area: "Cho Gao", source: "planned", status: "skipped", note: "Bo qua co ly do", result: "Dong cua", hasOrder: false },
    { id: "line-005", sortOrder: 5, accountName: "Diem ban Tan Loi", area: "Cho Gao", source: "synced", status: "pending", note: "Dong bo them", hasOrder: false },
    { id: "line-006", sortOrder: 6, accountName: "Diem ban Phat Sinh", area: "Cho Gao", source: "added", status: "pending", note: "Them trong ngay", hasOrder: false }
  ],
  results: [
    { id: "result-001", lineId: "line-001", accountName: "Diem ban Minh Chau", startTime: "08:15", endTime: "08:33", result: "Co nhu cau", hasOrder: true, nextAction: "Theo don" },
    { id: "result-002", lineId: "line-002", accountName: "Diem ban Thanh Phat", startTime: "09:05", endTime: "09:27", result: "Co don", hasOrder: true, nextAction: "Giao hang" }
  ]
};

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

function healthPayload() {
  return {
    ok: true,
    project: "MCP-Plan",
    service: SERVICE,
    server: "backend-DO-02",
    time: new Date().toISOString(),
    message: "MCP-Plan backend VPS is ready"
  };
}

function getDashboardSummary() {
  return {
    routeCount: 8,
    accountCount: 51,
    visitCount: 73,
    orderAmount: 403000,
    actionCount: 9
  };
}

function getDashboardOverview() {
  return {
    kpis: [
      { label: "Doanh so hom nay", value: "403K", hint: "Backend API", trend: "+12%" },
      { label: "Tuyen active", value: 8, hint: "Dang mo", trend: "On dinh" },
      { label: "Diem ban", value: 51, hint: "Trong tuyen", trend: "+4 can cham soc" },
      { label: "Luot ghe", value: 73, hint: "Da ghi nhan", trend: "72 hoan thanh" }
    ],
    routeHealth: [
      { routeName: "Tuyen trung tam", area: "Cho Gao", planned: 18, visited: 17, orders: 2, status: "good" },
      { routeName: "Tuyen phia Dong", area: "My Tho", planned: 14, visited: 11, orders: 0, status: "watch" },
      { routeName: "Tuyen ven song", area: "Go Cong", planned: 12, visited: 7, orders: 0, status: "risk" }
    ],
    actions: [
      { title: "Ghe lai nhom khach chua co don", description: "Uu tien diem ban da ghe nhung chua co order.", priority: "high", owner: "Sale" },
      { title: "Kiem tra tuyen ven song", description: "Ty le ghe thap hon ke hoach.", priority: "medium", owner: "Giam sat" }
    ],
    insights: [
      { label: "Ty le ghe tham", value: "88%" },
      { label: "Ty le co don", value: "2.7%" },
      { label: "SKU dang test", value: "33" },
      { label: "Nguon", value: "Backend API" }
    ]
  };
}

function getRoutesList() {
  return routes.map((route) => ({
    id: route.id,
    name: route.name,
    area: route.area,
    owner: route.salesOwner,
    active: route.status !== "paused"
  }));
}

function getRoutesData() {
  const totalCustomers = routes.reduce((sum, route) => sum + route.plannedCustomers, 0);
  const totalVisited = routes.reduce((sum, route) => sum + route.visitedCustomers, 0);
  const watchRoutes = routes.filter((route) => route.status === "watch").length;

  return {
    kpis: [
      { label: "Tuyen active", value: routes.filter((route) => route.status === "active").length, hint: "Backend API" },
      { label: "Tong diem ban", value: totalCustomers, hint: "Route master" },
      { label: "Da ghe", value: `${totalVisited}/${totalCustomers}`, hint: "Theo visit hien co" },
      { label: "Tuyen can theo doi", value: watchRoutes, hint: "Can xem lai lich ghe" }
    ],
    routes
  };
}

function getRouteCustomersData(url) {
  const routeId = url.searchParams.get("routeId");
  const customers = routeId ? routeCustomers.filter((customer) => customer.routeId === routeId) : routeCustomers;
  const withGps = customers.filter((customer) => Boolean(customer.gps)).length;
  const needsGps = customers.filter((customer) => customer.status === "needs_gps").length;
  const hidden = customers.filter((customer) => customer.status === "hidden").length;

  return {
    kpis: [
      { label: "Khach trong tuyen", value: customers.length, hint: routeId || "Tat ca tuyen" },
      { label: "Da co GPS", value: withGps, hint: "Mo duoc ban do" },
      { label: "Can GPS", value: needsGps, hint: "Can sale cap nhat" },
      { label: "Dang an", value: hidden, hint: "Khong hard delete" }
    ],
    customers
  };
}

function getCurrentMcpDayRun() {
  return {
    id: mcpDay.run.id,
    routeName: mcpDay.run.routeName,
    date: mcpDay.run.date,
    owner: mcpDay.run.owner,
    status: mcpDay.run.status
  };
}

function getMcpDayData() {
  const visited = mcpDay.lines.filter((line) => line.status === "visited").length;
  const pending = mcpDay.lines.filter((line) => line.status === "pending").length;
  const added = mcpDay.lines.filter((line) => line.source === "added").length;

  return {
    run: mcpDay.run,
    kpis: [
      { label: "Trong phien", value: mcpDay.lines.length, hint: "Snapshot ngay" },
      { label: "Da ghe", value: visited, hint: "Co ket qua" },
      { label: "Cho xu ly", value: pending, hint: "Chua ghe" },
      { label: "Phat sinh", value: added, hint: "Them trong ngay" }
    ],
    lines: mcpDay.lines,
    results: mcpDay.results
  };
}

function getOrders(url) {
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search")?.trim().toLowerCase();

  return orders.filter((order) => {
    if (status && order.status !== status) return false;
    if (search) {
      const haystack = `${order.code} ${order.accountName} ${order.routeName} ${order.owner} ${order.source}`.toLowerCase();
      return haystack.includes(search);
    }
    return true;
  });
}

function getMarketChecks(url) {
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search")?.trim().toLowerCase();

  return marketChecks.filter((check) => {
    if (status && check.status !== status) return false;
    if (search) {
      const haystack = `${check.accountName} ${check.routeName} ${check.productName} ${check.competitorName} ${check.note}`.toLowerCase();
      return haystack.includes(search);
    }
    return true;
  });
}

function getMarketChecksList(url) {
  return getMarketChecks(url).map((check) => ({
    id: check.id,
    date: check.date,
    routeName: check.routeName,
    accountName: check.accountName,
    productName: check.productName,
    status: check.status
  }));
}

function getMarketChecksData(url) {
  const checks = getMarketChecks(url);
  const opportunities = checks.filter((check) => check.status === "opportunity").length;
  const risks = checks.filter((check) => check.status === "risk").length;
  const skuCount = new Set(checks.map((check) => check.productName)).size;

  return {
    kpis: [
      { label: "Diem da kiem", value: checks.length, hint: "Backend API" },
      { label: "Co hoi", value: opportunities, hint: "Gia / trung bay tot" },
      { label: "Rui ro", value: risks, hint: "Doi thu / het hang" },
      { label: "SKU", value: skuCount, hint: "San pham ghi nhan" }
    ],
    checks
  };
}

function getActions(url) {
  const status = url.searchParams.get("status");
  const priority = url.searchParams.get("priority");
  const search = url.searchParams.get("search")?.trim().toLowerCase();

  return actions.filter((action) => {
    if (status && action.status !== status) return false;
    if (priority && action.priority !== priority) return false;
    if (search) {
      const haystack = `${action.title} ${action.accountName} ${action.routeName} ${action.owner} ${action.source} ${action.note}`.toLowerCase();
      return haystack.includes(search);
    }
    return true;
  });
}

function getActionsList(url) {
  return getActions(url).map((action) => ({
    id: action.id,
    title: action.title,
    owner: action.owner,
    priority: action.priority,
    status: action.status,
    dueDate: action.dueDate
  }));
}

function getActionsData(url) {
  const items = getActions(url);
  const openItems = items.filter((item) => item.status !== "done").length;
  const highPriority = items.filter((item) => item.priority === "high").length;
  const doingItems = items.filter((item) => item.status === "doing").length;
  const blockedItems = items.filter((item) => item.status === "blocked").length;

  return {
    kpis: [
      { label: "Viec mo", value: openItems, hint: "Can xu ly" },
      { label: "Uu tien cao", value: highPriority, hint: "Lam truoc" },
      { label: "Dang lam", value: doingItems, hint: "Co owner" },
      { label: "Bi chan", value: blockedItems, hint: "Can go vuong" }
    ],
    items
  };
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

  if (url.pathname === "/" || url.pathname === "/health" || url.pathname === "/api/health") {
    json(res, 200, healthPayload());
    return;
  }

  if (url.pathname === "/api/dashboard/summary") {
    json(res, 200, wrap(getDashboardSummary()));
    return;
  }

  if (url.pathname === "/api/dashboard/overview") {
    json(res, 200, wrap(getDashboardOverview()));
    return;
  }

  if (url.pathname === "/api/routes") {
    json(res, 200, wrap(getRoutesList()));
    return;
  }

  if (url.pathname === "/api/routes/data") {
    json(res, 200, wrap(getRoutesData()));
    return;
  }

  if (url.pathname === "/api/routes/customers/data") {
    json(res, 200, wrap(getRouteCustomersData(url)));
    return;
  }

  if (url.pathname === "/api/mcp-day/current") {
    json(res, 200, wrap(getCurrentMcpDayRun()));
    return;
  }

  if (url.pathname === "/api/mcp-day/data") {
    json(res, 200, wrap(getMcpDayData()));
    return;
  }

  if (url.pathname === "/api/orders") {
    json(res, 200, wrap(getOrders(url)));
    return;
  }

  if (url.pathname === "/api/tests") {
    json(res, 200, wrap(getMarketChecksData(url)));
    return;
  }

  if (url.pathname === "/api/market-checks") {
    json(res, 200, wrap(getMarketChecksList(url)));
    return;
  }

  if (url.pathname === "/api/market-checks/data") {
    json(res, 200, wrap(getMarketChecksData(url)));
    return;
  }

  if (url.pathname === "/api/actions") {
    json(res, 200, wrap(getActionsList(url)));
    return;
  }

  if (url.pathname === "/api/actions/data") {
    json(res, 200, wrap(getActionsData(url)));
    return;
  }

  json(res, 404, {
    ok: false,
    service: SERVICE,
    error: "not_found",
    path: url.pathname
  });
});

server.listen(PORT, HOST, () => {
  console.log(`${SERVICE} listening on http://${HOST}:${PORT}`);
});
