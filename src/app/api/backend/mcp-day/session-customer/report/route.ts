export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const target = String(process.env.BACKEND_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "").trim().replace(/\/+$/, "");
  if (!target) return Response.json({ ok: false, error: "missing_backend_api_base_url" }, { status: 500 });
  const upstream = await fetch(target + "/api/mcp-day/session-customer/report", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: await request.text()
  });
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
