import { headers } from "next/headers";
import { AppShell } from "@/ui/shell/AppShell";
import { PageHeader } from "@/ui/layout/PageHeader";
import { McpSessionsManagerSafe } from "@/features/mcp/McpSessionsManagerSafe";
import { ExportLinksPanel, buildExportLink } from "@/features/exports/ExportLinks";

type SessionRow = { id: string; routeId: string; routeName: string; sessionDate: string; status: string; note?: string; plannedCustomers: number; visitedCustomers: number };
type RouteOption = { id: string; name: string };
type SessionsPayload = { sessions: SessionRow[]; routes: RouteOption[]; kpis: { label: string; value: string | number; hint: string }[] };

function today() { return new Date().toISOString().slice(0, 10); }
function daysAgo(days: number) { const date = new Date(); date.setDate(date.getDate() - days); return date.toISOString().slice(0, 10); }
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
  return <AppShell activeHref="/mcp/sessions"><div className="mcp-sessions-page"><PageHeader eyebrow="MCP" title="Phiên chạy tuyến" subtitle="Lịch sử phiên theo ngày. Tạm khóa thao tác phụ trong lúc chuẩn hóa form và dữ liệu report." /><ExportLinksPanel title="Xuất phiên MCP" subtitle="Tải checklist phiên hoặc mở PDF dashboard." excelLinks={[buildExportLink("Excel phiên/checklist", `/api/backend/exports/mcp-sessions.csv${query.toString() ? `?${query.toString()}` : ""}`, "primary"), buildExportLink("Excel đơn hàng", "/api/backend/exports/orders.csv"), buildExportLink("Excel BC thị trường", "/api/backend/exports/market-reports.csv"), buildExportLink("Excel follow-up", "/api/backend/exports/followups.csv")]} pdfLinks={[buildExportLink("PDF dashboard", "/api/backend/pdf/dashboard", "primary"), buildExportLink("PDF BC thị trường", "/api/backend/pdf/market-report")]} /><McpSessionsManagerSafe data={data} filters={filters} /></div></AppShell>;
}
