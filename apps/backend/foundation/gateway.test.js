import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { createFoundationGateway } from "./gateway.js";

function listen(server, host = "127.0.0.1") {
  server.listen(0, host);
  return once(server, "listening").then(() => server.address().port);
}

function request(port, path, { method = "GET", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path, method, headers }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: text ? JSON.parse(text) : null
        });
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function setup() {
  const legacy = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      path: req.url,
      requestId: req.headers["x-request-id"],
      installationId: req.headers["x-installation-id"],
      nppCode: req.headers["x-npp-code"],
      actorId: req.headers["x-actor-id"],
      idempotencyKey: req.headers["idempotency-key"] || null,
      leakedToken: Boolean(req.headers["x-backend-token"])
    }));
  });
  const internalPort = await listen(legacy);

  const config = {
    service: "mcp-plan-backend",
    publicHost: "127.0.0.1",
    publicPort: 0,
    internalHost: "127.0.0.1",
    internalPort,
    installationId: "installation-a",
    nppCode: "NPP-A",
    legacyActorId: "service:npp-a:mcp-v1",
    backendApiToken: "0123456789abcdef0123456789abcdef",
    authMode: "proxy-service",
    corsOrigins: ["https://app.example.com"],
    upstreamTimeoutMs: 1000
  };

  const gateway = createFoundationGateway(config);
  const publicPort = await listen(gateway);
  return { legacy, gateway, config, publicPort };
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

test("health is public but business API requires proxy authentication", async (t) => {
  const state = await setup();
  t.after(async () => {
    await close(state.gateway);
    await close(state.legacy);
  });

  const health = await request(state.publicPort, "/api/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.installationConfigured, true);
  assert.equal(health.body.installationId, undefined);
  assert.equal(health.body.nppCode, undefined);
  assert.match(health.headers["x-request-id"], /^req_/);

  const unauthorized = await request(state.publicPort, "/api/routes");
  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorized.body.error, "backend_auth_required");
});

test("gateway injects fixed installation and actor context", async (t) => {
  const state = await setup();
  t.after(async () => {
    await close(state.gateway);
    await close(state.legacy);
  });

  const result = await request(state.publicPort, "/api/routes?active=true", {
    headers: {
      "x-backend-token": state.config.backendApiToken,
      "x-request-id": "request_12345678",
      "x-installation-id": "attacker",
      "x-actor-id": "attacker",
      "idempotency-key": "route-read-12345678",
      origin: "https://app.example.com"
    }
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.path, "/api/routes?active=true");
  assert.equal(result.body.requestId, "request_12345678");
  assert.equal(result.body.installationId, "installation-a");
  assert.equal(result.body.nppCode, "NPP-A");
  assert.equal(result.body.actorId, "service:npp-a:mcp-v1");
  assert.equal(result.body.idempotencyKey, "route-read-12345678");
  assert.equal(result.body.leakedToken, false);
  assert.equal(result.headers["access-control-allow-origin"], "https://app.example.com");
});

test("CORS is deny-by-default", async (t) => {
  const state = await setup();
  t.after(async () => {
    await close(state.gateway);
    await close(state.legacy);
  });

  const denied = await request(state.publicPort, "/api/routes", {
    headers: {
      "x-backend-token": state.config.backendApiToken,
      origin: "https://evil.example.com"
    }
  });
  assert.equal(denied.status, 403);
  assert.equal(denied.body.error, "cors_origin_denied");
});
