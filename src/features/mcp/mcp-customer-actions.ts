export type McpCustomerAction = "order" | "test" | "market_report" | "follow_up";

export function mcpCustomerActionLabel(action: McpCustomerAction) {
  if (action === "order") return "Ghi có đơn";
  if (action === "test") return "Ghi có test";
  if (action === "market_report") return "Ghi báo cáo";
  return "Tạo follow-up";
}

export function mcpCustomerActionDescription(action: McpCustomerAction) {
  if (action === "order") return "Ghi nhận khách có đơn trong phiên MCP ngày.";
  if (action === "test") return "Ghi nhận khách có test sản phẩm trong phiên MCP ngày.";
  if (action === "market_report") return "Ghi nhận báo cáo thị trường gắn với khách trong phiên.";
  return "Tạo việc theo dõi gắn với session customer snapshot.";
}

export const MCP_CUSTOMER_ACTIONS: McpCustomerAction[] = ["order", "test", "market_report", "follow_up"];
