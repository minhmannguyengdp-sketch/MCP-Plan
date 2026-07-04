"use client";

import type { McpDayData } from "@/features/mcp-day/mcp-day.types";
import type { RouteCustomersData } from "@/features/mcp/route-customers.types";
import type { RoutesData } from "@/features/routes/routes.types";
import { McpSessionCompactView } from "./McpSessionCompactView";
import { McpMasterView } from "./McpMasterView";

type MCPPageProps = {
  activeHref?: string;
  routesData: RoutesData;
  routeCustomersData: RouteCustomersData;
  mcpDayData?: McpDayData;
};

export function MCPPage({ activeHref = "/visits", routesData, mcpDayData, routeCustomersData }: MCPPageProps) {
  if (activeHref === "/visits") {
    if (!mcpDayData) {
      throw new Error("mcpDayData is required for /visits");
    }

    return <McpSessionCompactView activeHref={activeHref} routesData={routesData} mcpDayData={mcpDayData} routeCustomersData={routeCustomersData} />;
  }

  return <McpMasterView activeHref={activeHref} routesData={routesData} routeCustomersData={routeCustomersData} />;
}
