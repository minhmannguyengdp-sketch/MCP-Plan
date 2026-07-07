import { errorResponse, restRows } from "@/lib/export/supabase-rest";
import { dateText, esc, htmlResponse, kv, table } from "@/lib/export/print";

type Row = Record<string, string | number | boolean | null>;
type McpLine = { sortOrder?: number; accountName?: string; phone?: string; area?: string; status?: string; note?: string; hasOrder?: boolean; hasTest?: boolean; hasReport?: boolean; followupCount?: number };
type McpDayPayload = { data?: { run?: Record<string, string>; lines?: McpLine[] } };

export const dynamic = "force-dynamic";

function backendBaseUrl(origin: string) {
  const value = String(process.env.BACKEND_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "").trim().replace(/\/+$/, "");
  return value || origin;
}

async function findSession(params: URLSearchParams) {
  const filters: Record<string, string | null> = { id: params.get("sessionId"), route_id: params.get("routeId"), session_date: params.get("date") };
  const sessions = await restRows<Row>("mcp_route_sessions", { select: "*", order: "session_date.desc,created_at.desc", limit: 1, filters });
  return sessions[0] || null;
}

async function fetchChecklist(origin: string, routeId: string, date: string) {
  const url = `${backendBaseUrl(origin)}/api/mcp-day/data?routeId=${encodeURIComponent(routeId)}&date=${encodeURIComponent(date)}`;
  const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({})) as McpDayPayload;
  if (!response.ok) throw new Error((payload as { error?: string }).error || `mcp_day_data_${response.status}`);
  return payload.data;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const params = url.searchParams;
    const session = await findSession(params);
    if (!session) return htmlResponse("Báo cáo phiên MCP", `<h1>Không tìm thấy phiên</h1><p class="muted">Cần truyền sessionId hoặc routeId/date.</p>`);

    const routeId = String(session.route_id || params.get("routeId") || "");
    const sessionDate = String(session.session_date || params.get("date") || "").slice(0, 10);
    const checklist = routeId && sessionDate ? await fetchChecklist(url.origin, routeId, sessionDate) : null;
    const lines = checklist?.lines || [];
    const run = checklist?.run || {};

    const planned = lines.length;
    const visited = lines.filter((r) => r.status === "visited").length;
    const skipped = lines.filter((r) => r.status === "skipped").length;
    const orders = lines.filter((r) => r.hasOrder).length;
    const tests = lines.filter((r) => r.hasTest).length;
    const reports = lines.filter((r) => r.hasReport).length;
    const followups = lines.reduce((sum, r) => sum + Number(r.followupCount || 0), 0);

    const body = `<div class="head"><div><div class="brand">MCP-Plan</div><h1>Báo cáo ngày của phiên MCP</h1><p class="muted">${esc(run.routeName || session.route_name)} · ${dateText(run.date || session.session_date)}</p></div><div>${kv([["Sale", run.owner || session.sales], ["Khu vực", session.area], ["Trạng thái", run.status || session.status]])}</div></div>
    <div class="metrics"><div class="metric"><span>Tất cả khách</span><b>${planned}</b></div><div class="metric"><span>Đã ghé</span><b>${visited}</b></div><div class="metric"><span>Bỏ qua</span><b>${skipped}</b></div><div class="metric"><span>Có đơn</span><b>${orders}</b></div></div>
    <div class="metrics"><div class="metric"><span>Có test</span><b>${tests}</b></div><div class="metric"><span>Có BC</span><b>${reports}</b></div><div class="metric"><span>Follow-up</span><b>${followups}</b></div><div class="metric"><span>Tỷ lệ ghé</span><b>${planned ? Math.round((visited / planned) * 100) : 0}%</b></div></div>
    <h2>Checklist khách trong phiên</h2>${table<McpLine>([
      { header: "#", value: (r, i) => r.sortOrder || i + 1, className: "center" },
      { header: "Khách", value: (r) => r.accountName },
      { header: "SĐT", value: (r) => r.phone },
      { header: "Khu vực", value: (r) => r.area },
      { header: "Trạng thái", value: (r) => r.status },
      { header: "Đơn", value: (r) => r.hasOrder ? "Có" : "" },
      { header: "Test", value: (r) => r.hasTest ? "Có" : "" },
      { header: "BC", value: (r) => r.hasReport ? "Có" : "" },
      { header: "Follow-up", value: (r) => r.followupCount || 0 },
      { header: "Ghi chú", value: (r) => r.note }
    ], lines)}`;
    return htmlResponse(`Báo cáo phiên ${String(run.routeName || session.route_name || "")}`, body);
  } catch (error) {
    return errorResponse(error);
  }
}
