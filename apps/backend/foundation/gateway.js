import http from "node:http";
import { corsHeaders, resolveCorsOrigin } from "./cors.js";
import {
  authenticateProxy,
  buildRequestContext,
  forwardedContextHeaders,
  normalizeRequestId
} from "./request-context.js";

const PUBLIC_HEALTH_PATHS = new Set(["/", "/health", "/api/health"]);
const REQUEST_HEADER_BLOCKLIST = new Set([
  "connection",
  "host",
  "origin",
  "x-backend-token",
  "x-request-id",
  "x-installation-id",
  "x-npp-code",
  "x-actor-id",
  "x-actor-type",
  "x-actor-authentication"
]);
const RESPONSE_HEADER_BLOCKLIST = new Set([
  "connection",
  "access-control-allow-origin",
  "access-control-allow-methods",
  "access-control-allow-headers",
  "access-control-max-age",
  "access-control-allow-credentials",
  "vary"
]);

function json(res, statusCode, payload, requestId, origin = null, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Request-Id": requestId,
    ...corsHeaders(origin),
    ...extraHeaders
  });
  res.end(body);
}

function errorPayload(error, requestId) {
  return {
    ok: false,
    error: error instanceof Error ? error.message : "foundation_boundary_failed",
    requestId,
    receivedAt: new Date().toISOString()
  };
}

function healthPayload(config, requestId) {
  return {
    ok: true,
    service: config.service,
    installationConfigured: Boolean(config.installationId && config.nppCode),
    authBoundary: config.authMode,
    requestId,
    receivedAt: new Date().toISOString()
  };
}

function upstreamHeaders(req, context, config) {
  const headers = {};
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined || REQUEST_HEADER_BLOCKLIST.has(name.toLowerCase())) continue;
    headers[name] = value;
  }
  Object.assign(headers, forwardedContextHeaders(context));
  headers.host = `${config.internalHost}:${config.internalPort}`;
  headers["x-forwarded-proto"] = req.socket.encrypted ? "https" : "http";
  headers["x-forwarded-host"] = String(req.headers.host || "");
  headers["x-forwarded-for"] = String(req.socket.remoteAddress || "");
  return headers;
}

function responseHeaders(headers, requestId, origin) {
  const output = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined || RESPONSE_HEADER_BLOCKLIST.has(name.toLowerCase())) continue;
    output[name] = value;
  }
  output["x-request-id"] = requestId;
  Object.assign(output, corsHeaders(origin));
  output["cache-control"] = "no-store";
  return output;
}

function proxyToLegacy(req, res, url, context, origin, config) {
  return new Promise((resolve) => {
    const upstream = http.request(
      {
        host: config.internalHost,
        port: config.internalPort,
        method: req.method,
        path: `${url.pathname}${url.search}`,
        headers: upstreamHeaders(req, context, config)
      },
      (upstreamResponse) => {
        res.writeHead(
          upstreamResponse.statusCode || 502,
          responseHeaders(upstreamResponse.headers, context.requestId, origin)
        );
        upstreamResponse.pipe(res);
        upstreamResponse.on("end", resolve);
      }
    );

    upstream.setTimeout(config.upstreamTimeoutMs, () => {
      upstream.destroy(new Error("legacy_upstream_timeout"));
    });

    upstream.on("error", (error) => {
      if (!res.headersSent) {
        json(res, 502, errorPayload(error, context.requestId), context.requestId, origin);
      } else {
        res.destroy(error);
      }
      resolve();
    });

    req.on("aborted", () => upstream.destroy(new Error("client_aborted")));
    req.pipe(upstream);
  });
}

export function createFoundationGateway(config) {
  return http.createServer(async (req, res) => {
    const requestId = normalizeRequestId(req.headers["x-request-id"]);
    let origin = null;

    try {
      origin = resolveCorsOrigin(req, config.corsOrigins);
      const url = new URL(req.url || "/", `http://${req.headers.host || `${config.publicHost}:${config.publicPort}`}`);

      if (req.method === "OPTIONS") {
        json(res, 204, {}, requestId, origin);
        return;
      }

      if (PUBLIC_HEALTH_PATHS.has(url.pathname)) {
        json(res, 200, healthPayload(config, requestId), requestId, origin);
        return;
      }

      authenticateProxy(req, config);
      const context = buildRequestContext(req, config);
      req.foundationContext = context;
      await proxyToLegacy(req, res, url, context, origin, config);
    } catch (error) {
      const statusCode = Number(error?.statusCode || 500);
      json(res, statusCode, errorPayload(error, requestId), requestId, origin);
    }
  });
}

export function waitForLegacyHealth(config, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(
        {
          host: config.internalHost,
          port: config.internalPort,
          path: "/api/health",
          timeout: 500
        },
        (response) => {
          response.resume();
          if ((response.statusCode || 500) < 500) {
            resolve();
            return;
          }
          retry();
        }
      );
      request.on("timeout", () => request.destroy());
      request.on("error", retry);
    };

    const retry = () => {
      if (Date.now() >= deadline) {
        reject(new Error("legacy_backend_not_ready"));
        return;
      }
      setTimeout(check, 75);
    };

    check();
  });
}
