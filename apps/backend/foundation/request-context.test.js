import test from "node:test";
import assert from "node:assert/strict";
import {
  authenticateProxy,
  buildRequestContext,
  normalizeIdempotencyKey,
  normalizeRequestId
} from "./request-context.js";

const config = {
  backendApiToken: "0123456789abcdef0123456789abcdef",
  installationId: "installation-a",
  nppCode: "NPP-A",
  legacyActorId: "service:npp-a:mcp-v1",
  authMode: "proxy-service"
};

function request(headers = {}) {
  return { headers };
}

test("proxy token is mandatory", () => {
  assert.throws(() => authenticateProxy(request(), config), /backend_auth_required/);
  assert.throws(
    () => authenticateProxy(request({ "x-backend-token": "wrong" }), config),
    /backend_auth_required/
  );
  assert.doesNotThrow(() => authenticateProxy(
    request({ "x-backend-token": config.backendApiToken }),
    config
  ));
});

test("context never accepts installation or actor from client", () => {
  const context = buildRequestContext(
    request({
      "x-request-id": "request_12345678",
      "x-installation-id": "attacker-installation",
      "x-actor-id": "attacker",
      "idempotency-key": "order-create-12345678"
    }),
    config
  );
  assert.equal(context.requestId, "request_12345678");
  assert.equal(context.installation.id, "installation-a");
  assert.equal(context.actor.id, "service:npp-a:mcp-v1");
  assert.equal(context.idempotencyKey, "order-create-12345678");
});

test("invalid request and idempotency IDs are normalized or rejected", () => {
  assert.match(normalizeRequestId("bad"), /^req_/);
  assert.equal(normalizeIdempotencyKey("order-create-12345678"), "order-create-12345678");
  assert.throws(() => normalizeIdempotencyKey("bad key"), /invalid_idempotency_key/);
});
