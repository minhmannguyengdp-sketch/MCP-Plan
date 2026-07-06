import { csvResponse, yyyyMMdd } from "@/lib/export/csv";
import { errorResponse, restRows } from "@/lib/export/supabase-rest";

type Row = Record<string, string | number | boolean | null>;

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const rows = await restRows<Row>("mcp_session_customers", {
      select: "session_id,route_id,route_customer_id,customer_id,customer_name,phone,area,address,sort_order,source,planned_status,visit_status,status_reason,visit_id,order_id,test_id,report_id,followup_count,note,created_at,updated_at",
      order: "session_id.asc,sort_order.asc,customer_name.asc",
      limit: Number(params.get("limit") || 8000),
      filters: { session_id: params.get("sessionId"), route_id: params.get("routeId"), visit_status: params.get("visitStatus") }
    });
    return csvResponse(`mcp-session-checklist-${yyyyMMdd()}.csv`, [
      { key: "session_id", header: "Session ID" },
      { key: "route_id", header: "Route ID" },
      { key: "route_customer_id", header: "Route Customer ID" },
      { key: "customer_id", header: "Customer ID" },
      { key: "customer_name", header: "Tên khách" },
      { key: "phone", header: "SĐT" },
      { key: "area", header: "Khu vực" },
      { key: "address", header: "Địa chỉ" },
      { key: "sort_order", header: "Thứ tự" },
      { key: "source", header: "Nguồn" },
      { key: "planned_status", header: "Kế hoạch" },
      { key: "visit_status", header: "Trạng thái ghé" },
      { key: "status_reason", header: "Lý do" },
      { key: "visit_id", header: "Visit ID" },
      { key: "order_id", header: "Order ID" },
      { key: "test_id", header: "Test ID" },
      { key: "report_id", header: "Report ID" },
      { key: "followup_count", header: "Số follow-up" },
      { key: "note", header: "Ghi chú" },
      { key: "created_at", header: "Tạo lúc" },
      { key: "updated_at", header: "Cập nhật lúc" }
    ], rows);
  } catch (error) {
    return errorResponse(error);
  }
}
