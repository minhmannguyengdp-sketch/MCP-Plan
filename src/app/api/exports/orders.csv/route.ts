import { csvResponse, yyyyMMdd } from "@/lib/export/csv";
import { errorResponse, restRows } from "@/lib/export/supabase-rest";

type OrderRow = Record<string, string | number | boolean | null>;
type ItemRow = Record<string, string | number | boolean | null>;

type ExportRow = OrderRow & {
  item_id?: string | null;
  product_id?: string | null;
  variant_id?: string | null;
  product_name?: string | null;
  sku?: string | null;
  unit?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  item_discount?: number | null;
  line_total?: number | null;
  item_note?: string | null;
};

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const orders = await restRows<OrderRow>("orders", {
      select: "id,order_code,order_date,sales,customer_id,customer_name,customer_phone,area,delivery_address,source_type,source_id,status,subtotal,discount_total,grand_total,note,sync_status,created_at,updated_at",
      order: "order_date.desc,created_at.desc",
      limit: Number(params.get("limit") || 3000),
      filters: { order_date: params.get("date"), sales: params.get("sales"), status: params.get("status") }
    });
    const orderIds = new Set(orders.map((order) => String(order.id || "")).filter(Boolean));
    const items = await restRows<ItemRow>("order_items", { select: "id,order_id,product_id,variant_id,product_name,sku,unit,quantity,unit_price,discount,line_total,note,created_at", order: "order_id.asc,created_at.asc", limit: 10000 });
    const scopedItems = items.filter((item) => orderIds.has(String(item.order_id || "")));
    const byOrder = scopedItems.reduce<Record<string, ItemRow[]>>((acc, item) => { const id = String(item.order_id || ""); acc[id] = [...(acc[id] || []), item]; return acc; }, {});
    const rows: ExportRow[] = orders.flatMap((order) => {
      const list = byOrder[String(order.id || "")] || [];
      if (!list.length) return [order as ExportRow];
      return list.map((item) => ({ ...order, item_id: String(item.id || ""), product_id: String(item.product_id || ""), variant_id: String(item.variant_id || ""), product_name: String(item.product_name || ""), sku: String(item.sku || ""), unit: String(item.unit || ""), quantity: Number(item.quantity || 0), unit_price: Number(item.unit_price || 0), item_discount: Number(item.discount || 0), line_total: Number(item.line_total || 0), item_note: String(item.note || "") }));
    });
    return csvResponse(`mcp-orders-${yyyyMMdd()}.csv`, [
      { key: "order_code", header: "Mã đơn" },
      { key: "order_date", header: "Ngày đơn" },
      { key: "sales", header: "Sale" },
      { key: "customer_name", header: "Tên khách" },
      { key: "customer_phone", header: "SĐT" },
      { key: "area", header: "Khu vực" },
      { key: "delivery_address", header: "Địa chỉ giao" },
      { key: "status", header: "Trạng thái" },
      { key: "product_name", header: "Sản phẩm" },
      { key: "sku", header: "SKU" },
      { key: "variant_id", header: "Variant ID" },
      { key: "unit", header: "Đơn vị" },
      { key: "quantity", header: "SL" },
      { key: "unit_price", header: "Đơn giá" },
      { key: "item_discount", header: "Giảm dòng" },
      { key: "line_total", header: "Thành tiền" },
      { key: "subtotal", header: "Tạm tính đơn" },
      { key: "discount_total", header: "Giảm đơn" },
      { key: "grand_total", header: "Tổng đơn" },
      { key: "note", header: "Ghi chú đơn" },
      { key: "item_note", header: "Ghi chú dòng" },
      { key: "source_type", header: "Nguồn" },
      { key: "source_id", header: "Source ID" },
      { key: "sync_status", header: "Sync" },
      { key: "created_at", header: "Tạo lúc" },
      { key: "updated_at", header: "Cập nhật lúc" }
    ], rows);
  } catch (error) {
    return errorResponse(error);
  }
}
