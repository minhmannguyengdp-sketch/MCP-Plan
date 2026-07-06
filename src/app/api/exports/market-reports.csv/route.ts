import { csvResponse, yyyyMMdd } from "@/lib/export/csv";
import { errorResponse, restRows } from "@/lib/export/supabase-rest";

type Row = Record<string, string | number | boolean | null | Record<string, unknown>>;

export const dynamic = "force-dynamic";

function rawText(row: Row, path: string) {
  const raw = row.raw_payload;
  if (!raw || typeof raw !== "object") return "";
  const value = path.split(".").reduce<unknown>((acc, key) => acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined, raw);
  if (Array.isArray(value)) return value.map((item) => typeof item === "object" && item ? String((item as Record<string, unknown>).label || (item as Record<string, unknown>).value || (item as Record<string, unknown>).id || "") : String(item)).filter(Boolean).join(", ");
  return value == null ? "" : String(value);
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const rows = await restRows<Row>("market_reports", {
      select: "id,report_date,sales,market_area,route_name,market_type,total_shops,competitor_summary,price_summary,demand_summary,company_product_summary,opportunity_summary,risk_summary,next_action,note,sync_status,raw_payload,created_at,updated_at,synced_at",
      order: "report_date.desc,updated_at.desc",
      limit: Number(params.get("limit") || 5000),
      filters: { report_date: params.get("date"), sales: params.get("sales"), route_name: params.get("routeName") }
    });
    return csvResponse(`mcp-market-reports-${yyyyMMdd()}.csv`, [
      { key: "report_date", header: "Ngày BC" },
      { key: "sales", header: "Sale" },
      { key: "route_name", header: "Tuyến" },
      { key: "market_area", header: "Khu vực" },
      { key: "market_type", header: "Loại BC" },
      { key: "total_shops", header: "Số shop" },
      { key: "competitor_summary", header: "Đối thủ" },
      { key: "price_summary", header: "Giá" },
      { key: "demand_summary", header: "Nhu cầu" },
      { key: "company_product_summary", header: "SP công ty" },
      { key: "opportunity_summary", header: "Cơ hội" },
      { key: "risk_summary", header: "Rủi ro" },
      { key: "next_action", header: "Next action" },
      { key: "note", header: "Ghi chú" },
      { key: "selected_competitors", header: "Tick đối thủ", value: (row) => rawText(row, "selected.competitors") },
      { key: "selected_used_products", header: "Tick SP/brand đang dùng", value: (row) => rawText(row, "selected.usedProducts") },
      { key: "customer_name", header: "Khách", value: (row) => rawText(row, "context.customerName") },
      { key: "route_customer_id", header: "Route Customer ID", value: (row) => rawText(row, "context.routeCustomerId") },
      { key: "sync_status", header: "Sync" },
      { key: "created_at", header: "Tạo lúc" },
      { key: "updated_at", header: "Cập nhật lúc" },
      { key: "synced_at", header: "Sync lúc" }
    ], rows);
  } catch (error) {
    return errorResponse(error);
  }
}
