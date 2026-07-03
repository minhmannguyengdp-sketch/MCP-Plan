import { MCPPage } from "@/features/mcp/MCPPage";
import { createApiClient } from "@/lib/api/api-client";

export default async function Page() {
  const api = createApiClient();
  const routesResult = await api.getRoutesData();
  const mcpDayResult = await api.getMcpDayData();

  return <MCPPage activeHref="/routes" routesData={routesResult.data} mcpDayData={mcpDayResult.data} />;
}
