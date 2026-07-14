import { randomUUID, timingSafeEqual } from "node:crypto";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:~+-]{7,191}$/;

function headerValue(req, name) {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : String(value ?? "").trim();
}

export function normalizeRequestId(value) {
  const candidate = String(value ?? "").trim();
  return REQUEST_ID_PATTERN.test(candidate) ? candidate : `req_${randomUUID()}`;
}

export function normalizeIdempotencyKey(value) {
  const candidate = String(value ?? "").trim();
  if (!candidate) return null;
  if (!IDEMPOTENCY_KEY_PATTERN.test(candidate)) {
    const error = new Error("invalid_idempotency_key");
    error.statusCode = 400;
    throw error;
  }
  return candidate;
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left ?? ""));
  const b = Buffer.from(String(right ?? ""));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function authenticateProxy(req, config) {
  const token = headerValue(req, "x-backend-token");
  if (!token || !safeEqual(token, config.backendApiToken)) {
    const error = new Error("backend_auth_required");
    error.statusCode = 401;
    throw error;
  }
}

export function buildRequestContext(req, config) {
  const requestId = normalizeRequestId(headerValue(req, "x-request-id"));
  const idempotencyKey = normalizeIdempotencyKey(headerValue(req, "idempotency-key"));

  return Object.freeze({
    requestId,
    installation: Object.freeze({
      id: config.installationId,
      nppCode: config.nppCode
    }),
    actor: Object.freeze({
      id: config.legacyActorId,
      type: "service",
      authentication: "backend-token"
    }),
    auth: Object.freeze({
      mode: config.authMode,
      authenticated: true
    }),
    idempotencyKey,
    receivedAt: new Date().toISOString()
  });
}

export function forwardedContextHeaders(context) {
  const headers = {
    "x-request-id": context.requestId,
    "x-installation-id": context.installation.id,
    "x-npp-code": context.installation.nppCode,
    "x-actor-id": context.actor.id,
    "x-actor-type": context.actor.type,
    "x-actor-authentication": context.actor.authentication
  };
  if (context.idempotencyKey) headers["idempotency-key"] = context.idempotencyKey;
  return headers;
}
