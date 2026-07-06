import { errorResponse, restRows } from "@/lib/export/supabase-rest";
import { dateText, esc, htmlResponse, kv, table } from "@/lib/export/print";

type Row = Record<string, string | number | boolean | null>;

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const sessionFilters: Record<string, string | null> = { id: params.get("sessionId"), route_id: params.get("routeId"), session_date: params.get("date") };
    const sessions = await restRows<Row>("mcp_route_sessions", { select: "*", order: "session_date.desc,created_at.desc", limit: 1, filters: sessionFilters });
    const session = sessions[0];
    if (!session) return htmlResponse("Báo cáo phiên MCP", `<h1>Không tìm thấy phiên</h1><p class="muted">Cần truyền sessionId hoặc routeId/date.</p>`);
    const lines = await restRows<Row>("mcp_session_customers", { select: "*", order: "sort_order.asc,customer_name.asc", limit: 5000, filters: { session_id: String(session.id || "") } });
    const planned = lines.length;
    const visited = lines.filter((r) => r.visit_status === "visited").length;
    const skipped = lines.filter((r) => r.visit_status === "skipped").length;
    const orders = lines.filter((r) => r.order_id).length;
    const tests = lines.filter((r) => r.test_id).length;
    const reports = lines.filter((r) => r.report_id).length;
    const body = `<div class="head"><div><div class="brand">MCP-Plan</div><h1>Báo cáo ngày của phiên MCP</h1><p class="muted">${esc(session.route_name)} · ${dateText(session.session_date)}</p></div><div>${kv([["Sale", session.sales], ["Khu vực", session.area], ["Trạng thái", session.status]])}</div></div>
    <div class="metrics"><div class="metric"><span>Tất cả khách</span><b>${planned}</b></div><div class="metric"><span>Đã ghé</span><b>${visited}</b></div><div class="metric"><span>Bỏ qua</span><b>${skipped}</b></div><div class="metric"><span>Có đơn</span><b>${orders}</b></div></div>
    <div class="metrics"><div class="metric"><span>Có test</span><b>${tests}</b></div><div class="metric"><span>Có BC</span><b>${reports}</b></div><div class="metric"><span>Follow-up</span><b>${Number(session.followup_count || 0)}</b></div><div class="metric"><span>Tỷ lệ ghé</span><b>${planned ? Math.round((visited / planned) * 100) : 0}%</b></div></div>
    <h2>Checklist khách trong phiên</h2>${table<Row>([
      { header: "#", value: (_r, i) => i + 1, className: "center" },
      { header: "Khách", value: (r) => r.customer_name },
      { header: "SĐT", value: (r) => r.phone },
      { header: "Khu vực", value: (r) => r.area },
      { header: "Trạng thái", value: (r) => r.visit_status },
      { header: "Lý do", value: (r) => r.status_reason },
      { header: "Đơn", value: (r) => r.order_id ? "Có" : "" },
      { header: "Test", value: (r) => r.test_id ? "Có" : "" },
      { header: "BC", value: (r) => r.report_id ? "Có" : "" },
      { header: "Follow-up", value: (r) => r.followup_count },
      { header: "Ghi chú", value: (r) => r.note }
    ], lines)}`;
    return htmlResponse(`Báo cáo phiên ${String(session.route_name || "")}`, body);
  } catch (error) {
    return errorResponse(error);
  }
}
