import { errorResponse } from "@/lib/export/supabase-rest";
import { buildMcpSessionReportSummary, saveMcpSessionReportSnapshot } from "@/lib/mcp/session-report";

export const dynamic = "force-dynamic";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function paramsFrom(request: Request) {
  const params = new URL(request.url).searchParams;
  return {
    sessionId: text(params.get("sessionId") || params.get("session_id")),
    routeId: text(params.get("routeId") || params.get("route_id")),
    date: text(params.get("date") || params.get("sessionDate") || params.get("session_date")).slice(0, 10)
  };
}

export async function GET(request: Request) {
  try {
    const data = await buildMcpSessionReportSummary(paramsFrom(request));
    return Response.json({ data, receivedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const sessionId = text(body.sessionId || body.session_id || paramsFrom(request).sessionId);
    if (!sessionId) throw new Error("session_id_required");
    const data = await saveMcpSessionReportSnapshot(sessionId, text(body.source) || "manual_snapshot");
    return Response.json({ data, receivedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
