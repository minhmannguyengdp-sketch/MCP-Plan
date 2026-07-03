import type {
  AccountDto,
  ActionDto,
  ApiResult,
  DashboardOverviewDto,
  DashboardSummaryDto,
  DayRunDto,
  ListQuery,
  MarketCheckDto,
  OrderDto,
  RouteDto
} from "./api.types";

export type McpApiClient = {
  getDashboardSummary(): Promise<ApiResult<DashboardSummaryDto>>;
  getDashboardOverview(): Promise<ApiResult<DashboardOverviewDto>>;
  listRoutes(query?: ListQuery): Promise<ApiResult<RouteDto[]>>;
  listAccounts(query?: ListQuery): Promise<ApiResult<AccountDto[]>>;
  getCurrentDayRun(query?: ListQuery): Promise<ApiResult<DayRunDto>>;
  listMarketChecks(query?: ListQuery): Promise<ApiResult<MarketCheckDto[]>>;
  listOrders(query?: ListQuery): Promise<ApiResult<OrderDto[]>>;
  listActions(query?: ListQuery): Promise<ApiResult<ActionDto[]>>;
};

function result<T>(data: T, source: ApiResult<T>["source"] = "mock"): ApiResult<T> {
  return {
    data,
    source,
    receivedAt: new Date().toISOString()
  };
}

export const mockApiClient: McpApiClient = {
  async getDashboardSummary() {
    return result({ routeCount: 8, accountCount: 51, visitCount: 73, orderAmount: 403000, actionCount: 9 });
  },
  async getDashboardOverview() {
    return result({
      kpis: [
        { label: "Doanh so hom nay", value: "403K", hint: "Tu API client", trend: "+12%" },
        { label: "Tuyen active", value: 8, hint: "Dang mo", trend: "On dinh" },
        { label: "Diem ban", value: 51, hint: "Trong tuyen", trend: "+4 can cham soc" },
        { label: "Luot ghe", value: 73, hint: "Da ghi nhan", trend: "72 hoan thanh" }
      ],
      routeHealth: [
        { routeName: "Tuyen trung tam", area: "Cho Gao", planned: 18, visited: 17, orders: 2, status: "good" },
        { routeName: "Tuyen phia Dong", area: "My Tho", planned: 14, visited: 11, orders: 0, status: "watch" },
        { routeName: "Tuyen ven song", area: "Go Cong", planned: 12, visited: 7, orders: 0, status: "risk" }
      ],
      actions: [
        { title: "Ghe lai nhom khach chua co don", description: "Uu tien diem ban da ghe nhung chua co order.", priority: "high", owner: "Sale" },
        { title: "Kiem tra tuyen ven song", description: "Ty le ghe thap hon ke hoach.", priority: "medium", owner: "Giam sat" }
      ],
      insights: [
        { label: "Ty le ghe tham", value: "88%" },
        { label: "Ty le co don", value: "2.7%" },
        { label: "SKU dang test", value: "33" },
        { label: "Nguon", value: "API client" }
      ]
    });
  },
  async listRoutes() {
    return result([
      { id: "route-001", name: "Tuyen Cho Gao", area: "Cho Gao", owner: "Sale A", active: true },
      { id: "route-002", name: "Tuyen My Tho", area: "My Tho", owner: "Sale B", active: true }
    ]);
  },
  async listAccounts() {
    return result([
      { id: "acc-001", name: "Diem ban Minh Chau", area: "Cho Gao", routeName: "Tuyen Cho Gao", tier: "A" },
      { id: "acc-002", name: "Diem ban Thanh Phat", area: "Cho Gao", routeName: "Tuyen Cho Gao", tier: "B" }
    ]);
  },
  async getCurrentDayRun() {
    return result({ id: "day-001", routeName: "Tuyen Cho Gao", date: "2026-07-03", owner: "Sale A", status: "opened" });
  },
  async listMarketChecks() {
    return result([
      { id: "check-001", date: "2026-07-03", routeName: "Tuyen Cho Gao", accountName: "Diem ban Minh Chau", productName: "Sua hop 180ml", status: "opportunity" }
    ]);
  },
  async listOrders() {
    return result([
      { id: "order-001", code: "DH-0001", date: "2026-07-03", accountName: "Diem ban Minh Chau", routeName: "Tuyen Cho Gao", owner: "Sale A", source: "MCP session", skuCount: 4, quantity: 36, totalAmount: 2450000, status: "confirmed" },
      { id: "order-002", code: "DH-0002", date: "2026-07-03", accountName: "Diem ban Thanh Phat", routeName: "Tuyen Cho Gao", owner: "Sale A", source: "Visit result", skuCount: 3, quantity: 24, totalAmount: 1780000, status: "delivered" },
      { id: "order-003", code: "DH-0003", date: "2026-07-02", accountName: "Diem ban Tan Loi", routeName: "Tuyen Cai Be", owner: "Sale B", source: "Phone", skuCount: 5, quantity: 42, totalAmount: 3150000, status: "confirmed" }
    ]);
  },
  async listActions() {
    return result([
      { id: "act-001", title: "Ghe lai diem ban dong cua", owner: "Sale C", priority: "high", status: "todo", dueDate: "2026-07-04" }
    ]);
  }
};

export function createApiClient(): McpApiClient {
  return mockApiClient;
}
