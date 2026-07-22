import { MUTATION_INVENTORY, RETIRED_SETTINGS_POSTS } from "./f05-production-smoke-inventory.mjs";

export function emptyEvidence() {
  return {
    NPP_F05_PRODUCTION_OWNERS_RUNTIME_SMOKE: "PENDING",
    generatedAt: new Date().toISOString(),
    operations: Object.fromEntries(MUTATION_INVENTORY.map(({ name }) => [name, { status: "PENDING" }])),
    retiredSettingsPosts: Object.fromEntries(RETIRED_SETTINGS_POSTS.map((path) => [path, "PENDING"])),
    archiveLifecycle: { retry: "PENDING", reclaim: "PENDING", finalizer: "PENDING", providerR2Create: "PENDING", providerR2Absence: "PENDING", noFakeCrossSystemTransaction: "PENDING" },
    cleanup: { status: "PENDING", databaseRows: "PENDING", r2Objects: "PENDING" }
  };
}

export function passOperation(evidence, name, details = {}) {
  evidence.operations[name] = {
    status: "PASS", execute: "PASS", replay: "PASS", conflict: "PASS",
    canonicalEnvelope: "PASS", requestId: "PASS", context: "PASS", persistedContext: "PASS", idempotency: "PASS", audit: "PASS",
    invariants: "PASS", ...details
  };
}

export function finalizeEvidence(evidence) {
  const operationsPass = Object.values(evidence.operations).every((item) => item.status === "PASS");
  const retiredPass = Object.values(evidence.retiredSettingsPosts).every((status) => status === "PASS");
  const archivePass = Object.values(evidence.archiveLifecycle).every((status) => status === "PASS");
  const cleanupPass = Object.values(evidence.cleanup).every((status) => status === "PASS");
  evidence.NPP_F05_PRODUCTION_OWNERS_RUNTIME_SMOKE = operationsPass && retiredPass && archivePass && cleanupPass ? "PASS" : "FAIL";
  return evidence;
}
