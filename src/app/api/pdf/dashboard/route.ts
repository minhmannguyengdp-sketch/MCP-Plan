import { errorResponse, restRows } from "@/lib/export/supabase-rest";
import { dateText, htmlResponse, money, table } from "@/lib/export/print";

type Row = Record<string, string | number | boolean | null>;

export const dynamic = "force-dynamic";

function sum(rows: Row[], key: string) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const date = params.get("date");
    const sessions = await restRows<Row>("mcp_route_sessions", { select: "*", order: "session_date.desc,created_at.desc", limit: 100, filters: { session_date: date } });
    const orders = await restRows<Row>("orders", { select: "*", order: "order_date.desc,created_at.desc", limit: 300, filters: { order_date: date } });
    const reports = await restRows<Row>("market_reports", { select: "*", order: "report_date.desc,created_at.desc", limit: 300, filters: { report_date: date } });
    const followups = await restRows<Row>("mcp_followups", { select: "*", order: "due_date.asc,created_at.desc", limit: 300, filters: { due_date: date } });
    const body = `<div class="head"><div><div class="brand">MCP-Plan</div><h1>Dashboard quản trị</h1><p class="muted">${date || "Dữ liệu gần nhất"}</p></div></div>
    <div class="metrics"><div class="metric"><span>Phiên MCP</span><b>${sessions.length}</b></div><div class="metric"><span>Khách kế hoạch</span><b>${sum(sessions, "planned_customers")}</b></div><div class="metric"><span>Đã ghé</span><b>${sum(sessions, "visited_customers")}</b></div><div class="metric"><span>Đơn hàng</span><b>${orders.length}</b></div></div>
    <div class="metrics"><div class="metric"><span>Doanh số</span><b>${money(sum(orders, "grand_total"))}</b></div><div class="metric"><span>Báo cáo TT</span><b>${reports.length}</b></div><div class="metric"><span>Follow-up</span><b>${followups.length}</b></div><div class="metric"><span>Test</span><b>${sum(sessions, "test_count")}</b></div></div>
    <h2>Phiên MCP</h2>${table<Row>([
      { header: "Ngày", value: (r) => dateText(r.session_date) },
      { header: "Tuyến", value: (r) => r.route_name },
      { header: "Sale", value: (r) => r.sales },
      { header: "KH", value: (r) => r.planned_customers, className: "right" },
      { header: "Ghé", value: (r) => r.visited_customers, className: "right" },
      { header: "Đơn", value: (r) => r.order_count, className: "right" },
      { header: "Test", value: (r) => r.test_count, className: "right" },
      { header: "BC", value: (r) => r.report_count, className: "right" },
      { header: "Trạng thái", value: (r) => r.status }
    ], sessions)}
    <h2>Đơn hàng mới</h2>${table<Row>([
      { header: "Ngày", value: (r) => dateText(r.order_date) },
      { header: "Mã", value: (r) => r.order_code },
      { header: "Khách", value: (r) => r.customer_name },
      { header: "Sale", value: (r) => r.sales },
      { header: "Tổng", value: (r) => money(r.grand_total), className: "right" },
      { header: "Trạng thái", value: (r) => r.status }
    ], orders.slice(0, 30))}
    <h2>Follow-up</h2>${table<Row>([
      { header: "Hẹn", value: (r) => dateText(r.due_date) },
      { header: "Khách", value: (r) => r.customer_name },
      { header: "Việc", value: (r) => r.title },
      { header: "Owner", value: (r) => r.owner },
      { header: "Trạng thái", value: (r) => r.status }
    ], followups.slice(0, 30))}`;
    return htmlResponse("Dashboard quản trị", body);
  } catch (error) {
    return errorResponse(error);
  }
}
