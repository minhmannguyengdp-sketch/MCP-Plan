import { csvResponse, yyyyMMdd } from "@/lib/export/csv";
import { errorResponse, restRows } from "@/lib/export/supabase-rest";

type Row = Record<string, string | number | boolean | null>;

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const rows = await restRows<Row>("mcp_followups", {
      select: "id,session_id,session_customer_id,visit_id,route_id,route_customer_id,customer_id,customer_name,followup_type,title,due_date,status,priority,owner,note,created_at,updated_at",
      order: "due_date.asc,created_at.desc",
      limit: Number(params.get("limit") || 5000),
      filters: { due_date: params.get("date"), owner: params.get("owner"), status: params.get("status"), route_id: params.get("routeId") }
    });
    return csvResponse(`mcp-followups-${yyyyMMdd()}.csv`, [
      { key: "due_date", header: "Ngày hẹn" },
      { key: "owner", header: "Phụ trách" },
      { key: "route_id", header: "Route ID" },
      { key: "customer_name", header: "Tên khách" },
      { key: "followup_type", header: "Loại" },
      { key: "title", header: "Việc cần làm" },
      { key: "status", header: "Trạng thái" },
      { key: "priority", header: "Ưu tiên" },
      { key: "note", header: "Ghi chú" },
      { key: "session_id", header: "Session ID" },
      { key: "session_customer_id", header: "Session Customer ID" },
      { key: "visit_id", header: "Visit ID" },
      { key: "route_customer_id", header: "Route Customer ID" },
      { key: "customer_id", header: "Customer ID" },
      { key: "created_at", header: "Tạo lúc" },
      { key: "updated_at", header: "Cập nhật lúc" }
    ], rows);
  } catch (error) {
    return errorResponse(error);
  }
}
