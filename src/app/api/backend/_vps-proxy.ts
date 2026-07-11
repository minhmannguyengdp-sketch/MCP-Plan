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

export async function proxyToVps(request: Request, path: string) {
  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD" && method !== "DELETE";
  const headers: HeadersInit = { Accept: "application/json" };
  const contentType = request.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;

  let response: Response;
  try {
    response = await fetch(`${backendBaseUrl()}${path}`, {
      method,
      cache: "no-store",
      headers,
      body: hasBody ? await request.text() : undefined
    });
  } catch {
    return Response.json(
      { ok: false, error: "backend_unavailable" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }

  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": response.headers.get("content-type") || "application/json; charset=utf-8"
    }
  });
}
