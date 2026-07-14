import { proxyBackendRequest } from "@/lib/api/backend-proxy";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return proxyBackendRequest(request, "/api/mcp-market-reports", "POST");
}
