import { reportFilename, reportSource, reportStatus } from "@/lib/export/business-report";
import { csvResponse, yyyyMMdd } from "@/lib/export/csv";
import { orderWorkbookResponse } from "@/lib/export/order-workbook-data";
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
    const orderId = params.get("orderId") || params.get("id");
    const orderCode = params.get("orderCode");
    if (orderId || orderCode) return orderWorkbookResponse(orderId, orderCode);

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
    return csvResponse(reportFilename("du-lieu-don-hang", [yyyyMMdd()], "csv"), [
      { key: "order_code", header: "Mã đơn" },
      { key: "order_date", header: "Ngày đặt hàng" },
      { key: "sales", header: "Nhân viên phụ trách" },
      { key: "customer_name", header: "Tên khách hàng" },
      { key: "customer_phone", header: "Số điện thoại" },
      { key: "area", header: "Khu vực" },
      { key: "delivery_address", header: "Địa chỉ giao hàng" },
      { key: "status", header: "Trạng thái đơn", value: (row) => reportStatus(row.status) },
      { key: "product_name", header: "Sản phẩm" },
      { key: "sku", header: "Mã hàng" },
      { key: "variant_id", header: "Mã quy cách" },
      { key: "unit", header: "Đơn vị bán" },
      { key: "quantity", header: "Số lượng" },
      { key: "unit_price", header: "Đơn giá" },
      { key: "item_discount", header: "Chiết khấu dòng" },
      { key: "line_total", header: "Thành tiền" },
      { key: "subtotal", header: "Tạm tính đơn" },
      { key: "discount_total", header: "Chiết khấu đơn" },
      { key: "grand_total", header: "Tổng giá trị đơn" },
      { key: "note", header: "Ghi chú đơn" },
      { key: "item_note", header: "Ghi chú sản phẩm" },
      { key: "source_type", header: "Nguồn đơn", value: (row) => reportSource(row.source_type) },
      { key: "source_id", header: "Mã nguồn" },
      { key: "sync_status", header: "Trạng thái đồng bộ", value: (row) => reportStatus(row.sync_status) },
      { key: "created_at", header: "Thời điểm tạo" },
      { key: "updated_at", header: "Cập nhật gần nhất" }
    ], rows);
  } catch (error) {
    return errorResponse(error);
  }
}
