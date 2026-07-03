import type { McpDayLine } from "@/features/mcp-day/mcp-day.types";
import { MCP_CUSTOMER_ACTIONS, mcpCustomerActionLabel, type McpCustomerAction } from "./mcp-customer-actions";

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
    <article className="action-card">
      <div>
        <span className="badge">MCPCustomerCard · STT {line.sortOrder}</span>
        <h3>{line.accountName}</h3>
        <p className="page-subtitle">{line.area} · {line.hasOrder ? "Da co don" : "Chua co don"} · {line.note}</p>
        <div className="sheet-action-grid" style={{ marginTop: 12 }}>
          <button className="button primary" type="button" onClick={() => onOpen(line)}>Xu ly</button>
          {MCP_CUSTOMER_ACTIONS.map((action) => (
            <button className="button" type="button" key={action} onClick={() => onAction(line, action)}>
              {mcpCustomerActionLabel(action)}
            </button>
          ))}
        </div>
      </div>
      <strong>{line.result ?? "MCP"}</strong>
    </article>
  );
}
