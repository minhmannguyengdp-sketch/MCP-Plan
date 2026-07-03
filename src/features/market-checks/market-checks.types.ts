export type MarketCheckStatus = "normal" | "opportunity" | "risk";

export type MarketCheckItem = {
  id: string;
  date: string;
  routeName: string;
  accountName: string;
  productName: string;
  competitorName: string;
  shelfPrice: number;
  stockStatus: string;
  note: string;
  status: MarketCheckStatus;
};

export type MarketCheckKpi = {
  label: string;
  value: string | number;
  hint: string;
};

export type MarketChecksData = {
  kpis: MarketCheckKpi[];
  checks: MarketCheckItem[];
};
