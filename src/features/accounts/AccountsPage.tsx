import { createApiClient } from "@/lib/api/api-client";
import { OutletsClientPage } from "./OutletsClientPage";

export async function AccountsPage() {
  const api = createApiClient();
  const accountsResult = await api.getAccountsData();

  return <OutletsClientPage kpis={accountsResult.data.kpis} items={accountsResult.data.accounts} />;
}
