import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const path = new URL("./direct-db-mutation-baseline.json", import.meta.url);
const document = JSON.parse(await readFile(path, "utf8"));
assert.equal(document.schemaVersion, 1);
assert.ok(Array.isArray(document.entries));

const desired = [
  {
    fingerprint: "c5e8e2f13e0736350218e4a3",
    classification: "approved-boundary",
    operation: "unknown",
    owner: "session-report-use-case",
    reason: "Backend-owned service-role RPC for canonical session report snapshot creation.",
    replacementPhase: "keep",
    replacementTarget: "mcp_create_session_report_snapshot"
  },
  {
    fingerprint: "7a7337453bd2560b21170115",
    classification: "approved-boundary",
    operation: "unknown",
    owner: "session-report-use-case",
    reason: "Backend-owned service-role RPC for atomic session report AI-result persistence.",
    replacementPhase: "keep",
    replacementTarget: "mcp_save_session_report_ai_result"
  }
];

for (const entry of desired) {
  const existing = document.entries.find((item) => item.fingerprint === entry.fingerprint);
  if (existing) {
    for (const [key, value] of Object.entries(entry)) assert.deepEqual(existing[key], value, `${entry.fingerprint}:${key}`);
  } else {
    document.entries.push(entry);
  }
}

await writeFile(path, `${JSON.stringify(document)}\n`, "utf8");
