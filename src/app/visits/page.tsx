import { MCPPage } from "@/features/mcp/MCPPage";
import { createApiClient } from "@/lib/api/api-client";

export default async function Page(props: any) {
  const api = createApiClient();
  const routeId = props?.searchParams?.routeId;
  const date = props?.searchParams?.date;
  const dayQuery = routeId ? { routeId, date } : undefined;
  const customerQuery = routeId ? { routeId } : undefined;

  const routesResult = await api.getRoutesData();
  const dayResult = await api.getMcpDayData(dayQuery);
  const routeCustomersResult = await api.getRouteCustomersData(customerQuery);

  return (
    <MCPPage
      activeHref="/visits"
      routesData={routesResult.data}
      mcpDayData={dayResult.data}
      routeCustomersData={routeCustomersResult.data}
    />
  );
}
