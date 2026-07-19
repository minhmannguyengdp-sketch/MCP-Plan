import { unwrapIdempotentMutationResult } from "./idempotency.js";
import { createRoute, updateRoute } from "./route-mutations.js";

const MAX_JSON_BODY_BYTES = 2 * 1024 * 1024;

function badRequest(code) {
  const error = new Error(code);
  error.statusCode = 400;
  throw error;
}

function decodePathId(value) {
  try {
    const decoded = decodeURIComponent(value).trim();
    if (!decoded) badRequest("invalid_route_id");
    return decoded;
  } catch {
    badRequest("invalid_route_id");
  }
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_JSON_BODY_BYTES) {
      const error = new Error("request_body_too_large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    badRequest("invalid_json_body");
  }
}

function mutationResponse(result, statusCode = 200) {
  const { data, meta } = unwrapIdempotentMutationResult(result);
  return {
    statusCode,
    payload: {
      data,
      ...(meta ? { meta } : {}),
      receivedAt: new Date().toISOString()
    }
  };
}

export async function handleRouteApi(req, url, context, config, { fetchImpl = fetch } = {}) {
  const method = String(req.method || "GET").toUpperCase();
  const pathname = url.pathname;

  if (method === "POST" && pathname === "/api/routes") {
    return mutationResponse(
      await createRoute(await readJsonBody(req), context, config, { fetchImpl }),
      200
    );
  }

  const routeMatch = pathname.match(/^\/api\/routes\/([^/]+)$/);
  if (method === "PATCH" && routeMatch) {
    return mutationResponse(
      await updateRoute(
        decodePathId(routeMatch[1]),
        await readJsonBody(req),
        context,
        config,
        { fetchImpl }
      ),
      200
    );
  }

  return null;
}
