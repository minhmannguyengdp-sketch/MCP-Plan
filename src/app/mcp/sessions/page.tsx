import { headers } from "next/headers";
import { AppShell } from "@/ui/shell/AppShell";
import { PageHeader } from "@/ui/layout/PageHeader";
import { McpSessionsManagerSafe } from "@/features/mcp/McpSessionsManagerSafe";
import { ExportMenu, buildExportLink } from "@/features/exports/ExportLinks";

type SessionRow = { id: string; routeId: string; routeName: string; sessionDate: string; status: string; note?: string; plannedCustomers: number; visitedCustomers: number };
type RouteOption = { id: string; name: string };
type SessionsPayload = { sessions: SessionRow[]; routes: RouteOption[]; kpis: { label: string; value: string | number; hint: string }[] };

const VN_TIME_ZONE = "Asia/Ho_Chi_Minh";

function vnDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: VN_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const year = parts.find((item) => item.type === "year")?.value || "";
  const month = parts.find((item) => item.type === "month")?.value || "";
  const day = parts.find((item) => item.type === "day")?.value || "";
  return `${year}-${month}-${day}`;
}

function today() { return vnDate(); }
function daysAgo(days: number) { return vnDate(-days); }
function getRequestBaseUrl() { const host = headers().get("host") || "localhost:3000"; const proto = process.env.VERCEL ? "https" : "http"; return `${proto}://${host}`; }

async function loadSessions(searchParams: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  params.set("dateFrom", String(searchParams.dateFrom || daysAgo(30)).slice(0, 10));
  params.set("dateTo", String(searchParams.dateTo || today()).slice(0, 10));
  if (searchParams.routeId) params.set("routeId", String(searchParams.routeId));
  if (searchParams.status) params.set("status", String(searchParams.status));
  const response = await fetch(`${getRequestBaseUrl()}/api/mcp-sessions?${params.toString()}`, { cache: "no-store" });
  if (!response.ok) return { sessions: [], routes: [], kpis: [] } satisfies SessionsPayload;
  const payload = await response.json() as { data?: SessionsPayload };
  return payload.data || { sessions: [], routes: [], kpis: [] };
}

export default async function McpSessionsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const data = await loadSessions(searchParams);
  const filters = { dateFrom: String(searchParams.dateFrom || daysAgo(30)).slice(0, 10), dateTo: String(searchParams.dateTo || today()).slice(0, 10), routeId: String(searchParams.routeId || ""), status: String(searchParams.status || "") };
  const query = new URLSearchParams();
  if (filters.routeId) query.set("routeId", filters.routeId);
  if (filters.status) query.set("visitStatus", filters.status);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return <AppShell activeHref="/mcp/sessions"><div className="mcp-sessions-page"><PageHeader eyebrow="MCP" title="Phiên chạy tuyến" subtitle="Lịch sử phiên theo ngày. Xuất file nằm trong menu, không rải nút trên hero."><ExportMenu label="Xuất danh sách" primary groups={[{ title: "Excel theo bộ lọc", links: [buildExportLink("Phiên/checklist", `/api/backend/exports/mcp-sessions.csv${suffix}`, "primary", "Theo tuyến/trạng thái đang lọc"), buildExportLink("Đơn hàng", "/api/backend/exports/orders.csv"), buildExportLink("BC thị trường", "/api/backend/exports/market-reports.csv"), buildExportLink("Follow-up", "/api/backend/exports/followups.csv")] }, { title: "PDF tổng hợp", links: [buildExportLink("Dashboard", "/api/backend/pdf/dashboard", "primary"), buildExportLink("BC thị trường", "/api/backend/pdf/market-report")] }]} /></PageHeader><McpSessionsManagerSafe data={data} filters={filters} /></div></AppShell>;
}
