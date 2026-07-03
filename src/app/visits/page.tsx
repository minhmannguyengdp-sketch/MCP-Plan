import { MCPPage } from "@/features/mcp/MCPPage";
import { createApiClient } from "@/lib/api/api-client";

export default async function Page() {
  const api = createApiClient();
  const routesResult = await api.getRoutesData();
  const dayResult = await api.getMcpDayData();
  const routeCustomersResult = await api.getRouteCustomersData();

  return (
    <MCPPage
      activeHref="/visits"
      routesData={routesResult.data}
      mcpDayData={dayResult.data}
      routeCustomersData={routeCustomersResult.data}
    />
  );
}
