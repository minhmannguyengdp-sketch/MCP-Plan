import { MUTATION_INVENTORY, RETIRED_SETTINGS_POSTS } from "./f05-production-smoke-inventory.mjs";

export function emptyEvidence() {
  return {
    NPP_F05_PRODUCTION_OWNERS_RUNTIME_SMOKE: "PENDING",
    generatedAt: new Date().toISOString(),
    preflight: { status: "PENDING", remoteIdentity: "PENDING", invariantVerifiers: "PENDING", archiveVerifier: "PENDING", r2Verifier: "PENDING" },
    operations: Object.fromEntries(MUTATION_INVENTORY.map(({ name }) => [name, { status: "PENDING" }])),
    retiredSettingsPosts: Object.fromEntries(RETIRED_SETTINGS_POSTS.map((path) => [path, "PENDING"])),
    archiveLifecycle: { retry: "PENDING", reclaim: "PENDING", finalizer: "PENDING", noFakeCrossSystemTransaction: "PENDING" },
    cleanup: { status: "PENDING", databaseRows: "PENDING", r2Objects: "PENDING" }
  };
}

export function recordPreflightProof(evidence, proof, expectedIdentity) {
  const expectedOperations = MUTATION_INVENTORY.map(({ name }) => name).sort();
  const invariantVerifiers = Array.isArray(proof?.operationInvariantVerifiers)
    ? [...new Set(proof.operationInvariantVerifiers)].sort()
    : [];
  requireFact(proof?.remoteIdentity?.source === "authenticated-persisted-installation", "preflight_remote_identity_source");
  requireFact(Boolean(expectedIdentity?.installationId) && Boolean(expectedIdentity?.nppCode), "preflight_expected_identity");
  requireFact(
    proof?.remoteIdentity?.installationId === expectedIdentity.installationId
      && proof?.remoteIdentity?.nppCode === expectedIdentity.nppCode,
    "preflight_remote_identity"
  );
  requireFact(JSON.stringify(invariantVerifiers) === JSON.stringify(expectedOperations), "preflight_invariant_verifiers");
  requireFact(proof?.archiveRetryReclaimVerifier === true, "preflight_archive_verifier");
  requireFact(proof?.r2ProviderCleanupVerifier === true, "preflight_r2_verifier");
  evidence.preflight = { status: "PASS", remoteIdentity: "PASS", invariantVerifiers: "PASS", archiveVerifier: "PASS", r2Verifier: "PASS" };
}

function requireFact(condition, code) {
  if (!condition) throw new Error(`f05_evidence_${code}_not_proven`);
}

export function recordOperationProof(evidence, name, proof) {
  requireFact(proof?.execute?.ok === true, `${name}_execute`);
  requireFact(proof?.execute?.canonical === true && Boolean(proof.execute.requestId), `${name}_canonical_execute`);
  requireFact(proof?.replay?.persisted === true && proof.replay.sameResult === true, `${name}_replay`);
  requireFact(proof?.conflict?.status === 409 && proof.conflict.canonical === true, `${name}_conflict`);
  requireFact(proof?.context?.persisted === true && Boolean(proof.context.installationId) && Boolean(proof.context.actorId), `${name}_context`);
  requireFact(proof?.idempotency?.rowCount === 1 && proof.idempotency.status === "completed" && proof.idempotency.attemptCount === 2, `${name}_idempotency`);
  requireFact(proof?.audit?.succeeded === 1 && proof.audit.replayed === 1 && proof.audit.appendOnly === true, `${name}_audit`);
  requireFact(proof?.invariants?.verified === true, `${name}_invariants`);
  evidence.operations[name] = {
    status: "PASS", execute: "PASS", replay: "PASS", conflict: "PASS", canonicalEnvelope: "PASS",
    requestId: "PASS", context: "PASS", idempotency: "PASS", audit: "PASS", invariants: "PASS"
  };
}

export function recordRetiredPostProof(evidence, path, proof) {
  requireFact(proof?.status === 404 && proof.canonical === true && Boolean(proof.requestId), `${path}_retired_post`);
  evidence.retiredSettingsPosts[path] = "PASS";
}

export function recordArchiveProof(evidence, proof) {
  requireFact(proof?.intentCount === 2 && proof?.jobCount === 2, "archive_persisted_rows");
  requireFact(proof?.minimumJobAttempts >= 2 && proof?.reclaimedJobs >= 1, "archive_retry_reclaim");
  requireFact(proof?.finalizedIntents === 2 && proof?.finalizedJobs === 2, "archive_finalizer");
  requireFact(proof?.separateIntentAndJobTransactions === true, "archive_transaction_boundary");
  evidence.archiveLifecycle = { retry: "PASS", reclaim: "PASS", finalizer: "PASS", noFakeCrossSystemTransaction: "PASS" };
}

export function recordCleanupProof(evidence, proof) {
  requireFact(proof?.databaseRowsRemaining === 0, "cleanup_database_rows");
  requireFact(proof?.r2ProviderVerified === true && proof?.r2ObjectsRemaining === 0, "cleanup_r2_objects");
  evidence.cleanup = { status: "PASS", databaseRows: "PASS", r2Objects: "PASS" };
}

export function finalizeEvidence(evidence) {
  const preflightPass = Object.values(evidence.preflight).every((status) => status === "PASS");
  const operationsPass = Object.values(evidence.operations).every((item) => item.status === "PASS");
  const retiredPass = Object.values(evidence.retiredSettingsPosts).every((status) => status === "PASS");
  const archivePass = Object.values(evidence.archiveLifecycle).every((status) => status === "PASS");
  const cleanupPass = Object.values(evidence.cleanup).every((status) => status === "PASS");
  evidence.NPP_F05_PRODUCTION_OWNERS_RUNTIME_SMOKE = preflightPass && operationsPass && retiredPass && archivePass && cleanupPass ? "PASS" : "FAIL";
  return evidence;
}
