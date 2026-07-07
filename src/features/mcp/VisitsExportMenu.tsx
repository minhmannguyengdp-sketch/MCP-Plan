"use client";

import type { McpDayData } from "@/features/mcp-day/mcp-day.types";

export function VisitsExportMenu({ mcpDayData }: { mcpDayData: McpDayData }) {
  const run = mcpDayData.run;
  const sessionId = encodeURIComponent(run.id || "");
  const routeId = encodeURIComponent(run.routeId || "");
  const date = encodeURIComponent(run.date || "");
  const checklistHref = run.id ? `/api/backend/exports/mcp-sessions.csv?sessionId=${sessionId}` : `/api/backend/exports/mcp-sessions.csv?routeId=${routeId}`;
  const pdfHref = run.id ? `/api/pdf/session-day?sessionId=${sessionId}` : `/api/pdf/session-day?routeId=${routeId}&date=${date}`;
  return <details style={{ position: "fixed", right: 16, top: 86, zIndex: 80 }}>
    <summary className="button" style={{ listStyle: "none", cursor: "pointer" }}>Xuất phiên ▾</summary>
    <div style={{ width: 240, marginTop: 8, padding: 10, border: "1px solid var(--line)", borderRadius: 14, background: "var(--panel)", boxShadow: "var(--shadow)", display: "grid", gap: 8 }}>
      <a className="button primary" href={checklistHref} target="_blank" rel="noreferrer">Excel checklist phiên</a>
      <a className="button" href={pdfHref} target="_blank" rel="noreferrer">PDF báo cáo phiên</a>
    </div>
  </details>;
}
