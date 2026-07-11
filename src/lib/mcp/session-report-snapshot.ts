import { supabaseRestConfig } from "@/lib/export/supabase-rest";
import { buildSessionReportCustomerDetails } from "@/lib/mcp/session-report-customer-details";
import { buildSessionReportEnrichment } from "@/lib/mcp/session-report-enrichment";
import { buildMcpSessionReportSummary, sessionReportSummaryText } from "@/lib/mcp/session-report";

export async function saveMcpSessionReportSnapshot(sessionId: string, source = "close_session") {
  const summary = await buildMcpSessionReportSummary({ sessionId });
  const customerDetails = await buildSessionReportCustomerDetails(summary);
  const enrichment = buildSessionReportEnrichment(summary, customerDetails);
  const env = supabaseRestConfig();
  const snapshotAt = new Date().toISOString();
  const sections = { ...summary.sections, customers: customerDetails };
  const body = {
    session_id: summary.session.id,
    route_id: summary.session.routeId || null,
    route_name: summary.session.routeName || null,
    session_date: summary.session.sessionDate || null,
    sales: summary.session.sales || null,
    status: "snapshot",
    snapshot_source: source,
    schema_version: enrichment.schemaVersion,
    kpis: summary.kpis,
    overview: summary.sections.overview,
    sections,
    customer_details: customerDetails,
    insights: enrichment.insights,
    score: enrichment.score,
    health: enrichment.health,
    warnings: enrichment.warnings,
    recommended_actions: enrichment.recommendedActions,
    ai_prompt_context: enrichment.aiPromptContext,
    summary_text: sessionReportSummaryText(summary),
    raw_payload: { summary: { ...summary, sections }, enrichment },
    snapshot_at: snapshotAt,
    updated_at: snapshotAt
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
