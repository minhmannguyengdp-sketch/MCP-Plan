import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const [filterSource, routesPage, mcpHome, dashboardOverview, sessionLoader] = await Promise.all([
  readFile(new URL("../src/lib/data/internal-smoke.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app/routes/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/mcp/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/dashboard/persisted-overview.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/mcp-sessions/load-mcp-sessions.ts", import.meta.url), "utf8")
]);

test("internal production smoke names are recognized only by exact reserved prefixes", () => {
  assert.match(filterSource, /__NPP_F05_RUNTIME_SMOKE__/);
  assert.match(filterSource, /__MCP_V1_API_FULL__/);
  assert.match(filterSource, /startsWith\(prefix\)/);
  assert.doesNotMatch(filterSource, /includes\(prefix\)/);
});

test("route management and MCP home remove smoke routes before rendering totals or cards", () => {
  assert.match(routesPage, /withoutInternalSmokeRows\(routesResult\.data\.routes\)/);
  assert.match(routesPage, /routeIds\.has\(customer\.routeId\)/);
  assert.match(routesPage, /!isInternalSmokeRecord\(customer\)/);
  assert.match(mcpHome, /withoutInternalSmokeRows\(routesResult\.data\.routes\)/);
});

test("dashboard never promotes a future smoke session or route into the operational hero", () => {
  assert.match(dashboardOverview, /const leftSmoke = isInternalSmokeRecord\(left\)/);
  assert.match(dashboardOverview, /if \(leftSmoke !== rightSmoke\) return leftSmoke \? 1 : -1/);
  assert.match(dashboardOverview, /const visibleRoutes = routes\.filter/);
  assert.match(dashboardOverview, /const visibleSessions = sessions\.filter/);
  assert.match(dashboardOverview, /const visibleReports = reports\.filter/);
});

test("MCP session history excludes smoke routes, sessions and their counters", () => {
  assert.match(sessionLoader, /const visibleRoutes = withoutInternalSmokeRows\(routesRaw\)/);
  assert.match(sessionLoader, /!isInternalSmokeRecord\(session\)/);
  assert.match(sessionLoader, /visibleRouteIds\.has\(text\(session\.route_id\)\)/);
  assert.match(sessionLoader, /const sessions = scopedSessions/);
});
