import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { scanRepository } from "../audit-direct-db-mutations.mjs";

async function makeRepo(files = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "mcp-direct-db-audit-"));
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, "utf8");
  }
  await mkdir(path.join(root, "scripts"), { recursive: true });
  await writeBaseline(root, []);
  return root;
}

async function writeBaseline(root, entries) {
  await writeFile(
    path.join(root, "scripts/direct-db-mutation-baseline.json"),
    `${JSON.stringify({ schemaVersion: 1, entries }, null, 2)}\n`,
    "utf8"
  );
}

function auditedEntry(finding, classification, overrides = {}) {
  return {
    fingerprint: finding.fingerprint,
    classification,
    operation: finding.operation,
    owner: "foundation-boundary",
    reason: classification === "approved-boundary"
      ? "Provider access is intentionally owned by the audited adapter."
      : "Known legacy provider coupling scheduled for replacement.",
    replacementPhase: classification === "approved-boundary" ? "keep" : "A5.2",
    replacementTarget: classification === "approved-boundary" ? "provider adapter" : "application use case",
    ...overrides
  };
}

async function scan(root, scanRoots) {
  return scanRepository({ root, scanRoots, writeReports: false });
}

async function withRepo(files, callback) {
  const root = await makeRepo(files);
  try {
    await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("browser direct insert is forbidden", async () => {
  await withRepo({
    "src/app/page.tsx": `"use client";\nconst save = () => supabase.from("orders").insert({ id: 1 });\n`
  }, async (root) => {
    const result = await scan(root, ["src"]);
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].classification, "forbidden");
    assert.ok(result.errors.some((error) => error.startsWith("browser_direct_mutation:")));
  });
});

test("approved backend adapter mutation passes", async () => {
  await withRepo({
    "apps/backend/foundation/provider.js": `export async function writeProvider(config, body) {\n  return fetch(new URL("/rest/v1/orders", config.url), { method: "POST", body: JSON.stringify(body) });\n}\n`
  }, async (root) => {
    const first = await scan(root, ["apps/backend"]);
    assert.equal(first.findings.length, 1);
    await writeBaseline(root, [auditedEntry(first.findings[0], "approved-boundary")]);
    const second = await scan(root, ["apps/backend"]);
    assert.deepEqual(second.errors, []);
    assert.equal(second.summary.approved, 1);
  });
});

test("known legacy finding passes and remains visible as debt", async () => {
  await withRepo({
    "apps/backend/foundation/transitional.js": `export async function saveLegacy(config, body) {\n  return supabaseRest(config, "market_reports", { method: "POST", body });\n}\n`
  }, async (root) => {
    const first = await scan(root, ["apps/backend"]);
    assert.equal(first.findings.length, 1);
    await writeBaseline(root, [auditedEntry(first.findings[0], "known-legacy-debt")]);
    const second = await scan(root, ["apps/backend"]);
    assert.deepEqual(second.errors, []);
    assert.equal(second.summary.legacyDebt, 1);
  });
});

test("new finding outside baseline fails", async () => {
  await withRepo({
    "apps/backend/new-write.js": `export async function save(config, body) {\n  return supabasePatch("orders", body);\n}\n`
  }, async (root) => {
    const result = await scan(root, ["apps/backend"]);
    assert.equal(result.summary.unclassified, 1);
    assert.ok(result.errors.some((error) => error.startsWith("unclassified_finding:")));
  });
});

test("stale baseline fails", async () => {
  await withRepo({}, async (root) => {
    await writeBaseline(root, [{
      fingerprint: "deadbeefdeadbeefdeadbeef",
      classification: "known-legacy-debt",
      operation: "mutation",
      owner: "legacy-backend",
      reason: "Fixture stale entry.",
      replacementPhase: "A5.2",
      replacementTarget: "application use case"
    }]);
    const result = await scan(root, ["src"]);
    assert.ok(result.errors.includes("stale_baseline:deadbeefdeadbeefdeadbeef"));
  });
});

test("REST GET is classified as read, not mutation", async () => {
  await withRepo({
    "src/lib/report-source.ts": `export async function loadReport(config) {\n  return fetch(new URL("/rest/v1/mcp_session_reports", config.url), { method: "GET" });\n}\n`
  }, async (root) => {
    const first = await scan(root, ["src"]);
    assert.equal(first.findings.length, 1);
    assert.equal(first.findings[0].operation, "read");
    await writeBaseline(root, [auditedEntry(first.findings[0], "approved-boundary")]);
    const second = await scan(root, ["src"]);
    assert.deepEqual(second.errors, []);
    assert.equal(second.summary.read, 1);
    assert.equal(second.summary.mutation, 0);
  });
});

test("Edge Function service-role mutation is detected and must be legacy debt", async () => {
  await withRepo({
    "supabase/functions/mcp-day/index.ts": `const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");\nexport async function saveVisit(url, body) {\n  return fetch(new URL("/rest/v1/mcp_visits", url), { method: "POST", body: JSON.stringify(body) });\n}\n`
  }, async (root) => {
    const first = await scan(root, ["supabase"]);
    assert.equal(first.findings.length, 1);
    assert.equal(first.findings[0].consumer, "edge");
    assert.equal(first.findings[0].usesServiceRole, true);
    assert.ok(first.errors.some((error) => error.startsWith("public_edge_mutation_not_legacy_debt:")));
    await writeBaseline(root, [auditedEntry(first.findings[0], "known-legacy-debt", {
      owner: "edge-retirement",
      replacementPhase: "A5.3"
    })]);
    const second = await scan(root, ["supabase"]);
    assert.deepEqual(second.errors, []);
  });
});

test("generated and dependency directories are not scanned", async () => {
  await withRepo({
    "src/clean.ts": `export const clean = true;\n`,
    "src/node_modules/bad.js": `supabase.from("orders").insert({});\n`,
    "src/.next/bad.js": `supabase.from("orders").insert({});\n`,
    "src/dist/bad.js": `supabase.from("orders").insert({});\n`,
    "src/build/bad.js": `supabase.from("orders").insert({});\n`,
    "src/coverage/bad.js": `supabase.from("orders").insert({});\n`
  }, async (root) => {
    const result = await scan(root, ["src"]);
    assert.equal(result.findings.length, 0);
  });
});

test("CLI report files are valid JSON and text even when audit fails", async () => {
  await withRepo({
    "apps/backend/new-write.js": `export async function save(config, body) {\n  return supabaseInsert("orders", body);\n}\n`
  }, async (root) => {
    const result = await scanRepository({ root, scanRoots: ["apps/backend"], writeReports: true });
    assert.ok(result.errors.length > 0);
    const json = JSON.parse(await readFile(path.join(root, "direct-db-mutation-findings.json"), "utf8"));
    const text = await readFile(path.join(root, "direct-db-mutation-findings.txt"), "utf8");
    assert.equal(json.summary.total, 1);
    assert.match(text, /direct_db_mutation_audit_failed/);
  });
});
