"use client";

import type { McpDayData } from "@/features/mcp-day/mcp-day.types";
import type { RouteCustomersData } from "@/features/mcp/route-customers.types";
import type { RoutesData } from "@/features/routes/routes.types";
import { McpSessionCompactView } from "./McpSessionCompactView";
import { McpMasterView } from "./McpMasterView";

export function MCPPage({ activeHref = "/visits", routesData, mcpDayData, routeCustomersData }: { activeHref?: string; routesData: RoutesData; mcpDayData: McpDayData; routeCustomersData: RouteCustomersData }) {
  if (activeHref === "/visits") {
    return <McpSessionCompactView activeHref={activeHref} routesData={routesData} mcpDayData={mcpDayData} routeCustomersData={routeCustomersData} />;
  }

  return <McpMasterView activeHref={activeHref} routesData={routesData} routeCustomersData={routeCustomersData} />;
}
