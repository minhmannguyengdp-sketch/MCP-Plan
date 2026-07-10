import { marketReportsMock } from "./market-reports.mock";
import { MarketReportsClientPage } from "./MarketReportsClientPage";

function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

export function MarketReportsPage() {
  if (isProductionRuntime()) {
    throw new Error("production_no_mock: /reports is not wired to real market reports API yet");
  }

  return <MarketReportsClientPage kpis={marketReportsMock.kpis} reports={marketReportsMock.reports} />;
}
