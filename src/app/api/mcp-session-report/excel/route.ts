import { errorResponse } from "@/lib/export/supabase-rest";
import { loadMcpSessionReportSource } from "@/lib/mcp/session-report-source";

export const dynamic = "force-dynamic";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function csvCell(value: unknown) {
  const normalized = String(value ?? "").replace(/\r?\n/g, " ");
  return `"${normalized.replace(/"/g, '""')}"`;
}

function ascii(value: unknown) {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ĐÐ]/g, "D")
    .replace(/đ/g, "d")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "mcp";
}

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    const sessionId = text(query.get("sessionId") || query.get("session_id"));
    if (!sessionId) throw new Error("session_id_required");

    const source = await loadMcpSessionReportSource({ sessionId });
    const summary = source.summary;
    const header = [
      "STT", "Khách hàng", "Số điện thoại", "Khu vực", "Trạng thái", "Lý do trạng thái",
      "Số đơn", "Mã đơn", "Giá trị đơn", "Số test", "Sản phẩm test", "Kết quả test",
      "Số quan sát", "Số follow-up", "Ghi chú"
    ];
    const rows = source.customerDetails.map((customer, index) => {
      const orderCodes = customer.orders.map((item) => item.code || item.id).filter(Boolean).join(" | ");
      const orderTotal = customer.orders.reduce((sum, item) => sum + Number(item.total || 0), 0);
      const testProducts = customer.tests.map((item) => item.productName).filter(Boolean).join(" | ");
      const testStatuses = customer.tests.map((item) => item.status).filter(Boolean).join(" | ");
      return [
        customer.sortOrder || index + 1,
        customer.customerName,
        customer.phone,
        customer.area,
        customer.visitStatus || customer.status,
        customer.statusReason,
        customer.orders.length,
        orderCodes,
        orderTotal,
        customer.tests.length,
        testProducts,
        testStatuses,
        customer.observations.length,
        customer.followups.length,
        customer.note
      ];
    });

    const meta = [
      ["BC phiên", summary.session.routeName],
      ["Ngày phiên", summary.session.sessionDate],
      ["Sales", summary.session.sales],
      ["Session ID", summary.session.id],
      ["Nguồn", source.origin]
    ];
    const csv = [
      ...meta.map((row) => row.map(csvCell).join(",")),
      "",
      header.map(csvCell).join(","),
      ...rows.map((row) => row.map(csvCell).join(","))
    ].join("\r\n");
    const filename = `bc-phien-${ascii(summary.session.routeName)}-${summary.session.sessionDate || "khong-ngay"}.csv`;

    return new Response(`\ufeff${csv}`, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
