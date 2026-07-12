const DEFAULT_BACKEND_API_BASE_URL = "http://165.22.109.61";

export function backendApiBaseUrl() {
  return String(
    process.env.BACKEND_API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      DEFAULT_BACKEND_API_BASE_URL
  )
    .trim()
    .replace(/\/+$/, "");
}

export async function proxyBackendRequest(
  request: Request,
  path: string,
  method = request.method
) {
  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(path, `${backendApiBaseUrl()}/`);

  sourceUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.append(key, value);
  });

  const upperMethod = method.toUpperCase();
  const hasBody = upperMethod !== "GET" && upperMethod !== "HEAD";
  const body = hasBody ? await request.text() : undefined;
  const headers: HeadersInit = { Accept: "application/json" };

  if (body) {
    headers["Content-Type"] =
      request.headers.get("content-type") || "application/json";
  }

  let response: Response;
  try {
    response = await fetch(targetUrl, {
      method: upperMethod,
      cache: "no-store",
      headers,
      body: body || undefined
    });
  } catch {
    return Response.json(
      { ok: false, error: "backend_unavailable" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }

  const responseBody = await response.text();
  return new Response(responseBody, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("content-type") ||
        "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
