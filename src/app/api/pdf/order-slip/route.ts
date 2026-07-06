import { errorResponse, restRows } from "@/lib/export/supabase-rest";
import { dateText, esc, htmlResponse, kv, money, table } from "@/lib/export/print";

type Row = Record<string, string | number | boolean | null>;

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const filters: Record<string, string | null> = { id: params.get("orderId"), order_code: params.get("orderCode") };
    let orders = await restRows<Row>("orders", { select: "*", order: "order_date.desc,created_at.desc", limit: filters.id || filters.order_code ? 1 : 1, filters });
    const order = orders[0];
    if (!order) return htmlResponse("Phiếu đơn hàng", `<h1>Không tìm thấy đơn hàng</h1><p class="muted">Cần truyền orderId hoặc orderCode.</p>`);
    const items = await restRows<Row>("order_items", { select: "*", order: "created_at.asc", limit: 500, filters: { order_id: String(order.id || "") } });
    const body = `<div class="head"><div><div class="brand">MCP-Plan</div><h1>Phiếu đơn hàng</h1><p class="muted">${esc(order.order_code || order.id)}</p></div><div>${kv([["Ngày", dateText(order.order_date)], ["Trạng thái", order.status], ["Sale", order.sales]])}</div></div>
    <div class="grid"><section class="box"><h2>Khách hàng</h2>${kv([["Tên khách", order.customer_name], ["SĐT", order.customer_phone], ["Khu vực", order.area], ["Địa chỉ", order.delivery_address]])}</section><section class="box"><h2>Tổng tiền</h2>${kv([["Tạm tính", money(order.subtotal)], ["Giảm", money(order.discount_total)], ["Tổng", money(order.grand_total)], ["Ghi chú", order.note]])}</section></div>
    <h2>Chi tiết sản phẩm</h2>${table<Row>([
      { header: "#", value: (_r, i) => i + 1, className: "center" },
      { header: "Sản phẩm", value: (r) => r.product_name },
      { header: "SKU", value: (r) => r.sku },
      { header: "Đơn vị", value: (r) => r.unit },
      { header: "SL", value: (r) => r.quantity, className: "right" },
      { header: "Đơn giá", value: (r) => money(r.unit_price), className: "right" },
      { header: "Thành tiền", value: (r) => money(r.line_total), className: "right" },
      { header: "Ghi chú", value: (r) => r.note }
    ], items)}
    <div class="grid" style="margin-top:22px"><div class="box center"><b>Người lập</b><p style="height:48px"></p></div><div class="box center"><b>Khách hàng xác nhận</b><p style="height:48px"></p></div></div>`;
    return htmlResponse(`Phiếu đơn hàng ${String(order.order_code || "")}`, body);
  } catch (error) {
    return errorResponse(error);
  }
}
