import assert from "node:assert/strict";
import test from "node:test";
import { emptyEvidence, finalizeEvidence, recordOperationProof } from "./runtime/f05-production-smoke-evidence.mjs";
import { assertF05ProductionSmokeGuard, redactSmokeError } from "./runtime/f05-production-smoke-guard.mjs";
import { MUTATION_INVENTORY, RETIRED_SETTINGS_POSTS, SMOKE_PREFIX, SMOKE_SESSION_DATE } from "./runtime/f05-production-smoke-inventory.mjs";
import { runF05ProductionOwnersSmoke } from "./runtime/f05-production-smoke-runner.mjs";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const expectedOperations = [
  "order.create", "route.create", "route.update", "route-session.open", "session-customer.status.update",
  "route-session.update", "route-session.delete-empty", "route-customer.update", "route-customer.archive", "route.archive"
];

function completeOperationProof() {
  return {
    execute: { ok: true, canonical: true, requestId: "request-1" },
    replay: { persisted: true, sameResult: true },
    conflict: { status: 409, canonical: true },
    context: { persisted: true, installationId: "installation-a", actorId: "actor-a" },
    idempotency: { rowCount: 1, status: "completed", attemptCount: 2 },
    audit: { succeeded: 1, replayed: 1, appendOnly: true },
    invariants: { verified: true }
  };
}

test("complete F05 runtime inventory is exact and legacy settings POSTs stay absent", () => {
  assert.deepEqual(MUTATION_INVENTORY.map((item) => item.operation), expectedOperations);
  assert.equal(RETIRED_SETTINGS_POSTS.length, 7);
  assert.deepEqual(RETIRED_SETTINGS_POSTS, [
    "/api/mcp-settings/order-template", "/api/mcp-settings/test-template", "/api/mcp-settings/report-template",
    "/api/mcp-settings/followup-template", "/api/mcp-settings/skip-reason-template",
    "/api/mcp-settings/customer-add-rule", "/api/mcp-settings/session-status"
  ]);
});

test("production guard requires explicit mode, exact installation identity, non-business fixture namespace and secrets", () => {
  const valid = {
    NPP_F05_RUNTIME_SMOKE_GUARDED: "I_UNDERSTAND_TEMPORARY_PRODUCTION_MUTATIONS",
    NPP_F05_EXPECTED_INSTALLATION_ID: "installation-a", MCP_INSTALLATION_ID: "installation-a",
    NPP_F05_EXPECTED_NPP_CODE: "NPP-A", MCP_NPP_CODE: "NPP-A",
    MCP_API_BASE_URL: "https://gateway.example.com", SUPABASE_URL: "https://project.supabase.co",
    BACKEND_API_TOKEN: "b".repeat(32), SUPABASE_SERVICE_ROLE_KEY: "s".repeat(32)
  };
  assert.doesNotThrow(() => assertF05ProductionSmokeGuard(valid));
  for (const key of ["NPP_F05_RUNTIME_SMOKE_GUARDED", "NPP_F05_EXPECTED_INSTALLATION_ID", "NPP_F05_EXPECTED_NPP_CODE", "BACKEND_API_TOKEN", "SUPABASE_SERVICE_ROLE_KEY"]) {
    assert.throws(() => assertF05ProductionSmokeGuard({ ...valid, [key]: "" }), /f05_smoke_guard/);
  }
  assert.throws(() => assertF05ProductionSmokeGuard({ ...valid, MCP_INSTALLATION_ID: "wrong" }), /identity_mismatch/);
  assert.match(SMOKE_PREFIX, /^__NPP_F05_RUNTIME_SMOKE__/);
  assert.match(SMOKE_SESSION_DATE, /^2099-/);
  assert.doesNotMatch(redactSmokeError(new Error("Bearer eyJsecret.payload")), /eyJsecret/);
});

test("runner always cleans up and emits complete machine-readable PASS evidence", async () => {
  const calls = [];
  const driver = {
    async createTemporaryFixtures() { calls.push("create"); return { smoke: true }; },
    async proveOperation(operation) { calls.push(operation.name); return completeOperationProof(); },
    async proveRetiredPost(path) { calls.push(path); return { status: 404, canonical: true, requestId: "retired-request" }; },
    async proveArchiveLifecycle() { calls.push("archive-lifecycle"); return { intentCount: 2, jobCount: 2, minimumJobAttempts: 2, reclaimedJobs: 1, finalizedIntents: 2, finalizedJobs: 2, separateIntentAndJobTransactions: true }; },
    async cleanupTemporaryFixtures() { calls.push("cleanup"); },
    async verifyCleanup() { calls.push("verify-cleanup"); return { databaseRowsRemaining: 0, r2ProviderVerified: true, r2ObjectsRemaining: 0 }; }
  };
  const evidence = await runF05ProductionOwnersSmoke(driver);
  assert.equal(evidence.NPP_F05_PRODUCTION_OWNERS_RUNTIME_SMOKE, "PASS");
  assert.equal(evidence.cleanup.r2Objects, "PASS");
  assert.equal(calls.at(-2), "cleanup");
  assert.equal(calls.at(-1), "verify-cleanup");
  for (const operation of Object.values(evidence.operations)) {
    for (const key of ["execute", "replay", "conflict", "canonicalEnvelope", "requestId", "context", "idempotency", "audit", "invariants"]) assert.equal(operation[key], "PASS");
  }
});

test("runner executes cleanup after a primary failure and never upgrades incomplete evidence", async () => {
  const calls = [];
  await assert.rejects(runF05ProductionOwnersSmoke({
    async createTemporaryFixtures() { return {}; },
    async proveOperation() { throw new Error("provider_failed"); },
    async proveRetiredPost() {}, async proveArchiveLifecycle() {},
    async cleanupTemporaryFixtures() { calls.push("cleanup"); },
    async verifyCleanup() { calls.push("verify"); }
  }), /npp_f05_production_smoke_failed/);
  assert.deepEqual(calls, ["cleanup", "verify"]);
});

test("evidence cannot report PASS with pending archive or cleanup proof", () => {
  const evidence = emptyEvidence();
  for (const { name } of MUTATION_INVENTORY) recordOperationProof(evidence, name, completeOperationProof());
  for (const path of RETIRED_SETTINGS_POSTS) evidence.retiredSettingsPosts[path] = "PASS";
  assert.equal(finalizeEvidence(evidence).NPP_F05_PRODUCTION_OWNERS_RUNTIME_SMOKE, "FAIL");
});

test("runner rejects synthetic PASS labels, missing invariants, and DB-only cleanup", async () => {
  const base = {
    async createTemporaryFixtures() { return {}; },
    async proveRetiredPost() { return { status: 404, canonical: true, requestId: "request" }; },
    async proveArchiveLifecycle() { return { intentCount: 2, jobCount: 2, minimumJobAttempts: 2, reclaimedJobs: 1, finalizedIntents: 2, finalizedJobs: 2, separateIntentAndJobTransactions: true }; },
    async cleanupTemporaryFixtures() {},
    async verifyCleanup() { return { databaseRowsRemaining: 0, r2ProviderVerified: true, r2ObjectsRemaining: 0 }; }
  };
  await assert.rejects(runF05ProductionOwnersSmoke({ ...base, async proveOperation() { return { execute: "PASS", replay: "PASS", conflict: "PASS" }; } }), /npp_f05_production_smoke_failed/);
  await assert.rejects(runF05ProductionOwnersSmoke({ ...base, async proveOperation() { return { ...completeOperationProof(), invariants: { verified: false } }; } }), /npp_f05_production_smoke_failed/);
  await assert.rejects(runF05ProductionOwnersSmoke({ ...base, async proveOperation() { return completeOperationProof(); }, async verifyCleanup() { return { databaseRowsRemaining: 0, r2ProviderVerified: false, r2ObjectsRemaining: null }; } }), /npp_f05_production_smoke_failed/);
});

test("live driver targets only captured temporary IDs and never prints provider keys", async () => {
  const driver = await readFile("test/runtime/f05-production-smoke-live-driver.mjs", "utf8");
  const command = await readFile("test/runtime/smoke-f05-production-owners.mjs", "utf8");
  assert.match(driver, /createdRouteIds = new Set\(\)/);
  assert.match(driver, /createdRouteIds\.has|createdRouteIds\.delete/);
  assert.match(driver, /SMOKE_PREFIX/);
  assert.match(driver, /SMOKE_SESSION_DATE/);
  assert.match(driver, /cleanupTemporaryFixtures/);
  assert.match(driver, /verifyCleanup/);
  assert.doesNotMatch(`${driver}\n${command}`, /console\.log\([^)]*(?:serviceRole|backendToken|object_key|objectKey)/);
  assert.doesNotMatch(command, /pullmcp|supabase migration|deploy/i);
});

test("documented production command fails closed before network access without guard", () => {
  const result = spawnSync(process.execPath, ["test/runtime/smoke-f05-production-owners.mjs"], {
    cwd: process.cwd(), env: { PATH: process.env.PATH || "" }, encoding: "utf8"
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /f05_smoke_guard_missing_NPP_F05_RUNTIME_SMOKE_GUARDED/);
  assert.doesNotMatch(result.stderr, /BACKEND_API_TOKEN.*[A-Za-z0-9]{32}/);
});
