import test from "node:test";
import assert from "node:assert/strict";
import { loadFoundationConfig, parseCorsOrigins } from "./config.js";

function validEnv(overrides = {}) {
  return {
    NODE_ENV: "production",
    HOST: "127.0.0.1",
    PORT: "3001",
    LEGACY_INTERNAL_PORT: "3002",
    INSTALLATION_ID: "npp-demo-prod",
    NPP_CODE: "NPP-DEMO",
    MCP_LEGACY_ACTOR_ID: "service:npp-demo:mcp-v1",
    BACKEND_API_TOKEN: "0123456789abcdef0123456789abcdef",
    CORS_ORIGINS: "https://app.example.com",
    AUTH_MODE: "proxy-service",
    ...overrides
  };
}

test("production config is fail-fast", () => {
  assert.throws(
    () => loadFoundationConfig(validEnv({ BACKEND_API_TOKEN: "" })),
    /missing_backend_api_token/
  );
  assert.throws(
    () => loadFoundationConfig(validEnv({ CORS_ORIGINS: "" })),
    /missing_cors_origins/
  );
  assert.throws(
    () => loadFoundationConfig(validEnv({ CORS_ORIGINS: "*" })),
    /cors_wildcard_forbidden/
  );
});

test("installation values are fixed server config", () => {
  const config = loadFoundationConfig(validEnv());
  assert.equal(config.installationId, "npp-demo-prod");
  assert.equal(config.nppCode, "NPP-DEMO");
  assert.deepEqual(config.corsOrigins, ["https://app.example.com"]);
  assert.equal(config.publicPort, 3001);
  assert.equal(config.internalPort, 3002);
});

test("development CORS defaults are explicit localhost origins", () => {
  assert.deepEqual(parseCorsOrigins("", { nodeEnv: "development" }), [
    "http://localhost:3000",
    "http://127.0.0.1:3000"
  ]);
});
