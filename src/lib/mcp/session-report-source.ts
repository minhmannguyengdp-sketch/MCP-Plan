import { restRows } from "@/lib/export/supabase-rest";
import { buildMcpSessionReportSummary, type SessionReportSummary } from "@/lib/mcp/session-report";

type Row = Record<string, unknown>;

export type SessionReportSource = {
  summary: SessionReportSummary;
  origin: "snapshot" | "live";
  snapshotId?: string;
  snapshotSource?: string;
  snapshotAt?: string;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function object(value: unknown): Row | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Row : null;
}

function summaryFromSnapshot(row: Row): SessionReportSummary | null {
  const rawPayload = object(row.raw_payload);
  const rawSummary = object(rawPayload?.summary);
  if (rawSummary?.session && rawSummary?.sections && Array.isArray(rawSummary?.kpis)) {
    return rawSummary as unknown as SessionReportSummary;
  }

  const sections = object(row.sections);
  const kpis = Array.isArray(row.kpis) ? row.kpis : [];
  if (!sections) return null;

  return {
    session: {
      id: text(row.session_id),
      routeId: text(row.route_id),
      routeName: text(row.route_name),
      sessionDate: text(row.session_date).slice(0, 10),
      sales: text(row.sales),
      status: "done",
      updatedAt: text(row.snapshot_at || row.updated_at)
    },
    kpis: kpis as SessionReportSummary["kpis"],
    sections: sections as unknown as SessionReportSummary["sections"]
  };
}

export async function loadMcpSessionReportSource(input: { sessionId?: string; routeId?: string; date?: string }): Promise<SessionReportSource> {
  const sessionId = text(input.sessionId);
  if (sessionId) {
    const rows = await restRows<Row>("mcp_session_reports", {
      select: "id,session_id,route_id,route_name,session_date,sales,status,kpis,overview,sections,summary_text,snapshot_source,snapshot_at,raw_payload,created_at,updated_at",
      order: "snapshot_at.desc,updated_at.desc",
      limit: 1,
      filters: { session_id: sessionId }
    });
    const row = rows[0];
    const summary = row ? summaryFromSnapshot(row) : null;
    if (row && summary) {
      return {
        summary,
        origin: "snapshot",
        snapshotId: text(row.id),
        snapshotSource: text(row.snapshot_source),
        snapshotAt: text(row.snapshot_at || row.updated_at)
      };
    }
  }

  return {
    summary: await buildMcpSessionReportSummary(input),
    origin: "live"
  };
}
