import { createApiClient } from "@/lib/api/api-client";
import { loadMcpSessions } from "@/lib/mcp-sessions/load-mcp-sessions";
import type { OrderSessionOption } from "./order-create.types";
import { OrdersClientPage } from "./OrdersClientPage";

const VN_TIME_ZONE = "Asia/Ho_Chi_Minh";

function vnDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((item) => item.type === "year")?.value || "";
  const month = parts.find((item) => item.type === "month")?.value || "";
  const day = parts.find((item) => item.type === "day")?.value || "";
  return `${year}-${month}-${day}`;
}

export async function OrdersPage() {
  const api = createApiClient();
  const [ordersResult, routeCustomersResult, sessionsPayload] = await Promise.all([
    api.listOrders(),
    api.getRouteCustomersData(),
    loadMcpSessions({
      dateFrom: vnDate(-180),
      dateTo: vnDate(),
      routeId: "",
      status: ""
    })
  ]);

  const sessions: OrderSessionOption[] = sessionsPayload.sessions
    .filter((session) => session.status !== "cancelled")
    .map((session) => ({
      id: session.id,
      routeId: session.routeId,
      routeName: session.routeName,
      sessionDate: session.sessionDate,
      status: session.status === "active" ? "active" : "done",
      plannedCustomers: session.plannedCustomers,
      visitedCustomers: session.visitedCustomers
    }));

  return (
    <OrdersClientPage
      ordersResult={ordersResult}
      customers={routeCustomersResult.data.customers}
      sessions={sessions}
    />
  );
}
