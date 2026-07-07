export const dynamic = "force-dynamic";

const LOCAL_NEEDS_GPS_FILE = "route-customers-needs-gps.csv";
const ALLOWED = new Set([
  "route-customers.csv",
  LOCAL_NEEDS_GPS_FILE,
  "mcp-sessions.csv",
  "orders.csv",
  "market-reports.csv",
  "followups.csv",
  "tests.csv"
]);

function backendBaseUrl() {
  const value = String(process.env.BACKEND_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "").trim();
  return value ? value.replace(/\/+$/, "") : null;
}

export async function GET(request: Request, context: { params: { file: string } }) {
  const file = context.params.file;
  if (!ALLOWED.has(file)) return Response.json({ ok: false, error: "export_not_allowed" }, { status: 404 });

  if (file === LOCAL_NEEDS_GPS_FILE) {
    const route = await import("@/app/api/exports/route-customers-needs-gps.csv/route");
    return route.GET(request);
  }

  const baseUrl = backendBaseUrl();
  if (!baseUrl) return Response.json({ ok: false, error: "missing_backend_api_base_url" }, { status: 500 });

  try {
    const url = new URL(request.url);
    const response = await fetch(`${baseUrl}/api/exports/${file}${url.search}`, { cache: "no-store", headers: { Accept: "text/csv,*/*" } });
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "text/csv; charset=utf-8",
        "Content-Disposition": response.headers.get("content-disposition") || `attachment; filename="${file}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "export_proxy_failed" }, { status: 502 });
  }
}
