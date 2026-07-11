export const dynamic = "force-dynamic";

const DEFAULT_BACKEND_API_BASE_URL = "http://165.22.109.61";

function backendBaseUrl() {
  return String(
    process.env.BACKEND_API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      DEFAULT_BACKEND_API_BASE_URL
  )
    .trim()
    .replace(/\/+$/, "");
}

function sessionId(value: unknown) {
  return String(value ?? "").trim();
}

function errorStatus(message: string) {
  if (message.includes("session_not_found")) return 404;
  if (
    message.includes("session_has_activity") ||
    message.includes("session_closed")
  ) {
    return 409;
  }
  if (message.includes("backend_unavailable")) return 502;
  return 400;
}

async function proxySessionMutation(
  request: Request,
  id: string,
  method: "PATCH" | "DELETE"
) {
  const headers: HeadersInit = { Accept: "application/json" };
  let body: string | undefined;

  if (method === "PATCH") {
    headers["Content-Type"] = "application/json";
    body = await request.text();
  }

  let response: Response;
  try {
    response = await fetch(
      `${backendBaseUrl()}/api/mcp-sessions/${encodeURIComponent(id)}`,
      {
        method,
        cache: "no-store",
        headers,
        body
      }
    );
  } catch {
    throw new Error("backend_unavailable");
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = String(
      payload.error || payload.message || `backend_${response.status}`
    );
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  return payload;
}

async function handle(
  request: Request,
  params: { id: string },
  method: "PATCH" | "DELETE"
) {
  try {
    const id = sessionId(params.id);
    if (!id) throw new Error("session_id_required");

    const payload = await proxySessionMutation(request, id, method);
    return Response.json(payload, {
      status: 200,
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "mcp_session_mutation_failed";
    const status =
      typeof (error as { status?: unknown })?.status === "number"
        ? Number((error as { status: number }).status)
        : errorStatus(message);

    return Response.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  return handle(request, params, "PATCH");
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  return handle(request, params, "DELETE");
}
