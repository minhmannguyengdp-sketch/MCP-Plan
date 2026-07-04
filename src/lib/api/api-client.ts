import { accountsMock } from "@/features/accounts/accounts.mock";
import type { AccountsData } from "@/features/accounts/accounts.types";
import { actionsMock } from "@/features/actions/actions.mock";
import type { ActionsData } from "@/features/actions/actions.types";
import { marketChecksMock } from "@/features/market-checks/market-checks.mock";
import type { MarketChecksData } from "@/features/market-checks/market-checks.types";
import { mcpDayMock } from "@/features/mcp-day/mcp-day.mock";
import type { McpDayActionResult, McpDayAddCustomerPayload, McpDayData, McpDayFollowupPayload, McpDayResultPayload } from "@/features/mcp-day/mcp-day.types";
import { routeCustomersMock } from "@/features/mcp/route-customers.mock";
import type { RouteCustomersData } from "@/features/mcp/route-customers.types";
import { routesMock } from "@/features/routes/routes.mock";
import type { RoutesData } from "@/features/routes/routes.types";
import type { AccountDto, ActionDto, ApiResult, DashboardOverviewDto, DashboardSummaryDto, DayRunDto, ListQuery, MarketCheckDto, OrderDto, RouteDto } from "./api.types";

export type McpApiClient = {
  getDashboardSummary(): Promise<ApiResult<DashboardSummaryDto>>;
  getDashboardOverview(): Promise<ApiResult<DashboardOverviewDto>>;
  listRoutes(query?: ListQuery): Promise<ApiResult<RouteDto[]>>;
  getRoutesData(query?: ListQuery): Promise<ApiResult<RoutesData>>;
  getRouteCustomersData(query?: ListQuery): Promise<ApiResult<RouteCustomersData>>;
  listAccounts(query?: ListQuery): Promise<ApiResult<AccountDto[]>>;
  getAccountsData(query?: ListQuery): Promise<ApiResult<AccountsData>>;
  getCurrentDayRun(query?: ListQuery): Promise<ApiResult<DayRunDto>>;
  getMcpDayData(query?: ListQuery): Promise<ApiResult<McpDayData>>;
  createMcpDayResult(payload: McpDayResultPayload): Promise<ApiResult<McpDayActionResult>>;
  addMcpDayCustomer(payload: McpDayAddCustomerPayload): Promise<ApiResult<McpDayActionResult>>;
  createMcpDayFollowup(payload: McpDayFollowupPayload): Promise<ApiResult<McpDayActionResult>>;
  listMarketChecks(query?: ListQuery): Promise<ApiResult<MarketCheckDto[]>>;
  getMarketChecksData(query?: ListQuery): Promise<ApiResult<MarketChecksData>>;
  listOrders(query?: ListQuery): Promise<ApiResult<OrderDto[]>>;
  listActions(query?: ListQuery): Promise<ApiResult<ActionDto[]>>;
  getActionsData(query?: ListQuery): Promise<ApiResult<ActionsData>>;
};

function result<T>(data: T, source: ApiResult<T>["source"] = "mock"): ApiResult<T> {
  return { data, source, receivedAt: new Date().toISOString() };
}

function toQueryString(query?: ListQuery): string {
  if (!query) return "";
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") params.set(key, String(value));
  });
  const value = params.toString();
  return value ? `?${value}` : "";
}

function getApiBaseUrl(): string | null {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  return value ? value.replace(/\/+$/, "") : null;
}

function hasRouteContext(query?: ListQuery) {
  return Boolean(query?.routeId || query?.route_id);
}

async function fetchJson<T>(baseUrl: string, path: string, query?: ListQuery): Promise<ApiResult<T>> {
  const response = await fetch(`${baseUrl}${path}${toQueryString(query)}`, { cache: "no-store", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`API ${path} failed with ${response.status}`);
  const payload = (await response.json()) as T | { data: T; receivedAt?: string };
  if (payload && typeof payload === "object" && "data" in payload) {
    const wrapped = payload as { data: T; receivedAt?: string };
    return { data: wrapped.data, source: "api", receivedAt: wrapped.receivedAt ?? new Date().toISOString() };
  }
  return result(payload as T, "api");
}

async function postJson<T>(baseUrl: string, path: string, body: unknown): Promise<ApiResult<T>> {
  const response = await fetch(`${baseUrl}${path}`, { method: "POST", cache: "no-store", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = (await response.json().catch(() => ({}))) as T | { data: T; receivedAt?: string; error?: string; detail?: string };
  if (!response.ok) {
    const errorPayload = payload as { error?: string; detail?: string };
    throw new Error(errorPayload.error || `API ${path} failed with ${response.status}`);
  }
  if (payload && typeof payload === "object" && "data" in payload) {
    const wrapped = payload as { data: T; receivedAt?: string };
    return { data: wrapped.data, source: "api", receivedAt: wrapped.receivedAt ?? new Date().toISOString() };
  }
  return result(payload as T, "api");
}

async function withMockFallback<T>(apiRequest: () => Promise<ApiResult<T>>, mockRequest: () => Promise<ApiResult<T>>): Promise<ApiResult<T>> {
  try {
    return await apiRequest();
  } catch {
    return mockRequest();
  }
}

export const mockApiClient: McpApiClient = {
  async getDashboardSummary() { return result({ routeCount: 8, accountCount: 51, visitCount: 73, orderAmount: 403000, actionCount: 9 }); },
  async getDashboardOverview() { return result({ kpis: [{ label: "Doanh so hom nay", value: "403K", hint: "Tu API client", trend: "+12%" }, { label: "Tuyen active", value: 8, hint: "Dang mo", trend: "On dinh" }, { label: "Diem ban", value: 51, hint: "Trong tuyen", trend: "+4 can cham soc" }, { label: "Luot ghe", value: 73, hint: "Da ghi nhan", trend: "72 hoan thanh" }], routeHealth: [{ routeName: "Tuyen trung tam", area: "Cho Gao", planned: 18, visited: 17, orders: 2, status: "good" }, { routeName: "Tuyen phia Dong", area: "My Tho", planned: 14, visited: 11, orders: 0, status: "watch" }, { routeName: "Tuyen ven song", area: "Go Cong", planned: 12, visited: 7, orders: 0, status: "risk" }], actions: [{ title: "Ghe lai nhom khach chua co don", description: "Uu tien diem ban da ghe nhung chua co order.", priority: "high", owner: "Sale" }, { title: "Kiem tra tuyen ven song", description: "Ty le ghe thap hon ke hoach.", priority: "medium", owner: "Giam sat" }], insights: [{ label: "Ty le ghe tham", value: "88%" }, { label: "Ty le co don", value: "2.7%" }, { label: "SKU dang test", value: "33" }, { label: "Nguon", value: "API client" }] }); },
  async listRoutes() { return result([{ id: "route-001", name: "Tuyen Cho Gao", area: "Cho Gao", owner: "Sale A", active: true }, { id: "route-002", name: "Tuyen My Tho", area: "My Tho", owner: "Sale B", active: true }]); },
  async getRoutesData() { return result(routesMock); },
  async getRouteCustomersData() { return result(routeCustomersMock); },
  async listAccounts() { return result([{ id: "acc-001", name: "Diem ban Minh Chau", area: "Cho Gao", routeName: "Tuyen Cho Gao", tier: "A" }, { id: "acc-002", name: "Diem ban Thanh Phat", area: "Cho Gao", routeName: "Tuyen Cho Gao", tier: "B" }]); },
  async getAccountsData() { return result(accountsMock); },
  async getCurrentDayRun() { return result({ id: "day-001", routeName: "Tuyen Cho Gao", date: "2026-07-03", owner: "Sale A", status: "opened" }); },
  async getMcpDayData() { return result(mcpDayMock); },
  async createMcpDayResult(payload) { return result({ payload, mock: true }); },
  async addMcpDayCustomer(payload) { return result({ payload, mock: true }); },
  async createMcpDayFollowup(payload) { return result({ payload, mock: true }); },
  async listMarketChecks() { return result([{ id: "check-001", date: "2026-07-03", routeName: "Tuyen Cho Gao", accountName: "Diem ban Minh Chau", productName: "Sua hop 180ml", status: "opportunity" }]); },
  async getMarketChecksData() { return result(marketChecksMock); },
  async listOrders() { return result([{ id: "order-001", code: "DH-0001", date: "2026-07-03", accountName: "Diem ban Minh Chau", routeName: "Tuyen Cho Gao", owner: "Sale A", source: "MCP session", skuCount: 4, quantity: 36, totalAmount: 2450000, status: "confirmed" }, { id: "order-002", code: "DH-0002", date: "2026-07-03", accountName: "Diem ban Thanh Phat", routeName: "Tuyen Cho Gao", owner: "Sale A", source: "Visit result", skuCount: 3, quantity: 24, totalAmount: 1780000, status: "delivered" }, { id: "order-003", code: "DH-0003", date: "2026-07-02", accountName: "Diem ban Tan Loi", routeName: "Tuyen Cai Be", owner: "Sale B", source: "Phone", skuCount: 5, quantity: 42, totalAmount: 3150000, status: "confirmed" }]); },
  async listActions() { return result([{ id: "act-001", title: "Ghe lai diem ban dong cua", owner: "Sale C", priority: "high", status: "todo", dueDate: "2026-07-04" }]); },
  async getActionsData() { return result(actionsMock); }
};

function createHttpApiClient(baseUrl: string): McpApiClient {
  return {
    getDashboardSummary() { return withMockFallback(() => fetchJson<DashboardSummaryDto>(baseUrl, "/api/dashboard/summary"), () => mockApiClient.getDashboardSummary()); },
    getDashboardOverview() { return withMockFallback(() => fetchJson<DashboardOverviewDto>(baseUrl, "/api/dashboard/overview"), () => mockApiClient.getDashboardOverview()); },
    listRoutes(query) { return withMockFallback(() => fetchJson<RouteDto[]>(baseUrl, "/api/routes", query), () => mockApiClient.listRoutes(query)); },
    getRoutesData(query) { return withMockFallback(() => fetchJson<RoutesData>(baseUrl, "/api/routes/data", query), () => mockApiClient.getRoutesData(query)); },
    getRouteCustomersData(query) { return withMockFallback(() => fetchJson<RouteCustomersData>(baseUrl, "/api/routes/customers/data", query), () => mockApiClient.getRouteCustomersData(query)); },
    listAccounts(query) { return withMockFallback(() => fetchJson<AccountDto[]>(baseUrl, "/api/accounts", query), () => mockApiClient.listAccounts(query)); },
    getAccountsData(query) { return withMockFallback(() => fetchJson<AccountsData>(baseUrl, "/api/accounts/data", query), () => mockApiClient.getAccountsData(query)); },
    getCurrentDayRun(query) { return withMockFallback(() => fetchJson<DayRunDto>(baseUrl, "/api/mcp-day/current", query), () => mockApiClient.getCurrentDayRun(query)); },
    getMcpDayData(query) {
      if (hasRouteContext(query)) return fetchJson<McpDayData>(baseUrl, "/api/mcp-day/data", query);
      return withMockFallback(() => fetchJson<McpDayData>(baseUrl, "/api/mcp-day/data", query), () => mockApiClient.getMcpDayData(query));
    },
    createMcpDayResult(payload) { return postJson<McpDayActionResult>(baseUrl, "/api/mcp-day/session-customer/result", payload); },
    addMcpDayCustomer(payload) { return postJson<McpDayActionResult>(baseUrl, "/api/mcp-day/session-customer/add", payload); },
    createMcpDayFollowup(payload) { return postJson<McpDayActionResult>(baseUrl, "/api/mcp-day/session-customer/followup", payload); },
    listMarketChecks(query) { return withMockFallback(() => fetchJson<MarketCheckDto[]>(baseUrl, "/api/market-checks", query), () => mockApiClient.listMarketChecks(query)); },
    getMarketChecksData(query) { return withMockFallback(() => fetchJson<MarketChecksData>(baseUrl, "/api/market-checks/data", query), () => mockApiClient.getMarketChecksData(query)); },
    listOrders(query) { return withMockFallback(() => fetchJson<OrderDto[]>(baseUrl, "/api/orders", query), () => mockApiClient.listOrders(query)); },
    listActions(query) { return withMockFallback(() => fetchJson<ActionDto[]>(baseUrl, "/api/actions", query), () => mockApiClient.listActions(query)); },
    getActionsData(query) { return withMockFallback(() => fetchJson<ActionsData>(baseUrl, "/api/actions/data", query), () => mockApiClient.getActionsData(query)); }
  };
}

export function createApiClient(): McpApiClient {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) return mockApiClient;
  return createHttpApiClient(apiBaseUrl);
}
