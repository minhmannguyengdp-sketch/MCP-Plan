import { errorResponse } from "@/lib/export/supabase-rest";
import { buildSessionReportExportPayload, sessionReportExportFilenameV2 } from "@/lib/mcp/session-report-export-v2";
import { loadMcpSessionReportSource } from "@/lib/mcp/session-report-source";

export const dynamic = "force-dynamic";

const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function html(value: unknown) {
  return text(value).replace(/[&<>"']/g, (char) => HTML_ENTITIES[char] || char);
}

function list(items: string[], empty: string) {
  const values = items.length ? items : [empty];
  return `<ul>${values.map((item) => `<li>${html(item)}</li>`).join("")}</ul>`;
}

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    const sessionId = text(query.get("sessionId") || query.get("session_id"));
    if (!sessionId) throw new Error("session_id_required");

    const source = await loadMcpSessionReportSource({ sessionId });
    const report = buildSessionReportExportPayload(source);
    const overview = report.overview;
    const customers = report.customerDetails.map((customer) => `
      <tr>
        <td>${customer.sortOrder || ""}</td>
        <td>${html(customer.customerName)}</td>
        <td>${html(customer.area)}</td>
        <td>${html(customer.visitStatus)}</td>
        <td>${customer.orders.length}</td>
        <td>${customer.tests.length}</td>
        <td>${customer.observations.length}</td>
        <td>${customer.followups.length}</td>
        <td>${html(customer.statusReason || customer.note)}</td>
      </tr>`).join("");
    const orders = report.commerce.orders.map((item) => `
      <tr><td>${html(item.customerName)}</td><td>${html(item.code)}</td><td>${html(item.status)}</td><td>${Math.round(item.total || 0).toLocaleString("vi-VN")}đ</td><td>${html(item.note)}</td></tr>`).join("");
    const tests = report.commerce.tests.map((item) => `
      <tr><td>${html(item.customerName)}</td><td>${html(item.productName)}</td><td>${html(item.status)}</td><td>${html(item.note)}</td></tr>`).join("");

    const document = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>BC phiên ${html(report.session.routeName)}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:11pt;color:#1f2937;line-height:1.45;margin:32px}
    h1{font-size:20pt;margin:0 0 6px} h2{font-size:14pt;margin:24px 0 8px}
    .muted{color:#6b7280}.summary{border:1px solid #d1d5db;padding:12px;margin:14px 0;background:#f8fafc}
    table{width:100%;border-collapse:collapse;margin:8px 0 18px} th,td{border:1px solid #d1d5db;padding:6px;vertical-align:top} th{background:#eef2f7;text-align:left}
    .metrics td{width:25%;text-align:center}.metrics strong{display:block;font-size:15pt}
    ul{margin-top:6px}
  </style>
</head>
<body>
  <h1>BC phiên · ${html(report.session.routeName || "MCP")}</h1>
  <div class="muted">Ngày ${html(report.session.sessionDate)} · Sales ${html(report.session.sales || "-")} · ${html(report.schemaVersion)}</div>

  <table class="metrics">
    <tr>
      <td><strong>${overview.planned}</strong>Khách kế hoạch</td>
      <td><strong>${overview.visited}</strong>Đã ghé</td>
      <td><strong>${overview.orders}</strong>Đơn hàng</td>
      <td><strong>${overview.tests}</strong>Test sản phẩm</td>
    </tr>
  </table>

  <div class="summary"><strong>Đánh giá: ${html(report.health)} · ${report.score}/100</strong><br>${html(report.insights.summary || "Chưa có nhận định.")}</div>

  <h2>Cảnh báo</h2>
  ${list(report.warnings, "Không có cảnh báo.")}

  <h2>Hành động đề xuất</h2>
  ${list(report.recommendedActions.map((item) => `${item.priority.toUpperCase()} · ${item.customerName ? `${item.customerName}: ` : ""}${item.action} — ${item.reason}`), "Chưa có hành động đề xuất.")}

  <h2>Đơn hàng</h2>
  <table><thead><tr><th>Khách</th><th>Mã đơn</th><th>Trạng thái</th><th>Giá trị</th><th>Ghi chú</th></tr></thead><tbody>${orders || '<tr><td colspan="5">Chưa có đơn hàng.</td></tr>'}</tbody></table>

  <h2>Test sản phẩm</h2>
  <table><thead><tr><th>Khách</th><th>Sản phẩm</th><th>Kết quả</th><th>Ghi chú</th></tr></thead><tbody>${tests || '<tr><td colspan="4">Chưa có test sản phẩm.</td></tr>'}</tbody></table>

  <h2>Chi tiết khách (${report.customerDetails.length}/${overview.planned})</h2>
  <table>
    <thead><tr><th>STT</th><th>Khách</th><th>Khu vực</th><th>Trạng thái</th><th>Đơn</th><th>Test</th><th>Quan sát</th><th>Follow-up</th><th>Ghi chú</th></tr></thead>
    <tbody>${customers || '<tr><td colspan="9">Chưa có chi tiết khách.</td></tr>'}</tbody>
  </table>

  <p class="muted">Xuất từ MCP-Plan lúc ${html(report.generatedAt)}</p>
</body>
</html>`;

    const filename = sessionReportExportFilenameV2(report, "md").replace(/\.md$/, ".doc");
    return new Response(`\ufeff${document}`, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/msword; charset=utf-8",
        "Content-Disposition": `attachment; filename=${filename}`,
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
