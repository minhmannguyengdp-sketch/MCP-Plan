export type ApiResult<T> = {
  data: T;
  source: "mock" | "api";
  receivedAt: string;
};

export type ListQuery = {
  dateFrom?: string;
  dateTo?: string;
  routeId?: string;
  ownerId?: string;
  status?: string;
  search?: string;
};

export type DashboardSummaryDto = {
  routeCount: number;
  accountCount: number;
  visitCount: number;
  orderAmount: number;
  actionCount: number;
};

export type RouteDto = {
  id: string;
  name: string;
  area: string;
  owner: string;
  active: boolean;
};

export type AccountDto = {
  id: string;
  name: string;
  area: string;
  routeName: string;
  tier: string;
};

export type DayRunDto = {
  id: string;
  routeName: string;
  date: string;
  owner: string;
  status: string;
};

export type MarketCheckDto = {
  id: string;
  date: string;
  routeName: string;
  accountName: string;
  productName: string;
  status: string;
};

export type OrderDto = {
  id: string;
  code: string;
  date: string;
  accountName: string;
  routeName: string;
  owner: string;
  source: string;
  skuCount: number;
  quantity: number;
  totalAmount: number;
  status: string;
};

export type ActionDto = {
  id: string;
  title: string;
  owner: string;
  priority: string;
  status: string;
  dueDate: string;
};
