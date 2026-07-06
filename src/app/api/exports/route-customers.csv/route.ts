import { csvResponse, yyyyMMdd } from "@/lib/export/csv";
import { errorResponse, restRows } from "@/lib/export/supabase-rest";

type Row = Record<string, string | number | boolean | null>;

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const rows = await restRows<Row>("mcp_route_customers", {
      select: "route_id,customer_id,customer_name,phone,area,address,sort_order,active,note,geo_lat,geo_lng,geo_accuracy,geo_captured_at,geo_source,google_maps_url,sync_status,created_at,updated_at",
      order: "route_id.asc,sort_order.asc,customer_name.asc",
      limit: Number(params.get("limit") || 5000),
      filters: { route_id: params.get("routeId"), active: params.get("active") }
    });
    return csvResponse(`mcp-route-customers-${yyyyMMdd()}.csv`, [
      { key: "route_id", header: "Route ID" },
      { key: "customer_id", header: "Customer ID" },
      { key: "customer_name", header: "Tên khách" },
      { key: "phone", header: "SĐT" },
      { key: "area", header: "Khu vực" },
      { key: "address", header: "Địa chỉ" },
      { key: "sort_order", header: "Thứ tự" },
      { key: "active", header: "Đang hoạt động" },
      { key: "geo_lat", header: "Lat" },
      { key: "geo_lng", header: "Lng" },
      { key: "geo_accuracy", header: "Độ chính xác" },
      { key: "geo_captured_at", header: "Thời gian lấy vị trí" },
      { key: "geo_source", header: "Nguồn vị trí" },
      { key: "google_maps_url", header: "Google Maps" },
      { key: "sync_status", header: "Sync" },
      { key: "note", header: "Ghi chú" },
      { key: "created_at", header: "Tạo lúc" },
      { key: "updated_at", header: "Cập nhật lúc" }
    ], rows);
  } catch (error) {
    return errorResponse(error);
  }
}
