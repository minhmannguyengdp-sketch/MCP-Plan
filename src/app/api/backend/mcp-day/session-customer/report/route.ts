export const dynamic = "force-dynamic";

type BackendError = { error?: string; message?: string; detail?: string };

function backendBaseUrl() {
  const value = String(process.env.BACKEND_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "").trim();
  return value ? value.replace(/\/+$/, "") : null;
}

async function readJson(response: Response) {
  return response.json().catch(() => ({}));
}

export async function POST(request: Request) {
  const baseUrl = backendBaseUrl();

  if (!baseUrl) {
    return Response.json(
      { ok: false, error: "missing_backend_api_base_url" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const body = await request.text();
    const response = await fetch(`${baseUrl}/api/mcp-day/session-customer/report`, {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": request.headers.get("content-type") || "application/json"
      },
      body
    });

    const payload = await readJson(response);

    if (!response.ok) {
      const errorPayload = payload as BackendError;
      return Response.json(
        {
          ok: false,
          error: errorPayload.error || errorPayload.message || errorPayload.detail || `backend_${response.status}`,
          detail: errorPayload.detail || null
        },
        { status: response.status, headers: { "Cache-Control": "no-store" } }
      );
    }

    return Response.json(payload, { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "mcp_report_proxy_failed" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
