import { proxyBackendRequest } from "@/lib/api/backend-proxy";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  return proxyBackendRequest(
    request,
    `/api/route-customers/${encodeURIComponent(params.id)}/archive`,
    "POST"
  );
}
