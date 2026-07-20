import { createApiClient } from "@/lib/api/api-client";
import { loadOrderSessionOptions } from "./load-order-session-options";
import { OrdersClientPage } from "./OrdersClientPage";

export async function OrdersPage() {
  const api = createApiClient();
  const [ordersResult, routeCustomersResult] = await Promise.all([
    api.listOrders(),
    api.getRouteCustomersData()
  ]);
  const customers = routeCustomersResult.data.customers;
  const sessions = await loadOrderSessionOptions(customers.map((customer) => customer.routeId));

  return (
    <OrdersClientPage
      ordersResult={ordersResult}
      customers={customers}
      sessions={sessions}
    />
  );
}
