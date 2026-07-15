import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { scanRepository } from "./audit-direct-db-mutations.mjs";

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function textReport(result) {
  const lines = [
    result.errors.length ? "direct_db_mutation_policy_failed" : "direct_db_mutation_policy_passed",
    `findings=${result.summary.total}`,
    `legacy_debt=${result.summary.legacyDebt}`,
    `retired_fingerprints=${result.retirements.fingerprintCount}`,
    `completed_phases=${result.retirements.completedPhases.join(",") || "-"}`
  ];

  if (result.errors.length) {
    lines.push("", "errors:");
    for (const error of result.errors) lines.push(`- ${error}`);
  }

  return `${lines.join("\n")}\n`;
}

function validateRetirements(document, baselineEntries, findings) {
  const errors = [];
  const entries = Array.isArray(document.entries) ? document.entries : [];
  const baselineByFingerprint = new Map(baselineEntries.map((entry) => [entry.fingerprint, entry]));
  const liveFingerprints = new Set(findings.map((finding) => finding.fingerprint));
  const seenPhases = new Set();
  const seenFingerprints = new Set();
  const retiredFingerprints = new Set();
  const completedPhases = [];

  if (document.schemaVersion !== 1) errors.push("invalid_retirement_schema_version");

  for (const entry of entries) {
    for (const field of ["phase", "completedAt", "owner", "reason"]) {
      if (!String(entry?.[field] || "").trim()) errors.push(`retirement_entry_missing_${field}`);
    }

    const phase = String(entry?.phase || "").trim();
    if (phase) {
      if (seenPhases.has(phase)) errors.push(`duplicate_retirement_phase:${phase}`);
      seenPhases.add(phase);
      completedPhases.push(phase);
    }

    const fingerprints = Array.isArray(entry?.fingerprints) ? entry.fingerprints : [];
    if (fingerprints.length === 0) errors.push(`retirement_phase_without_fingerprints:${phase || "unknown"}`);

    for (const fingerprint of fingerprints) {
      if (seenFingerprints.has(fingerprint)) errors.push(`duplicate_retired_fingerprint:${fingerprint}`);
      seenFingerprints.add(fingerprint);
      retiredFingerprints.add(fingerprint);

      const baseline = baselineByFingerprint.get(fingerprint);
      if (!baseline) {
        errors.push(`retirement_unknown_baseline_fingerprint:${fingerprint}`);
        continue;
      }
      if (baseline.classification !== "known-legacy-debt") {
        errors.push(`retirement_not_legacy_debt:${fingerprint}`);
      }
      if (phase && baseline.replacementPhase !== phase) {
        errors.push(`retirement_phase_mismatch:${fingerprint}:${baseline.replacementPhase}:${phase}`);
      }
      if (liveFingerprints.has(fingerprint)) {
        errors.push(`retired_finding_still_live:${fingerprint}`);
      }
    }
  }

  return {
    errors,
    retiredFingerprints,
    completedPhases: uniqueSorted(completedPhases)
  };
}

export async function auditDirectDbMutationPolicy({
  root = process.cwd(),
  scanRoots,
  baselinePath = "scripts/direct-db-mutation-baseline.json",
  retirementsPath = "scripts/direct-db-mutation-retirements.json",
  writeReports = true,
  findingsTextPath = "direct-db-mutation-findings.txt",
  findingsJsonPath = "direct-db-mutation-findings.json"
} = {}) {
  const result = await scanRepository({
    root,
    scanRoots,
    baselinePath,
    writeReports: false
  });

  const baselineDocument = JSON.parse(await readFile(path.join(root, baselinePath), "utf8"));
  const retirementDocument = JSON.parse(await readFile(path.join(root, retirementsPath), "utf8"));
  const baselineEntries = Array.isArray(baselineDocument.entries) ? baselineDocument.entries : [];
  const policy = validateRetirements(retirementDocument, baselineEntries, result.findings);

  const errors = result.errors.filter((error) => {
    if (!error.startsWith("stale_baseline:")) return true;
    const fingerprint = error.slice("stale_baseline:".length);
    return !policy.retiredFingerprints.has(fingerprint);
  });
  errors.push(...policy.errors);

  const policyResult = {
    ...result,
    errors: uniqueSorted(errors),
    retirements: {
      completedPhases: policy.completedPhases,
      fingerprintCount: policy.retiredFingerprints.size
    }
  };

  if (writeReports) {
    await writeFile(path.join(root, findingsTextPath), textReport(policyResult), "utf8");
    await writeFile(path.join(root, findingsJsonPath), `${JSON.stringify(policyResult, null, 2)}\n`, "utf8");
  }

  return policyResult;
}

async function main() {
  try {
    const result = await auditDirectDbMutationPolicy();
    const report = textReport(result);
    if (result.errors.length) {
      console.error(report.trimEnd());
      process.exitCode = 1;
    } else {
      console.log(report.trimEnd());
    }
  } catch (error) {
    console.error(`direct_db_mutation_policy_failed\n- policy_error:${error?.message || String(error)}`);
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await main();
