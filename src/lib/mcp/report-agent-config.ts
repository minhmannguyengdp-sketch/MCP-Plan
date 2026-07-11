export const VERIFIED_MCP_REPORT_AGENT_URL = "https://report-agent-375343885071.asia-southeast1.run.app/analyze";

export function mcpReportAgentUrl() {
  return String(
    process.env.MCP_REPORT_AGENT_URL
    || process.env.AI_AGENT_URL
    || process.env.ADK_AGENT_URL
    || VERIFIED_MCP_REPORT_AGENT_URL
  ).trim();
}

export function mcpReportAgentHealthUrl() {
  return mcpReportAgentUrl().replace(/\/analyze\/?$/, "/health");
}
