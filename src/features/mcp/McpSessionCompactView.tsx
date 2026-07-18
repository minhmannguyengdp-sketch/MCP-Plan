"use client";

import { OrderQuantityStepperEnhancer } from "@/ui/shell/OrderQuantityStepperEnhancer";
import { MobileAppMenuProvider } from "@/ui/shell/MobileAppMenu";
import { McpSessionCompactView as InnerMcpSessionCompactView } from "./McpSessionCompactViewFinal2";
import { McpRouteDirectionsProvider } from "./McpRouteDirectionsContext";
import { VisitsSessionReportPanel } from "./VisitsSessionReportPanel";
import type { McpDayData } from "@/features/mcp-day/mcp-day.types";
import type { RouteCustomersData } from "@/features/mcp/route-customers.types";
import type { RoutesData } from "@/features/routes/routes.types";

export function McpSessionCompactView(props: { activeHref?: string; routesData: RoutesData; mcpDayData: McpDayData; routeCustomersData: RouteCustomersData }) {
  return (
    <MobileAppMenuProvider>
      <McpRouteDirectionsProvider routeCustomersData={props.routeCustomersData}>
        <OrderQuantityStepperEnhancer />
        <VisitsSessionReportPanel mcpDayData={props.mcpDayData} />
        <InnerMcpSessionCompactView {...props} />
      </McpRouteDirectionsProvider>
    </MobileAppMenuProvider>
  );
}
