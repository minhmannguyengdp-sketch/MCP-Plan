import { createApiClient } from "@/lib/api/api-client";
import { marketReportsMock } from "./market-reports.mock";
import { MarketReportsClientPage } from "./MarketReportsClientPage";

function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

export async function MarketReportsPage() {
  if (isProductionRuntime()) {
    const api = createApiClient();
    await api.listMarketChecks();
    throw new Error("production_no_mock: /reports is not wired to real market reports API yet");
  }

  return <MarketReportsClientPage kpis={marketReportsMock.kpis} reports={marketReportsMock.reports} />;
}
