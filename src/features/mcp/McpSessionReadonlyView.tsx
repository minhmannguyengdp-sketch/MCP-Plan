import type { McpDayData, McpDayLine } from "@/features/mcp-day/mcp-day.types";
import { PageHeader } from "@/ui/layout/PageHeader";
import { AppShell } from "@/ui/shell/AppShell";

function sessionStatusLabel(status: string) {
  if (status === "done" || status === "completed") return "Đã chốt phiên";
  if (status === "cancelled") return "Đã hủy phiên";
  return "Đang chạy";
}

function lineStatusLabel(status: McpDayLine["status"]) {
  if (status === "pending") return "Chờ ghé";
  if (status === "visited") return "Đã ghé";
  if (status === "skipped") return "Bỏ qua";
  return "Hủy";
}

function sourceLabel(source: McpDayLine["source"]) {
  if (source === "added") return "Phát sinh";
  if (source === "synced") return "Đồng bộ";
  return "Khách theo tuyến";
}

function resultSummary(line: McpDayLine) {
  const values = [
    line.hasOrder ? "Có đơn" : null,
    line.hasTest ? "Có test" : null,
    line.hasReport ? "Có báo cáo" : null,
    Number(line.followupCount || 0) > 0 ? `${line.followupCount} follow-up` : null
  ].filter(Boolean);

  return values.length > 0 ? values.join(" · ") : line.result || line.note || "Chưa ghi kết quả";
}

export function McpSessionReadonlyView({ activeHref = "/visits", mcpDayData }: { activeHref?: string; mcpDayData: McpDayData }) {
  const run = mcpDayData.run;
  const lockedLabel = sessionStatusLabel(run.status);
  const visitedCount = mcpDayData.lines.filter((line) => line.status === "visited").length;
  const pendingCount = mcpDayData.lines.filter((line) => line.status === "pending").length;

  return (
    <AppShell activeHref={activeHref}>
      <PageHeader eyebrow="Checklist phiên" title={run.routeName} subtitle={`${run.date} · ${run.owner} · ${mcpDayData.lines.length} khách`} />

      <section className="mcp-gate-banner mcp-session-compact-head">
        <strong>{lockedLabel}</strong>
        <span>Phiên chỉ xem · {visitedCount} đã ghé · {pendingCount} chờ ghé · mở lúc {run.openedAt}</span>
      </section>

      <div className="grid cards">
        {mcpDayData.kpis.map((item) => <article className="card" key={item.label}><div className="card-label">{item.label}</div><div className="card-value">{item.value}</div><p className="card-hint">{item.hint}</p></article>)}
      </div>

      <div className="mcp-line-list">
        {mcpDayData.lines.length === 0 ? <div className="empty-inline">Phiên này chưa có khách trong checklist.</div> : mcpDayData.lines.map((line) => (
          <article className="action-card" key={line.id}>
            <div>
              <span className="badge">{lineStatusLabel(line.status)}</span>
              <h3>{line.accountName}</h3>
              <p>{line.area} · {sourceLabel(line.source)} · {resultSummary(line)}</p>
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
