import { errorResponse, restRows } from "@/lib/export/supabase-rest";
import { dateText, esc, htmlResponse, kv, table } from "@/lib/export/print";

type Row = Record<string, string | number | boolean | null>;

type TestRow = Row & {
  customer_name?: string | null;
  customer_status?: string | null;
  product_name?: string | null;
  result_status?: string | null;
  result_note?: string | null;
};

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const files = await restRows<Row>("test_files", { select: "*", order: "test_date.desc,created_at.desc", limit: 1, filters: { id: params.get("fileId"), test_date: params.get("date"), sales: params.get("sales") } });
    const file = files[0];
    if (!file) return htmlResponse("Kết quả test", `<h1>Không tìm thấy hồ sơ test</h1><p class="muted">Cần truyền fileId hoặc date/sales.</p>`);
    const customers = await restRows<Row>("test_customers", { select: "*", order: "customer_name.asc", limit: 3000, filters: { file_id: String(file.id || "") } });
    const results = await restRows<Row>("test_customer_results", { select: "*", order: "customer_id.asc,product_name.asc", limit: 5000, filters: { file_id: String(file.id || "") } });
    const byCustomer = customers.reduce<Record<string, Row>>((acc, customer) => { acc[String(customer.id || "")] = customer; return acc; }, {});
    const rows: TestRow[] = results.length ? results.map((result) => { const customer = byCustomer[String(result.customer_id || "")] || {}; return { ...result, customer_name: String(customer.customer_name || ""), phone: customer.phone, area: customer.area, customer_status: String(customer.status || ""), result_status: String(result.status || ""), result_note: String(result.note || "") }; }) : customers.map((customer) => ({ ...customer, customer_name: String(customer.customer_name || ""), customer_status: String(customer.status || "") }));
    const body = `<div class="head"><div><div class="brand">MCP-Plan</div><h1>Phiếu kết quả test</h1><p class="muted">${esc(file.title || file.id)}</p></div><div>${kv([["Ngày test", dateText(file.test_date)], ["Sale", file.sales], ["Trạng thái", file.status]])}</div></div>
    <section class="box"><h2>Ghi chú hồ sơ</h2><p>${esc(file.note || "Không có ghi chú")}</p></section>
    <h2>Kết quả theo khách / sản phẩm</h2>${table<TestRow>([
      { header: "#", value: (_r, i) => i + 1, className: "center" },
      { header: "Khách", value: (r) => r.customer_name },
      { header: "SĐT", value: (r) => r.phone },
      { header: "Khu vực", value: (r) => r.area },
      { header: "Sản phẩm", value: (r) => r.product_name },
      { header: "Kết quả", value: (r) => r.result_status || r.customer_status },
      { header: "Ghi chú", value: (r) => r.result_note || r.note }
    ], rows)}`;
    return htmlResponse(`Kết quả test ${String(file.title || "")}`, body);
  } catch (error) {
    return errorResponse(error);
  }
}
