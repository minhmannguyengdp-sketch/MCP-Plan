import { emptyEvidence, finalizeEvidence, passOperation } from "./f05-production-smoke-evidence.mjs";
import { MUTATION_INVENTORY, RETIRED_SETTINGS_POSTS } from "./f05-production-smoke-inventory.mjs";

export async function runF05ProductionOwnersSmoke(driver) {
  const evidence = emptyEvidence();
  let fixtures;
  let primaryError;
  let cleanupError;
  try {
    fixtures = await driver.createTemporaryFixtures();
    for (const operation of MUTATION_INVENTORY) {
      const result = await driver.proveOperation(operation, fixtures);
      passOperation(evidence, operation.name, result);
    }
    for (const path of RETIRED_SETTINGS_POSTS) {
      await driver.proveRetiredPost(path);
      evidence.retiredSettingsPosts[path] = "PASS";
    }
    const archiveLifecycle = await driver.proveArchiveLifecycle(fixtures);
    for (const key of ["retry", "reclaim", "finalizer", "providerR2Create", "providerR2Absence", "noFakeCrossSystemTransaction"]) {
      if (archiveLifecycle?.[key] !== "PASS") throw new Error(`archive_lifecycle_${key}_not_proven`);
    }
    evidence.archiveLifecycle = archiveLifecycle;
  } catch (error) {
    primaryError = error;
  } finally {
    try {
      await driver.cleanupTemporaryFixtures(fixtures);
      await driver.verifyCleanup(fixtures);
      evidence.cleanup = { status: "PASS", databaseRows: "PASS", r2Objects: "PASS" };
    } catch (error) {
      cleanupError = error;
      evidence.cleanup.status = "FAIL";
    }
  }
  finalizeEvidence(evidence);
  if (primaryError || cleanupError) {
    const error = new AggregateError([primaryError, cleanupError].filter(Boolean), "npp_f05_production_smoke_failed");
    error.evidence = evidence;
    throw error;
  }
  return evidence;
}
