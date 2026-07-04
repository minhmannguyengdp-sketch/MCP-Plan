import { MCPPage } from "@/features/mcp/MCPPage";
import { createApiClient } from "@/lib/api/api-client";

export default async function Page({ params, searchParams }: { params: { routeId: string }; searchParams?: { date?: string } }) {
  const api = createApiClient();
  const routeId = params.routeId;
  const date = searchParams?.date || new Date().toISOString().slice(0, 10);

  const [routesResult, dayResult, routeCustomersResult] = await Promise.all([
    api.getRoutesData(),
    api.getMcpDayData({ routeId, date }),
    api.getRouteCustomersData({ routeId })
  ]);

  return (
    <MCPPage
      activeHref="/visits"
      routesData={routesResult.data}
      mcpDayData={dayResult.data}
      routeCustomersData={routeCustomersResult.data}
    />
  );
}
