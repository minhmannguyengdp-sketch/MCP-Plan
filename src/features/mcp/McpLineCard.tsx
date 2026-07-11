import type { McpDayLine } from "@/features/mcp-day/mcp-day.types";
import { type McpCustomerAction } from "./mcp-customer-actions";
import styles from "./McpLineCard.module.css";

function sourceLabel(source: McpDayLine["source"]) {
  if (source === "planned") return "Tuyến gốc";
  if (source === "added") return "Phát sinh";
  return "Đồng bộ";
}

function statusLabel(status: McpDayLine["status"]) {
  if (status === "pending") return "Chờ ghé";
  if (status === "visited") return "Đã ghé";
  if (status === "skipped") return "Bỏ qua / không mua";
  return "Hủy";
}

function statusClass(status: McpDayLine["status"]) {
  if (status === "visited") return styles.visited;
  if (status === "pending") return styles.pending;
  if (status === "skipped") return styles.skipped;
  return styles.cancelled;
}

function resultSummary(line: McpDayLine) {
  const done = [
    line.hasOrder ? "Có đơn" : null,
    line.hasTest ? "Có test" : null,
    line.hasReport ? "Có quan sát" : null,
    Number(line.followupCount || 0) > 0 ? `${line.followupCount} follow-up` : null
  ].filter(Boolean);

  return done.length > 0 ? done.join(" · ") : line.result || line.note || "Chưa ghi kết quả";
}

function actionItems(): Array<{ label: string; action: McpCustomerAction; tone?: "primary" }> {
  return [
    { label: "Tạo đơn", action: "order", tone: "primary" },
    { label: "Ghi test", action: "test" },
    { label: "Quan sát", action: "market_report" },
    { label: "Follow-up", action: "follow_up" },
    { label: "Bỏ qua / không mua", action: "skip" }
  ];
}

export function McpLineCard({
  line,
  onOpen,
  onAction
}: {
  line: McpDayLine;
  onOpen: (line: McpDayLine) => void;
  onAction: (line: McpDayLine, action: McpCustomerAction) => void;
}) {
  return (
    <article className={`${styles.card} ${statusClass(line.status)}`}>
      <button className={styles.main} type="button" onClick={() => onOpen(line)}>
        <span className={styles.index}>#{line.sortOrder || "-"}</span>
        <span className={styles.identity}>
          <strong>{line.accountName}</strong>
          <small>{line.area} · {sourceLabel(line.source)}</small>
        </span>
        <span className={styles.summary}>{resultSummary(line)}</span>
      </button>
      <span className={styles.badge}>{statusLabel(line.status)}</span>
      <div className={styles.actions}>
        {actionItems().map((item) => (
          <button className={item.tone === "primary" ? `${styles.action} button primary` : styles.action} type="button" key={item.action} onClick={() => onAction(line, item.action)}>
            {item.label}
          </button>
        ))}
      </div>
    </article>
  );
}
