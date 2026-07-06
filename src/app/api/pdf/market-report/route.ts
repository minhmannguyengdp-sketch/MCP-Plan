import { errorResponse, restRows } from "@/lib/export/supabase-rest";
import { dateText, esc, htmlResponse, kv, table } from "@/lib/export/print";

type Row = Record<string, string | number | boolean | null | Record<string, unknown>>;

export const dynamic = "force-dynamic";

function asCell(value: Row[string]) {
  return typeof value === "object" ? "" : value;
}

function rawText(row: Row, path: string) {
  const raw = row.raw_payload;
  if (!raw || typeof raw !== "object") return "";
  const value = path.split(".").reduce<unknown>((acc, key) => acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined, raw);
  if (Array.isArray(value)) return value.map((item) => typeof item === "object" && item ? String((item as Record<string, unknown>).label || (item as Record<string, unknown>).value || (item as Record<string, unknown>).id || "") : String(item)).filter(Boolean).join(", ");
  return value == null ? "" : String(value);
}

function countTerms(rows: Row[], getter: (row: Row) => string) {
  const counts = new Map<string, number>();
  rows.forEach((row) => getter(row).split(",").map((x) => x.trim()).filter(Boolean).forEach((x) => counts.set(x, (counts.get(x) || 0) + 1)));
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => `${name} (${count})`).join(", ");
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const rows = await restRows<Row>("market_reports", {
      select: "*",
      order: "report_date.desc,updated_at.desc",
      limit: Number(params.get("limit") || 500),
      filters: { report_date: params.get("date"), sales: params.get("sales"), route_name: params.get("routeName") }
    });
    const titleDate = params.get("date") || dateText(asCell(rows[0]?.report_date)) || "gần nhất";
    const competitorTop = countTerms(rows, (row) => rawText(row, "selected.competitors") || String(row.competitor_summary || ""));
    const productTop = countTerms(rows, (row) => rawText(row, "selected.usedProducts") || String(row.company_product_summary || ""));
    const body = `<div class="head"><div><div class="brand">MCP-Plan</div><h1>Báo cáo thị trường</h1><p class="muted">Ngày/kỳ: ${esc(titleDate)}</p></div><div>${kv([["Số báo cáo", rows.length], ["Sale", params.get("sales") || "Tất cả"], ["Tuyến", params.get("routeName") || "Tất cả"]])}</div></div>
    <div class="grid"><section class="box"><h2>Top đối thủ</h2><p>${esc(competitorTop || "Chưa có dữ liệu")}</p></section><section class="box"><h2>Top SP/brand khách đang dùng</h2><p>${esc(productTop || "Chưa có dữ liệu")}</p></section></div>
    <h2>Chi tiết báo cáo</h2>${table<Row>([
      { header: "Ngày", value: (r) => dateText(asCell(r.report_date)) },
      { header: "Sale", value: (r) => asCell(r.sales) },
      { header: "Tuyến", value: (r) => asCell(r.route_name) },
      { header: "Khách", value: (r) => rawText(r, "context.customerName") },
      { header: "Đối thủ", value: (r) => rawText(r, "selected.competitors") || asCell(r.competitor_summary) },
      { header: "SP/brand đang dùng", value: (r) => rawText(r, "selected.usedProducts") || asCell(r.company_product_summary) },
      { header: "Giá", value: (r) => asCell(r.price_summary) },
      { header: "Nhu cầu", value: (r) => asCell(r.demand_summary) },
      { header: "Next action", value: (r) => asCell(r.next_action) },
      { header: "Ghi chú", value: (r) => asCell(r.note) }
    ], rows)}`;
    return htmlResponse(`Báo cáo thị trường ${titleDate}`, body);
  } catch (error) {
    return errorResponse(error);
  }
}
