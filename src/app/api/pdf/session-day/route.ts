import { errorResponse, restRows } from "@/lib/export/supabase-rest";
import { dateText, esc, htmlResponse, kv, table } from "@/lib/export/print";

type Row = Record<string, string | number | boolean | null>;
type McpLine = { sortOrder?: number; accountName?: string; phone?: string; area?: string; status?: string; note?: string; hasOrder?: boolean; hasTest?: boolean; hasReport?: boolean; followupCount?: number };
type McpDayPayload = { data?: { run?: Record<string, string>; lines?: McpLine[] } };
type PdfLine = { text: string; size?: number; gap?: number };

export const dynamic = "force-dynamic";

function backendBaseUrl(origin: string) {
  const value = String(process.env.BACKEND_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "").trim().replace(/\/+$/, "");
  return value || origin;
}

async function findSession(params: URLSearchParams) {
  const filters: Record<string, string | null> = { id: params.get("sessionId"), route_id: params.get("routeId"), session_date: params.get("date") };
  const sessions = await restRows<Row>("mcp_route_sessions", { select: "*", order: "session_date.desc,created_at.desc", limit: 1, filters });
  return sessions[0] || null;
}

async function fetchChecklist(origin: string, routeId: string, date: string) {
  const url = `${backendBaseUrl(origin)}/api/mcp-day/data?routeId=${encodeURIComponent(routeId)}&date=${encodeURIComponent(date)}`;
  const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({})) as McpDayPayload;
  if (!response.ok) throw new Error((payload as { error?: string }).error || `mcp_day_data_${response.status}`);
  return payload.data;
}

function ascii(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ĐÐ]/g, "D")
    .replace(/đ/g, "d")
    .replace(/[^\x20-\x7E]/g, " ");
}

function pdfEscape(value: unknown) {
  return ascii(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function truncate(value: unknown, max = 116) {
  const text = ascii(value).replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function contentLine(line: PdfLine, y: number) {
  const size = line.size || 9;
  return `BT /F1 ${size} Tf 40 ${y} Td (${pdfEscape(line.text)}) Tj ET\n`;
}

function buildPdf(lines: PdfLine[]) {
  const pages: PdfLine[][] = [[]];
  let y = 806;
  lines.forEach((line) => {
    const height = (line.size || 9) + (line.gap ?? 6);
    if (y - height < 40) {
      pages.push([]);
      y = 806;
    }
    pages[pages.length - 1].push(line);
    y -= height;
  });

  const pageCount = Math.max(1, pages.length);
  const objects: string[] = [];
  const pageObjectStart = 4;
  const contentObjectStart = pageObjectStart + pageCount;
  const kids = Array.from({ length: pageCount }, (_, index) => `${pageObjectStart + index} 0 R`).join(" ");

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  pages.forEach((pageLines, index) => {
    const pageObjectId = pageObjectStart + index;
    const contentObjectId = contentObjectStart + index;
    objects[pageObjectId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>`;

    let cursor = 806;
    let stream = "";
    pageLines.forEach((line) => {
      stream += contentLine(line, cursor);
      cursor -= (line.size || 9) + (line.gap ?? 6);
    });
    stream += contentLine({ text: `MCP-Plan · Trang ${index + 1}/${pageCount}`, size: 8 }, 24);
    objects[contentObjectId] = `<< /Length ${stream.length} >>\nstream\n${stream}endstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

function pdfResponse(filename: string, lines: PdfLine[]) {
  return new Response(buildPdf(lines), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store"
    }
  });
}

function reportFilename(routeName: unknown, sessionDate: unknown) {
  const route = ascii(routeName).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "mcp-session";
  const date = ascii(sessionDate).slice(0, 10) || new Date().toISOString().slice(0, 10);
  return `mcp-session-report-${route}-${date}.pdf`;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const params = url.searchParams;
    const session = await findSession(params);
    const routeId = String(params.get("routeId") || session?.route_id || "");
    const sessionDate = String(params.get("date") || session?.session_date || "").slice(0, 10);

    if (!routeId || !sessionDate) return htmlResponse("Báo cáo phiên MCP", `<h1>Không tìm thấy phiên</h1><p class="muted">Cần truyền sessionId hoặc routeId/date.</p>`);

    const checklist = await fetchChecklist(url.origin, routeId, sessionDate);
    const lines = checklist?.lines || [];
    const run = checklist?.run || {};

    const planned = lines.length;
    const visited = lines.filter((r) => r.status === "visited").length;
    const skipped = lines.filter((r) => r.status === "skipped").length;
    const orders = lines.filter((r) => r.hasOrder).length;
    const tests = lines.filter((r) => r.hasTest).length;
    const reports = lines.filter((r) => r.hasReport).length;
    const followups = lines.reduce((sum, r) => sum + Number(r.followupCount || 0), 0);
    const routeName = run.routeName || session?.route_name || "";
    const owner = run.owner || session?.sales || "";
    const status = run.status || session?.status || "";

    const body = `<div class="head"><div><div class="brand">MCP-Plan</div><h1>Báo cáo ngày của phiên MCP</h1><p class="muted">${esc(routeName)} · ${dateText(run.date || sessionDate)}</p></div><div>${kv([["Sale", owner], ["Khu vực", session?.area], ["Trạng thái", status]])}</div></div>
    <div class="metrics"><div class="metric"><span>Tất cả khách</span><b>${planned}</b></div><div class="metric"><span>Đã ghé</span><b>${visited}</b></div><div class="metric"><span>Bỏ qua</span><b>${skipped}</b></div><div class="metric"><span>Có đơn</span><b>${orders}</b></div></div>
    <div class="metrics"><div class="metric"><span>Có test</span><b>${tests}</b></div><div class="metric"><span>Có BC</span><b>${reports}</b></div><div class="metric"><span>Follow-up</span><b>${followups}</b></div><div class="metric"><span>Tỷ lệ ghé</span><b>${planned ? Math.round((visited / planned) * 100) : 0}%</b></div></div>
    <h2>Checklist khách trong phiên</h2>${table<McpLine>([
      { header: "#", value: (r, i) => r.sortOrder || i + 1, className: "center" },
      { header: "Khách", value: (r) => r.accountName },
      { header: "SĐT", value: (r) => r.phone },
      { header: "Khu vực", value: (r) => r.area },
      { header: "Trạng thái", value: (r) => r.status },
      { header: "Đơn", value: (r) => r.hasOrder ? "Có" : "" },
      { header: "Test", value: (r) => r.hasTest ? "Có" : "" },
      { header: "BC", value: (r) => r.hasReport ? "Có" : "" },
      { header: "Follow-up", value: (r) => r.followupCount || 0 },
      { header: "Ghi chú", value: (r) => r.note }
    ], lines)}`;

    if (params.get("preview") === "1") return htmlResponse(`Báo cáo phiên ${String(routeName || "")}`, body);

    const pdfLines: PdfLine[] = [
      { text: "MCP-PLAN", size: 14, gap: 8 },
      { text: "Bao cao ngay cua phien MCP", size: 18, gap: 10 },
      { text: `Tuyen: ${truncate(routeName, 70)} | Ngay: ${sessionDate} | Sale: ${truncate(owner, 28)}`, size: 10 },
      { text: `Khu vuc: ${truncate(session?.area || "", 40)} | Trang thai: ${truncate(status, 18)}`, size: 10, gap: 10 },
      { text: `Tong KH: ${planned} | Da ghe: ${visited} | Bo qua: ${skipped} | Co don: ${orders} | Test: ${tests} | BC: ${reports} | Follow-up: ${followups} | Ty le ghe: ${planned ? Math.round((visited / planned) * 100) : 0}%`, size: 10, gap: 12 },
      { text: "Checklist khach trong phien", size: 13, gap: 8 }
    ];

    lines.forEach((line, index) => {
      const flags = [line.hasOrder ? "Don" : null, line.hasTest ? "Test" : null, line.hasReport ? "BC" : null].filter(Boolean).join("/") || "-";
      pdfLines.push({ text: truncate(`${line.sortOrder || index + 1}. ${line.accountName || ""} | ${line.phone || ""} | ${line.area || ""} | ${line.status || ""} | ${flags} | FU:${line.followupCount || 0} | ${line.note || ""}`), size: 9 });
    });

    if (lines.length === 0) pdfLines.push({ text: "Khong co du lieu checklist.", size: 10 });

    return pdfResponse(reportFilename(routeName, sessionDate), pdfLines);
  } catch (error) {
    return errorResponse(error);
  }
}
