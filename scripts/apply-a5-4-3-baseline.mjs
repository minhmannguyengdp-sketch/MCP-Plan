import { readFile, writeFile } from "node:fs/promises";

const path = "scripts/direct-db-mutation-baseline.json";
const document = JSON.parse(await readFile(path, "utf8"));
const additions = [
  {
    fingerprint: "205cbf1bcddd7e63364066d4",
    classification: "approved-boundary",
    operation: "mutation",
    owner: "report-settings-use-case",
    reason: "A5.4.3 backend-owned service-role RPC for report setting group creation.",
    replacementPhase: "keep"
  },
  {
    fingerprint: "bbedf7572ccc5d25b28b1a72",
    classification: "approved-boundary",
    operation: "mutation",
    owner: "report-settings-use-case",
    reason: "A5.4.3 backend-owned service-role RPC for report setting group updates.",
    replacementPhase: "keep"
  },
  {
    fingerprint: "dc5c912dccbed63ffa58105d",
    classification: "approved-boundary",
    operation: "mutation",
    owner: "report-settings-use-case",
    reason: "A5.4.3 backend-owned service-role RPC for report setting item creation.",
    replacementPhase: "keep"
  },
  {
    fingerprint: "9c1f2871e3e5eb7d0f3aaeb2",
    classification: "approved-boundary",
    operation: "mutation",
    owner: "report-settings-use-case",
    reason: "A5.4.3 backend-owned service-role RPC for report setting item updates.",
    replacementPhase: "keep"
  }
];

if (!Array.isArray(document.entries)) throw new Error("invalid_baseline_entries");
const byFingerprint = new Map(document.entries.map((entry) => [entry.fingerprint, entry]));
for (const addition of additions) {
  const existing = byFingerprint.get(addition.fingerprint);
  if (existing) {
    if (JSON.stringify(existing) !== JSON.stringify(addition)) {
      throw new Error(`baseline_entry_conflict:${addition.fingerprint}`);
    }
    continue;
  }
  document.entries.push(addition);
}

await writeFile(path, `${JSON.stringify(document)}\n`, "utf8");
