export type MarketReportStatus = "normal" | "opportunity" | "risk";

export type MarketReportType = "price" | "competitor" | "display" | "stock";

export type SessionReportOverview = {
  planned: number;
  visited: number;
  pending: number;
  skipped: number;
  observations: number;
  orders: number;
  tests: number;
  followups: number;
};

export type CountItem = {
  label: string;
  count: number;
};

export type SessionReportOrder = {
  id: string;
  code?: string;
  customerName?: string;
  status?: string;
  total?: number;
  note?: string;
};

export type SessionReportTest = {
  id: string;
  customerName?: string;
  productName?: string;
  status?: string;
  note?: string;
};

export type SessionReportFollowup = {
  id: string;
  title?: string;
  customerName?: string;
  dueDate?: string;
  status?: string;
  priority?: string;
  owner?: string;
  note?: string;
};

export type SessionReportObservation = {
  id?: string;
  customerName?: string;
  note?: string;
  summary?: string;
  competitors?: string[];
  usedProducts?: string[];
};

export type SessionReportCustomer = {
  id?: string;
  customerName?: string;
  status?: string;
  orderId?: string;
  testId?: string;
  reportId?: string;
  followupCount?: number;
  note?: string;
};

export type SessionReportSections = {
  overview: SessionReportOverview;
  competitors: CountItem[];
  usedProducts: CountItem[];
  opportunities: string[];
  risks: string[];
  nextActions: string[];
  observations: SessionReportObservation[];
  orders: SessionReportOrder[];
  tests: SessionReportTest[];
  followups: SessionReportFollowup[];
  skipped: SessionReportCustomer[];
  customers?: SessionReportCustomer[];
};

export type MarketReportItem = {
  id: string;
  sessionId: string;
  routeId?: string;
  date: string;
  routeName: string;
  sales?: string;
  accountName: string;
  reportType: MarketReportType;
  subject: string;
  competitorName?: string;
  price?: number;
  note: string;
  nextAction: string;
  status: MarketReportStatus;
  snapshotSource?: string;
  snapshotAt?: string;
  overview: SessionReportOverview;
  sections: SessionReportSections;
};

export type MarketReportKpi = {
  label: string;
  value: string | number;
  hint: string;
};

export type MarketReportsData = {
  kpis: MarketReportKpi[];
  reports: MarketReportItem[];
};