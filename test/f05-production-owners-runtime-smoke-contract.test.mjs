import assert from "node:assert/strict";
import test from "node:test";
import { emptyEvidence, finalizeEvidence, recordArchiveProof, recordCleanupProof, recordOperationProof, recordRetiredPostProof } from "./runtime/f05-production-smoke-evidence.mjs";
import { assertF05ProductionSmokeGuard, redactSmokeError } from "./runtime/f05-production-smoke-guard.mjs";
import { MUTATION_INVENTORY, RETIRED_SETTINGS_POSTS, SMOKE_PREFIX, SMOKE_SESSION_DATE } from "./runtime/f05-production-smoke-inventory.mjs";
import { runF05ProductionOwnersSmoke } from "./runtime/f05-production-smoke-runner.mjs";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const expectedOperations = [
  "order.create", "route.create", "route.update", "route-session.open", "session-customer.status.update",
  "route-session.update", "route-session.delete-empty", "route-customer.update", "route-customer.archive", "route.archive"
];

test("complete F05 runtime inventory is exact and legacy settings POSTs stay absent", () => {
  assert.deepEqual(MUTATION_INVENTORY.map((item) => item.operation), expectedOperations);
  assert.equal(RETIRED_SETTINGS_POSTS.length, 7);
  assert.deepEqual(RETIRED_SETTINGS_POSTS, [
    "/api/mcp-settings/order-template", "/api/mcp-settings/test-template", "/api/mcp-settings/report-template",
    "/api/mcp-settings/followup-template", "/api/mcp-settings/skip-reason-template",
    "/api/mcp-settings/customer-add-rule", "/api/mcp-settings/session-status"
  ]);
});

test("production guard requires identities, API/database secrets and R2 capability before mutation", () => {
  const valid = {
    NPP_F05_RUNTIME_SMOKE_GUARDED: "I_UNDERSTAND_TEMPORARY_PRODUCTION_MUTATIONS",
    NPP_F05_EXPECTED_INSTALLATION_ID: "installation-a", MCP_INSTALLATION_ID: "installation-a",
    NPP_F05_EXPECTED_NPP_CODE: "NPP-A", MCP_NPP_CODE: "NPP-A",
    MCP_API_BASE_URL: "https://gateway.example.com", SUPABASE_URL: "https://project.supabase.co",
    BACKEND_API_TOKEN: "b".repeat(32), SUPABASE_SERVICE_ROLE_KEY: "s".repeat(32),
    R2_ENDPOINT: "https://account.r2.cloudflarestorage.com",
    R2_BUCKET_NAME: "smoke-bucket",
    R2_ACCESS_KEY_ID: "a".repeat(16),
    R2_SECRET_ACCESS_KEY: "r".repeat(32)
  };
  assert.doesNotThrow(() => assertF05ProductionSmokeGuard(valid));
  for (const key of [
    "NPP_F05_RUNTIME_SMOKE_GUARDED", "NPP_F05_EXPECTED_INSTALLATION_ID", "NPP_F05_EXPECTED_NPP_CODE",
    "BACKEND_API_TOKEN", "SUPABASE_SERVICE_ROLE_KEY", "R2_ENDPOINT", "R2_BUCKET_NAME",
    "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"
  ]) {
    assert.throws(() => assertF05ProductionSmokeGuard({ ...valid, [key]: "" }), /f05_smoke_guard/);
  }
  assert.doesNotThrow(() => assertF05ProductionSmokeGuard({ ...valid, R2_ENDPOINT: "", CLOUDFLARE_R2_ENDPOINT: valid.R2_ENDPOINT }));
  assert.throws(() => assertF05ProductionSmokeGuard({ ...valid, MCP_INSTALLATION_ID: "wrong" }), /identity_mismatch/);
  assert.match(SMOKE_PREFIX, /^__NPP_F05_RUNTIME_SMOKE__/);
  assert.match(SMOKE_SESSION_DATE, /^2099-/);
  assert.doesNotMatch(redactSmokeError(new Error("Bearer eyJsecret.payload")), /eyJsecret/);
});

function operationFacts(operation) {
  const firstRequestId = `req-${operation.name}-first`;
  const replayRequestId = `req-${operation.name}-replay`;
  return {
    firstExecuted: true,
    replayObserved: true,
    replayPayloadEqual: true,
    conflictObserved: true,
    canonicalEnvelope: true,
    firstRequestId,
    replayRequestId,
    persistedRequestIdsExact: true,
    aggregateId: `agg-${operation.name}`,
    idempotency: {
      singleCompletedRecord: true,
      requestContextExact: true,
      requestIdsExact: true,
      record: { original_request_id: firstRequestId, last_request_id: replayRequestId, contextExact: true }
    },
    audit: {
      requestIdsExact: true,
      rows: [
        { request_id: firstRequestId, outcome: "succeeded", contextExact: true },
        { request_id: replayRequestId, outcome: "replayed", contextExact: true }
      ]
    },
    invariant: { name: `${operation.name}-invariant`, observed: true }
  };
}

function archiveFacts() {
  return {
    sequence: [
      { stage: "failure", observed: true },
      { stage: "retry-claim", observed: true },
      { stage: "reclaim", observed: true },
      { stage: "completion", observed: true },
      { stage: "finalizer", observed: true }
    ],
    providerR2: { created: true, presenceObserved: true, absenceObserved: true },
    intent: { completed: true },
    deleteJob: { completed: true },
    crossSystemBoundary: {
      intentClaimBeforeProviderDelete: true,
      storageFailurePersistedBeforeRetry: true,
      providerDeleteBeforeFinalizer: true,
      finalizerAfterStorageCompletion: true
    }
  };
}

test("runner always cleans up and emits complete machine-readable PASS evidence", async () => {
  const calls = [];
  const driver = {
    async createTemporaryFixtures() { calls.push("create"); return { smoke: true }; },
    async proveOperation(operation) { calls.push(operation.name); return operationFacts(operation); },
    async proveRetiredPost(path) { calls.push(path); return { canonical404: true, requestId: `retired-${path}`, receivedAtObserved: true }; },
    async proveArchiveLifecycle() { calls.push("archive-lifecycle"); return archiveFacts(); },
    async cleanupTemporaryFixtures() { calls.push("cleanup"); return { cleanupAttempted: true }; },
    async verifyCleanup() { calls.push("verify-cleanup"); return { databaseRowsAbsent: true, r2RowsAbsent: true, providerR2Absent: true }; }
  };
  const evidence = await runF05ProductionOwnersSmoke(driver);
  assert.equal(evidence.NPP_F05_PRODUCTION_OWNERS_RUNTIME_SMOKE, "PASS");
  assert.equal(evidence.cleanup.facts.providerR2Absent, true);
  assert.equal(calls.at(-2), "cleanup");
  assert.equal(calls.at(-1), "verify-cleanup");
  for (const operation of Object.values(evidence.operations)) {
    assert.equal(operation.status, "PASS");
    assert.equal(operation.facts.auditRows, 2);
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
  for (const operation of MUTATION_INVENTORY) recordOperationProof(evidence, operation.name, operationFacts(operation));
  for (const path of RETIRED_SETTINGS_POSTS) recordRetiredPostProof(evidence, path, { canonical404: true, requestId: `retired-${path}`, receivedAtObserved: true });
  assert.equal(finalizeEvidence(evidence).NPP_F05_PRODUCTION_OWNERS_RUNTIME_SMOKE, "FAIL");
});

test("structured operation and cleanup evidence fail closed on missing request IDs or provider proof", () => {
  const operation = operationFacts({ name: "routeCreate" });
  assert.throws(
    () => recordOperationProof(emptyEvidence(), "routeCreate", { ...operation, replayRequestId: "" }),
    /replay_request_id_missing/
  );
  assert.throws(
    () => recordOperationProof(emptyEvidence(), "routeCreate", { ...operation, persistedRequestIdsExact: false }),
    /persisted_request_ids_not_exact/
  );
  assert.throws(
    () => recordCleanupProof(emptyEvidence(), { databaseRowsAbsent: true, r2RowsAbsent: true, providerR2Absent: false }),
    /cleanup_provider_r2_object_not_absent/
  );
});

test("structured archive evidence rejects labels, counters and unobserved cross-system boundaries", () => {
  const evidence = emptyEvidence();
  assert.throws(() => recordOperationProof(evidence, "routeCreate", { ...operationFacts({ name: "routeCreate" }), persistedContext: "PASS" }), /synthetic_pass_label_rejected/);
  assert.throws(() => recordArchiveProof(evidence, { retry: "PASS", reclaim: "PASS", finalizer: "PASS" }), /synthetic_pass_label_rejected/);
  assert.throws(() => recordArchiveProof(evidence, { attemptCount: 2, claimedAt: "2026-07-22T00:00:00.000Z" }), /archive_sequence_missing/);
  assert.throws(
    () => recordArchiveProof(evidence, { ...archiveFacts(), crossSystemBoundary: { intentClaimBeforeProviderDelete: true } }),
    /archive_storage_failure_before_retry_not_observed/
  );
  assert.doesNotThrow(() => recordArchiveProof(evidence, archiveFacts()));
});

test("live driver targets only captured temporary IDs and never prints provider keys", async () => {
  const driver = await readFile("test/runtime/f05-production-smoke-live-driver.mjs", "utf8");
  const command = await readFile("test/runtime/smoke-f05-production-owners.mjs", "utf8");
  assert.match(driver, /createdRouteIds = new Set\(\)/);
  assert.match(driver, /createdRouteIds\.delete/);
  assert.match(driver, /SMOKE_PREFIX/);
  assert.match(driver, /SMOKE_SESSION_DATE/);
  assert.match(driver, /cleanupTemporaryFixtures/);
  assert.match(driver, /verifyCleanup/);
  assert.doesNotMatch(`${driver}\n${command}`, /console\.log\([^)]*(?:serviceRole|backendToken|object_key|objectKey)/);
  assert.doesNotMatch(command, /pullmcp|supabase migration|deploy/i);
});

test("target-scoped capability is preflighted before the first fixture mutation", async () => {
  const driver = await readFile("test/runtime/f05-production-smoke-live-driver.mjs", "utf8");
  const capabilityIndex = driver.indexOf('dbRpc("mcp_f05_archive_proof_capabilities"');
  const firstMutationIndex = driver.indexOf('must("/api/routes"');
  assert.ok(capabilityIndex >= 0);
  assert.ok(firstMutationIndex >= 0);
  assert.ok(capabilityIndex < firstMutationIndex);
  assert.match(driver, /targetScopedCapabilityObserved = true/);
  assert.match(driver, /archive_sequence_target_scoped_capability_not_preflighted/);
});

test("live proof requires exact persisted IDs, correct session targets and provider cleanup HEAD", async () => {
  const driver = await readFile("test/runtime/f05-production-smoke-live-driver.mjs", "utf8");
  assert.match(driver, /\[firstRequestId, replayRequestId\]/);
  assert.match(driver, /persistedRequestIdsExact/);
  assert.match(driver, /definition\.name === "sessionUpdateClose" \? fixtures\.sessionId/);
  assert.match(driver, /definition\.name === "sessionDeleteEmpty" \? fixtures\.emptySessionId/);
  assert.doesNotMatch(driver, /sessionUpdateClose" \|\| definition\.name === "sessionDeleteEmpty"/);
  assert.match(driver, /fixtures\?\.mediaObjectKey, fixtures\?\.archiveProofMediaObjectKey/);
  assert.match(driver, /providerR2Absent: true/);
});

test("live proof uses ordered target-scoped archive facts without broad claims or fake boundary flags", async () => {
  const driver = await readFile("test/runtime/f05-production-smoke-live-driver.mjs", "utf8");
  for (const marker of [
    "mcp_f05_archive_proof_capabilities",
    "mcp_finish_outlet_media_delete",
    "mcp_claim_archive_intent",
    "mcp_claim_one_outlet_media_delete",
    "mcp_claim_one_storage_delete_job",
    "mcp_finish_storage_delete_job",
    "mcp_storage_delete_jobs_sync_archive_intent"
  ]) assert.match(driver, new RegExp(marker));

  const ordered = [
    "guarded_f05_storage_worker_failure_probe",
    "retryClaim = object",
    "reclaimedMedia = object",
    "deleteResponse = await r2Delete",
    "completedJob = object",
    "finalIntentRows"
  ].map((needle) => driver.indexOf(needle));
  assert.ok(ordered.every((index) => index >= 0));
  assert.deepEqual([...ordered].sort((left, right) => left - right), ordered);
  assert.doesNotMatch(driver, /guarded_f05_r2_delete_failure_probe/);
  assert.doesNotMatch(driver, /mcp_claim_stale_outlet_media_delete|mcp_claim_ready_storage_delete_jobs/);
  assert.doesNotMatch(driver, /attempt_count|claimed_at|failed_attempt_count/);
  assert.doesNotMatch(driver, /noFakeCrossSystemTransaction/);
  assert.match(driver, /storageFailurePersistedBeforeRetry/);
  assert.match(driver, /providerDeleteBeforeFinalizer/);
  for (const stage of ["failure", "retry-claim", "reclaim", "completion", "finalizer"]) {
    assert.match(driver, new RegExp(`stage: "${stage}"`));
  }
  assert.doesNotMatch(driver, /return \{[^}]*PASS/);
});

test("documented production command fails closed before network access without guard", () => {
  const result = spawnSync(process.execPath, ["test/runtime/smoke-f05-production-owners.mjs"], {
    cwd: process.cwd(), env: { PATH: process.env.PATH || "" }, encoding: "utf8"
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /f05_smoke_guard_missing_NPP_F05_RUNTIME_SMOKE_GUARDED/);
  assert.doesNotMatch(result.stderr, /BACKEND_API_TOKEN.*[A-Za-z0-9]{32}/);
});
