import { MCPPage } from "@/features/mcp/MCPPage";
import { createApiClient } from "@/lib/api/api-client";

type VisitsPageProps = {
  searchParams?: {
    routeId?: string;
    date?: string;
  };
};

export default async function Page({ searchParams }: VisitsPageProps) {
  const api = createApiClient();
  const routeId = searchParams?.routeId;
  const date = searchParams?.date;
  const dayQuery = { routeId, date };
  const routeCustomersQuery = routeId ? { routeId } : undefined;

  const [routesResult, dayResult, routeCustomersResult] = await Promise.all([
    api.getRoutesData(),
    api.getMcpDayData(dayQuery),
    api.getRouteCustomersData(routeCustomersQuery)
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
