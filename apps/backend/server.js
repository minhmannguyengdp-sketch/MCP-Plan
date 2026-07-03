import http from "node:http";

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3001);
const SERVICE = "mcp-plan-backend";

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
