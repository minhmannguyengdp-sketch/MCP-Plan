import { readFile, writeFile } from "node:fs/promises";

const path = "scripts/direct-db-mutation-baseline.json";
const document = JSON.parse(await readFile(path, "utf8"));

const staleFingerprints = new Set([
  "205cbf1bcddd7e63364066d4",
  "62d0c35b7528d138336878e3",
  "7a7337453bd2560b21170115",
  "9c0c82bc255db9f5e5285357",
  "9c1f2871e3e5eb7d0f3aaeb2",
  "bbedf7572ccc5d25b28b1a72",
  "c57005a3f54aefdbc4daa312",
  "c5e8e2f13e0736350218e4a3",
  "dc5c912dccbed63ffa58105d"
]);

const replacements = [
  {
    fingerprint: "59f0325bda5b06a6fa9ed176",
    classification: "approved-boundary",
    operation: "mutation",
    owner: "session-customer-idempotent-use-case",
    reason: "A5.5.1 typed idempotent wrapper for session-customer result recording; claim, business mutation, audit and response completion share one PostgreSQL transaction.",
    replacementPhase: "keep"
  },
  {
    fingerprint: "d18d136e09d9cba5edf863ff",
    classification: "approved-boundary",
    operation: "mutation",
    owner: "session-customer-idempotent-use-case",
    reason: "A5.5.1 typed idempotent wrapper for explicit session-customer add; claim, business mutation, audit and response completion share one PostgreSQL transaction.",
    replacementPhase: "keep"
  },
  {
    fingerprint: "e5974499a59cf5b9a22291ff",
    classification: "approved-boundary",
    operation: "mutation",
    owner: "session-report-idempotent-use-case",
    reason: "A5.5.1 typed idempotent wrapper for session-report snapshot creation with persisted Foundation context and replay semantics.",
    replacementPhase: "keep"
  },
  {
    fingerprint: "995947968c708b6e2f5c4106",
    classification: "approved-boundary",
    operation: "mutation",
    owner: "session-report-idempotent-use-case",
    reason: "A5.5.1 typed idempotent wrapper for session-report AI result persistence with atomic audit and replay semantics.",
    replacementPhase: "keep"
  },
  {
    fingerprint: "5c6180b65c078bbf2532e0fa",
    classification: "approved-boundary",
    operation: "mutation",
    owner: "field-check-idempotent-use-case",
    reason: "A5.5.1 typed idempotent wrapper for locked field-check updates with atomic audit and replay semantics.",
    replacementPhase: "keep"
  },
  {
    fingerprint: "0318944f225a8ea61b650303",
    classification: "approved-boundary",
    operation: "mutation",
    owner: "report-setting-idempotent-use-case",
    reason: "A5.5.1 typed idempotent wrapper for report-setting group creation with atomic audit and replay semantics.",
    replacementPhase: "keep"
  },
  {
    fingerprint: "d21bf9c7d27f9450a088d056",
    classification: "approved-boundary",
    operation: "mutation",
    owner: "report-setting-idempotent-use-case",
    reason: "A5.5.1 typed idempotent wrapper for report-setting group updates with atomic audit and replay semantics.",
    replacementPhase: "keep"
  },
  {
    fingerprint: "6f9f69403cf61f1c2e675acd",
    classification: "approved-boundary",
    operation: "mutation",
    owner: "report-setting-idempotent-use-case",
    reason: "A5.5.1 typed idempotent wrapper for report-setting item creation with atomic audit and replay semantics.",
    replacementPhase: "keep"
  },
  {
    fingerprint: "dc1a249413e4dcf4415b769c",
    classification: "approved-boundary",
    operation: "mutation",
    owner: "report-setting-idempotent-use-case",
    reason: "A5.5.1 typed idempotent wrapper for report-setting item updates with atomic audit and replay semantics.",
    replacementPhase: "keep"
  }
];

const entries = Array.isArray(document.entries) ? document.entries : [];
const removed = entries.filter((entry) => staleFingerprints.has(entry.fingerprint));
if (removed.length !== staleFingerprints.size) {
  const found = new Set(removed.map((entry) => entry.fingerprint));
  const missing = [...staleFingerprints].filter((fingerprint) => !found.has(fingerprint));
  throw new Error(`missing_stale_baseline:${missing.join(",")}`);
}

const replacementFingerprints = new Set(replacements.map((entry) => entry.fingerprint));
const preserved = entries.filter(
  (entry) => !staleFingerprints.has(entry.fingerprint) && !replacementFingerprints.has(entry.fingerprint)
);

document.entries = [...preserved, ...replacements];
await writeFile(path, `${JSON.stringify(document)}\n`, "utf8");
console.log(JSON.stringify({ removed: removed.length, added: replacements.length }));
