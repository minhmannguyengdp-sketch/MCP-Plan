import { emptyEvidence, finalizeEvidence, recordArchiveProof, recordCleanupProof, recordOperationProof, recordRetiredPostProof } from "./f05-production-smoke-evidence.mjs";
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
      recordOperationProof(evidence, operation.name, result);
    }
    for (const path of RETIRED_SETTINGS_POSTS) {
      recordRetiredPostProof(evidence, path, await driver.proveRetiredPost(path));
    }
    recordArchiveProof(evidence, await driver.proveArchiveLifecycle(fixtures));
  } catch (error) {
    primaryError = error;
  } finally {
    try {
      await driver.cleanupTemporaryFixtures(fixtures);
      recordCleanupProof(evidence, await driver.verifyCleanup(fixtures));
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
