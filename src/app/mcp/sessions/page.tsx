import Link from "next/link";
import { AppShell } from "@/ui/shell/AppShell";
import { PageHeader } from "@/ui/layout/PageHeader";

type SessionRow = {
  id: string;
  routeId: string;
  routeName: string;
  sessionDate: string;
  status: string;
  plannedCustomers: number;
  visitedCustomers: number;
};

type RouteOption = { id: string; name: string };

type SessionsPayload = {
  sessions: SessionRow[];
  routes: RouteOption[];
  kpis: { label: string; value: string | number; hint: string }[];
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

async function loadSessions(searchParams: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  params.set("dateFrom", String(searchParams.dateFrom || daysAgo(30)).slice(0, 10));
  params.set("dateTo", String(searchParams.dateTo || today()).slice(0, 10));
  if (searchParams.routeId) params.set("routeId", String(searchParams.routeId));
  if (searchParams.status) params.set("status", String(searchParams.status));

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
  const response = await fetch(`${baseUrl}/api/mcp-sessions?${params.toString()}`, { cache: "no-store" });
  if (!response.ok) return { sessions: [], routes: [], kpis: [] } satisfies SessionsPayload;
  const payload = await response.json() as { data?: SessionsPayload };
  return payload.data || { sessions: [], routes: [], kpis: [] };
}

export default async function McpSessionsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const data = await loadSessions(searchParams);
  const dateFrom = String(searchParams.dateFrom || daysAgo(30)).slice(0, 10);
  const dateTo = String(searchParams.dateTo || today()).slice(0, 10);
  const routeId = String(searchParams.routeId || "");
  const status = String(searchParams.status || "");

  return (
    <AppShell activeHref="/mcp/sessions">
      <PageHeader eyebrow="MCP" title="Phiên chạy tuyến" subtitle="Lịch sử phiên theo ngày. Click một phiên để mở checklist khách trong phiên đó." />

      <form className="filter-bar" action="/mcp/sessions">
        <label className="form-field"><small>Từ ngày</small><input name="dateFrom" type="date" defaultValue={dateFrom} /></label>
        <label className="form-field"><small>Đến ngày</small><input name="dateTo" type="date" defaultValue={dateTo} /></label>
        <label className="form-field"><small>Tuyến</small><select name="routeId" defaultValue={routeId}><option value="">Tất cả tuyến</option>{data.routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}</select></label>
        <label className="form-field"><small>Trạng thái</small><select name="status" defaultValue={status}><option value="">Tất cả</option><option value="active">Đang chạy</option><option value="done">Đã chốt</option><option value="cancelled">Đã hủy</option></select></label>
        <button className="button primary" type="submit">Lọc phiên</button>
      </form>

      <div className="grid cards">
        {data.kpis.map((item) => <article className="card" key={item.label}><div className="card-label">{item.label}</div><div className="card-value">{item.value}</div><p className="card-hint">{item.hint}</p></article>)}
      </div>

      <section className="grid">
        {data.sessions.length === 0 ? <div className="empty-inline">Chưa có phiên trong bộ lọc.</div> : data.sessions.map((session) => (
          <article className="action-card" key={session.id}>
            <div>
              <span className="badge">{session.status}</span>
              <h3>{session.routeName}</h3>
              <p>{session.sessionDate} · {session.visitedCustomers}/{session.plannedCustomers} khách đã ghé</p>
            </div>
            <Link href={`/visits?routeId=${encodeURIComponent(session.routeId)}&date=${encodeURIComponent(session.sessionDate)}`} prefetch>Mở checklist</Link>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
