import { marketChecksMock } from "./market-checks.mock";
import { MarketChecksClientPage } from "./MarketChecksClientPage";

export function MarketChecksPage() {
  return <MarketChecksClientPage kpis={marketChecksMock.kpis} checks={marketChecksMock.checks} />;
}
