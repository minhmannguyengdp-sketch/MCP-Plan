import { randomUUID } from "node:crypto";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const DEVELOPMENT_BACKEND_API_BASE_URL = "http://127.0.0.1:3001";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function requiredServerEnv(name: string) {
  const value = text(process.env[name]);
  if (!value) throw new Error(`missing_${name.toLowerCase()}`);
  return value;
}

function normalizeHttpBaseUrl(value: string, name: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`invalid_${name.toLowerCase()}`);
  }
  if (!/^https?:$/.test(url.protocol)) {
    throw new Error(`invalid_${name.toLowerCase()}`);
  }
  return url.toString().replace(/\/+$/, "");
}

function normalizeRequestId(value: unknown) {
  const candidate = text(value);
  return REQUEST_ID_PATTERN.test(candidate) ? candidate : `req_${randomUUID()}`;
}

export function backendApiBaseUrl() {
  const configured = text(process.env.BACKEND_API_BASE_URL);
  if (configured) return normalizeHttpBaseUrl(configured, "BACKEND_API_BASE_URL");
  if (process.env.NODE_ENV !== "production") return DEVELOPMENT_BACKEND_API_BASE_URL;
  throw new Error("missing_backend_api_base_url");
}

type BackendHeaderOptions = {
  hasBody?: boolean;
  contentType?: string;
};

export function backendApiRequestHeaders(
  request?: Request,
  options: BackendHeaderOptions = {}
) {
  const requestId = normalizeRequestId(request?.headers.get("x-request-id"));
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Backend-Token": requiredServerEnv("BACKEND_API_TOKEN"),
    "X-Request-Id": requestId,
    "X-Actor-Id": requiredServerEnv("MCP_LEGACY_ACTOR_ID"),
    "X-Actor-Type": "service",
    "X-Actor-Authentication": "backend-token"
  };

  if (options.hasBody) {
    headers["Content-Type"] =
      options.contentType || request?.headers.get("content-type") || "application/json";
  }

  const authorization = request?.headers.get("authorization");
  if (authorization) headers.Authorization = authorization;

  const idempotencyKey = request?.headers.get("idempotency-key");
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  return { headers, requestId };
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
  const { headers, requestId } = backendApiRequestHeaders(request, {
    hasBody: Boolean(body),
    contentType: request.headers.get("content-type") || undefined
  });

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
      {
        ok: false,
        error: "backend_unavailable",
        requestId,
        receivedAt: new Date().toISOString()
      },
      {
        status: 502,
        headers: { "Cache-Control": "no-store", "X-Request-Id": requestId }
      }
    );
  }

  const responseBody = await response.text();
  const responseRequestId = response.headers.get("x-request-id") || requestId;
  return new Response(responseBody, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("content-type") ||
        "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Request-Id": responseRequestId
    }
  });
}
