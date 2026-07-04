import type { McpDayLine } from "@/features/mcp-day/mcp-day.types";
import { OperationalListCard } from "@/ui/cards/OperationalListCard";
import { type McpCustomerAction } from "./mcp-customer-actions";

function sourceLabel(source: McpDayLine["source"]) {
  if (source === "planned") return "Tuyến gốc";
  if (source === "added") return "Phát sinh";
  return "Đồng bộ";
}

function statusLabel(status: McpDayLine["status"]) {
  if (status === "pending") return "Chờ ghé";
  if (status === "visited") return "Đã ghé";
  if (status === "skipped") return "Bỏ qua";
  return "Hủy";
}

function statusClass(status: McpDayLine["status"]) {
  if (status === "visited") return "mcp-line-status visited";
  if (status === "pending") return "mcp-line-status pending";
  if (status === "skipped") return "mcp-line-status skipped";
  return "mcp-line-status cancelled";
}

function resultSummary(line: McpDayLine) {
  const done = [
    line.hasOrder ? "Đơn" : null,
    line.hasTest ? "Test" : null,
    line.hasReport ? "Báo cáo" : null,
    Number(line.followupCount || 0) > 0 ? `${line.followupCount} việc` : null
  ].filter(Boolean);

  return done.length > 0 ? done.join(" · ") : "Chưa phát sinh kết quả";
}

function sessionCustomerLabel(line: McpDayLine) {
  return line.sessionCustomerId ? `SC ${line.sessionCustomerId}` : `Line ${line.id}`;
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
    <OperationalListCard
      leading={<span>#{line.sortOrder}</span>}
      eyebrow={`${line.area} · ${sourceLabel(line.source)}`}
      title={line.accountName}
      description={line.result || line.note || "Khách trong phiên MCP ngày"}
      badge={<span className={statusClass(line.status)}>{statusLabel(line.status)}</span>}
      meta={[sessionCustomerLabel(line), resultSummary(line)]}
      actions={[
        { label: "Mở xử lý", tone: "primary", onClick: () => onOpen(line) },
        { label: line.hasOrder ? "Ghi tiếp" : "Ghi đơn", onClick: () => onAction(line, "order") }
      ]}
    />
  );
}
