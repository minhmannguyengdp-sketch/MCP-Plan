import { readFile, writeFile } from "node:fs/promises";

const path = "scripts/direct-db-mutation-baseline.json";
const baseline = JSON.parse(await readFile(path, "utf8"));
const fingerprint = "fdb8534a5fa190e47190a2be";

if (!Array.isArray(baseline.entries)) throw new Error("baseline_entries_missing");
if (!baseline.entries.some((entry) => entry.fingerprint === fingerprint)) {
  baseline.entries.push({
    fingerprint,
    classification: "approved-boundary",
    operation: "mutation",
    owner: "session-customer-checkin-idempotent-use-case",
    reason: "Typed Foundation wrapper for explicit manual sales check-in; persisted idempotency, business mutation and append-only audit share one PostgreSQL transaction.",
    replacementPhase: "keep"
  });
}

await writeFile(path, `${JSON.stringify(baseline)}\n`, "utf8");
console.log("session_checkin_boundary_registered");
