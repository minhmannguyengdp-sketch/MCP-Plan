import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const [builder, dataLoader, route, nextConfig] = await Promise.all([
  readFile(new URL("../src/lib/export/order-workbook.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/export/order-workbook-data.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app/api/exports/orders.csv/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../next.config.mjs", import.meta.url), "utf8")
]);

test("individual order export uses one branded two-sheet workbook", () => {
  assert.match(builder, /name="Phiếu đơn hàng"/);
  assert.match(builder, /name="Dữ liệu đơn"/);
  assert.match(builder, /xl\/media\/image1\.png/);
  assert.match(dataLoader, /logo-transparent\.png/);
  assert.match(dataLoader, /CÔNG TY TNHH TM NGUYÊN LIỆU HƯNG PHÁT/);
  assert.match(dataLoader, /152 Yersin, Phường Đạo Thạnh, Tỉnh Đồng Tháp/);
  assert.match(nextConfig, /outputFileTracingIncludes/);
  assert.match(nextConfig, /logo-transparent\.png/);
});

test("print sheet follows the approved brown business layout", () => {
  assert.match(builder, /const DARK_BROWN = "6B3F2A"/);
  assert.match(builder, /const LIGHT_BEIGE = "F3E7DA"/);
  assert.doesNotMatch(builder, /const DARK_BROWN = "(?:1D4ED8|2563EB)"/i);
  assert.match(builder, /THÔNG TIN ĐƠN HÀNG/);
  assert.match(builder, /THÔNG TIN KHÁCH HÀNG/);
  assert.match(builder, /GIAO NHẬN & ĐỊNH VỊ/);
  assert.match(builder, /\["Trạng thái", data\.order\.status\]/);
  assert.match(builder, /\["Thanh toán", data\.order\.paymentMethod\]/);
  assert.match(builder, /\["Địa chỉ giao", data\.order\.deliveryAddress\]/);
  assert.match(builder, /\["Latitude", data\.location\.latitude\]/);
  assert.match(builder, /\["Longitude", data\.location\.longitude\]/);
  assert.match(builder, /\["Nguồn GPS", data\.location\.source\]/);
  assert.match(builder, /Mở vị trí trên Google Maps ↗/);
  assert.match(builder, /orientation="landscape"/);
  assert.match(builder, /paperSize="9"/);
});

test("product and totals contract keeps business fields and Excel formulas", () => {
  for (const header of ["MÃ HÀNG", "TÊN SẢN PHẨM", "THƯƠNG HIỆU", "DUNG TÍCH", "KHỐI LƯỢNG", "ĐVT", "SL", "ĐƠN GIÁ", "CHIẾT KHẤU", "THÀNH TIỀN", "GHI CHÚ"]) {
    assert.match(builder, new RegExp(header));
  }
  assert.match(builder, /MAX\(H\$\{row\}\*I\$\{row\}-J\$\{row\},0\)/);
  assert.match(builder, /SUMPRODUCT\(H\$\{itemStart\}:H\$\{itemEnd\},I\$\{itemStart\}:I\$\{itemEnd\}\)/);
  assert.match(builder, /Chiết khấu đơn/);
  assert.match(builder, /Phí giao hàng/);
  assert.match(builder, /Tổng thanh toán/);
  assert.match(builder, /Đã thanh toán/);
  assert.match(builder, /Còn phải thu/);
  assert.match(builder, /KHÁCH HÀNG/);
  assert.match(builder, /NHÂN VIÊN SALE/);
  assert.match(builder, /KHO \/ GIAO HÀNG/);
});

test("flat sheet is filterable and enriches manual and MCP orders", () => {
  assert.match(builder, /autoFilter ref="A1:AP/);
  assert.match(builder, /pane ySplit="1"/);
  for (const table of ["orders", "order_items", "product_variants", "products", "mcp_session_customers", "mcp_route_customers", "mcp_routes", "mcp_route_sessions"]) {
    assert.match(dataLoader, new RegExp(`(?:restRows<Row>|firstRow)\\s*\\(\\s*"${table}"`));
  }
  assert.match(dataLoader, /sourceType === "mcp_session_customer"/);
  assert.match(dataLoader, /sourceType === "orders_tab"/);
  assert.match(dataLoader, /geo_lat,geo_lng/);
  assert.match(dataLoader, /brand_name/);
  assert.match(dataLoader, /size_label/);
  assert.match(dataLoader, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
});

test("specific orders stay XLSX while aggregate CSV exports have explicit row grains", () => {
  assert.match(route, /const orderCode = params\.get\("orderCode"\)/);
  assert.match(route, /if \(orderId \|\| orderCode\) return orderWorkbookResponse\(orderId, orderCode\)/);
  assert.match(route, /const view = params\.get\("view"\) === "items" \? "items" : "orders"/);
  assert.match(route, /const rows: OrderSummaryRow\[\] = orders\.map/);
  assert.match(route, /product_summary: list\.map\(itemSummary\)\.join\(" \| "\)/);
  assert.match(route, /const rows: ProductDetailRow\[\] = orders\.flatMap/);
  assert.doesNotMatch(route, /return list\.map\(\(item\) => \(\{ \.\.\.order/);
  assert.match(route, /danh-sach-don-hang/);
  assert.match(route, /chi-tiet-san-pham-theo-don/);
  assert.match(route, /header: "Sản phẩm trong đơn"/);
  assert.match(route, /header: "Mã đơn hệ thống"/);
});
