export type MarketReportStatus = "normal" | "opportunity" | "risk";

export type MarketReportType = "price" | "competitor" | "display" | "stock";

export type MarketReportItem = {
  id: string;
  date: string;
  routeName: string;
  accountName: string;
  reportType: MarketReportType;
  subject: string;
  competitorName?: string;
  price?: number;
  note: string;
  nextAction: string;
  status: MarketReportStatus;
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
