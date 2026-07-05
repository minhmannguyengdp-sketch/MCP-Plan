"use client";

import { OrderQuantityStepperEnhancer } from "@/ui/shell/OrderQuantityStepperEnhancer";
import { McpSessionCompactView as InnerMcpSessionCompactView } from "./McpSessionCompactViewFinal2";
import type { McpDayData } from "@/features/mcp-day/mcp-day.types";
import type { RouteCustomersData } from "@/features/mcp/route-customers.types";
import type { RoutesData } from "@/features/routes/routes.types";

export function McpSessionCompactView(props: { activeHref?: string; routesData: RoutesData; mcpDayData: McpDayData; routeCustomersData: RouteCustomersData }) {
  return <><OrderQuantityStepperEnhancer /><InnerMcpSessionCompactView {...props} /></>;
}
