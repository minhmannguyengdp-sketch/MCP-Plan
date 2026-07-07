"use client";

import type { McpDayData } from "@/features/mcp-day/mcp-day.types";

export function VisitsExportMenu({ mcpDayData }: { mcpDayData: McpDayData }) {
  const run = mcpDayData.run;
  const params = new URLSearchParams();
  if (run.id) params.set("sessionId", run.id);
  if (run.routeId) params.set("routeId", run.routeId);
  if (run.date) params.set("date", run.date);

  const query = params.toString();
  const checklistHref = `/api/backend/exports/mcp-sessions.csv${query ? `?${query}` : ""}`;
  const pdfHref = `/api/pdf/session-day${query ? `?${query}` : ""}`;

  const shellStyle = {
    position: "fixed",
    right: 16,
    top: 76,
    zIndex: 80,
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
    padding: 6,
    border: "1px solid rgba(22, 163, 74, 0.18)",
    borderRadius: 999,
    background: "rgba(240, 253, 244, 0.94)",
    boxShadow: "0 10px 28px rgba(16, 185, 129, 0.12)",
    backdropFilter: "blur(10px)"
  } as const;

  const labelStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    minHeight: 36,
    borderRadius: 999,
    background: "#dcfce7",
    color: "#15803d",
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1,
    padding: "0 13px",
    whiteSpace: "nowrap"
  } as const;

  const actionStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36,
    border: "1px solid rgba(22, 163, 74, 0.24)",
    borderRadius: 999,
    background: "rgba(255, 255, 255, 0.82)",
    color: "#166534",
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1,
    padding: "0 14px",
    whiteSpace: "nowrap"
  } as const;

  return <nav aria-label="Xuất dữ liệu phiên MCP" style={shellStyle}>
    <span style={labelStyle}>⇩ Xuất phiên</span>
    <a style={actionStyle} href={pdfHref} download>PDF</a>
    <a style={actionStyle} href={checklistHref} download>Excel</a>
  </nav>;
}
