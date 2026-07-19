import { unwrapIdempotentMutationResult } from "./idempotency.js";
import { createOrder } from "./order-mutations.js";

const MAX_JSON_BODY_BYTES = 2 * 1024 * 1024;

function badRequest(code) {
  const error = new Error(code);
  error.statusCode = 400;
  throw error;
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

export async function handleOrderApi(req, url, context, config, { fetchImpl = fetch } = {}) {
  const method = String(req.method || "GET").toUpperCase();
  if (method !== "POST" || url.pathname !== "/api/orders") return null;

  const result = await createOrder(await readJsonBody(req), context, config, { fetchImpl });
  const { data, meta } = unwrapIdempotentMutationResult(result);
  return {
    statusCode: 201,
    payload: {
      data,
      ...(meta ? { meta } : {}),
      receivedAt: new Date().toISOString()
    }
  };
}
