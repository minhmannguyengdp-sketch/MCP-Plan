export const dynamic = "force-dynamic";

type RouteOption = {
  id: string;
  name: string;
};

type SessionRow = {
  id: string;
  routeId: string;
  routeName: string;
  sessionDate: string;
  status: string;
  note?: string;
  plannedCustomers: number;
  visitedCustomers: number;
};

type Wrapped<T> = {
  data?: T;
};

function cleanDate(value: string | null) {
  const text = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function num(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function getBackend<T>(request: Request, path: string, query?: Record<string, string>) {
  const url = new URL(`/api/backend${path}`, request.url);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
  const payload = (await response.json().catch(() => ({}))) as Wrapped<T> | T;
  if (!response.ok) throw new Error(`api_${response.status}`);
  if (payload && typeof payload === "object" && "data" in payload) return (payload as Wrapped<T>).data as T;
  return payload as T;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const dateFrom = cleanDate(url.searchParams.get("dateFrom"));
  const dateTo = cleanDate(url.searchParams.get("dateTo"));
  const routeId = String(url.searchParams.get("routeId") || "").trim();
  const status = String(url.searchParams.get("status") || "").trim();

  const routesData = await getBackend<{ routes?: RouteOption[] }>(request, "/routes/data");
  const routes = Array.isArray(routesData.routes) ? routesData.routes : [];
  const routeIds = routeId ? [routeId] : routes.map((route) => route.id).filter(Boolean);

  const loaded = await Promise.allSettled(routeIds.map(async (id) => {
    const data = await getBackend<{ sessions?: SessionRow[] }>(request, "/mcp-settings/session-status", { routeId: id });
    return Array.isArray(data.sessions) ? data.sessions : [];
  }));

  const sessions = loaded
    .flatMap((item) => item.status === "fulfilled" ? item.value : [])
    .map((session) => ({
      id: session.id,
      routeId: session.routeId,
      routeName: session.routeName || routes.find((route) => route.id === session.routeId)?.name || session.routeId,
      sessionDate: cleanDate(session.sessionDate),
      status: session.status || "active",
      note: session.note || "",
      plannedCustomers: num(session.plannedCustomers),
      visitedCustomers: num(session.visitedCustomers)
    }))
    .filter((session) => !dateFrom || session.sessionDate >= dateFrom)
    .filter((session) => !dateTo || session.sessionDate <= dateTo)
    .filter((session) => !status || session.status === status)
    .sort((a, b) => `${b.sessionDate}-${b.routeName}`.localeCompare(`${a.sessionDate}-${a.routeName}`));

  const active = sessions.filter((session) => session.status === "active").length;
  const done = sessions.filter((session) => session.status === "done").length;
  const cancelled = sessions.filter((session) => session.status === "cancelled").length;
  const planned = sessions.reduce((sum, session) => sum + session.plannedCustomers, 0);
  const visited = sessions.reduce((sum, session) => sum + session.visitedCustomers, 0);

  return Response.json({
    data: {
      sessions,
      routes,
      filters: { dateFrom, dateTo, routeId, status },
      kpis: [
        { label: "Phiên", value: sessions.length, hint: "Theo bộ lọc" },
        { label: "Đang chạy", value: active, hint: "active" },
        { label: "Đã chốt", value: done, hint: "done" },
        { label: "Đã ghé", value: `${visited}/${planned}`, hint: "checklist phiên" },
        { label: "Đã hủy", value: cancelled, hint: "cancelled" }
      ]
    },
    receivedAt: new Date().toISOString()
  });
}
