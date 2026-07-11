import { proxyToVps } from "@/app/api/backend/_vps-proxy";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return proxyToVps(request, "/api/mcp-day/session-customer/test");
}
