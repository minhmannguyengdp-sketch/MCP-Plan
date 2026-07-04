import { MCPPage } from "@/features/mcp/MCPPage";
import { createApiClient } from "@/lib/api/api-client";

export default async function Page() {
  const api = createApiClient();
  const [routesResult, routeCustomersResult] = await Promise.all([
    api.getRoutesData(),
    api.getRouteCustomersData()
  ]);

  return (
    <MCPPage
      activeHref="/routes"
      routesData={routesResult.data}
      routeCustomersData={routeCustomersResult.data}
    />
  );
}
