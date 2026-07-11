import { buildMcpSessionPdf } from "@/lib/export/mcp-session-pdf";
import { errorResponse } from "@/lib/export/supabase-rest";
import { loadMcpSessionReportSource } from "@/lib/mcp/session-report-source";

export const dynamic = "force-dynamic";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function ascii(value: unknown) {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ĐÐ]/g, "D")
    .replace(/đ/g, "d")
    .replace(/[^ -~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function reportFilename(routeName: unknown, sessionDate: unknown) {
  const route = ascii(routeName).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "mcp-session";
  const date = ascii(sessionDate).slice(0, 10) || new Date().toISOString().slice(0, 10);
  return `mcp-session-report-${route}-${date}.pdf`;
}

function pdfResponse(filename: string, body: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const sessionId = text(params.get("sessionId") || params.get("session_id"));
    const routeId = text(params.get("routeId") || params.get("route_id"));
    const date = text(params.get("date") || params.get("sessionDate") || params.get("session_date")).slice(0, 10);
    if (!sessionId && !(routeId && date)) throw new Error("session_report_source_required");

    const source = await loadMcpSessionReportSource({ sessionId, routeId, date });
    const summary = source.summary;
    const lines = source.customerDetails.map((customer, index) => ({
      sortOrder: customer.sortOrder || index + 1,
      accountName: customer.customerName,
      phone: customer.phone,
      area: customer.area,
      status: customer.visitStatus,
      note: [customer.statusReason, customer.note].filter(Boolean).join(" · "),
      hasOrder: customer.orders.length > 0,
      hasTest: customer.tests.length > 0,
      hasReport: customer.observations.length > 0,
      followupCount: customer.followups.length
    }));

    const pdf = buildMcpSessionPdf({
      routeName: summary.session.routeName,
      sessionDate: summary.session.sessionDate,
      owner: summary.session.sales,
      area: "",
      status: summary.session.status,
      lines
    });

    return pdfResponse(reportFilename(summary.session.routeName, summary.session.sessionDate), pdf);
  } catch (error) {
    return errorResponse(error);
  }
}
