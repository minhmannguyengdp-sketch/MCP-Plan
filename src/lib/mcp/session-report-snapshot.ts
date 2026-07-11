import { supabaseRestConfig } from "@/lib/export/supabase-rest";
import { buildMcpSessionReportSummary, sessionReportSummaryText } from "./session-report";

export async function saveMcpSessionReportSnapshot(sessionId: string, source = "close_session") {
  const summary = await buildMcpSessionReportSummary({ sessionId });
  const env = supabaseRestConfig();
  const body = {
    session_id: summary.session.id,
    route_id: summary.session.routeId || null,
    route_name: summary.session.routeName || null,
    session_date: summary.session.sessionDate || null,
    sales: summary.session.sales || null,
    status: "snapshot",
    snapshot_source: source,
    kpis: summary.kpis,
    overview: summary.sections.overview,
    sections: summary.sections,
    summary_text: sessionReportSummaryText(summary),
    raw_payload: { summary },
    snapshot_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  const response = await fetch(`${env.url}/rest/v1/mcp_session_reports?on_conflict=session_id&select=*`, {
    method: "POST",
    cache: "no-store",
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `session_report_snapshot_${response.status}`);
  return Array.isArray(payload) ? payload[0] : payload;
}
