import { mkdir, readFile, writeFile } from "node:fs/promises";

const serverPath = "apps/backend/server.js";
const retirementPath = "scripts/direct-db-mutation-retirements.json";
const packagePath = "package.json";
const testPath = "test/a5-3-no-legacy-edge-caller.test.mjs";
const docPath = "docs/npp-plan/A5_3_EDGE_RETIREMENT.md";

const helperName = ["proxy", "Supabase", "Function"].join("");
const rpcHelperName = ["supabase", "Rpc"].join("");
const retiredFunctionName = ["mcp", "-day", "-8b3"].join("");

let server = await readFile(serverPath, "utf8");
const helperSignature = `async function ${helperName}(functionName, body, extraBody = {}) {`;
const helperStart = server.indexOf(helperSignature);
const helperEndMarker = `\n\nasync function ${rpcHelperName}(functionName, args = {}) {`;
const helperEnd = server.indexOf(helperEndMarker, helperStart);

if (helperStart < 0 || helperEnd < 0) {
  throw new Error("legacy_edge_proxy_helper_boundary_not_found");
}

server = `${server.slice(0, helperStart)}${server.slice(helperEnd + 2)}`;

const legacyRoutes = [
  `  if (url.pathname === "/api/mcp-day/session-customer/result") return wrap(await ${helperName}("${retiredFunctionName}", await readJsonBody(req)));\n`,
  `  if (url.pathname === "/api/mcp-day/session-customer/add") return wrap(await ${helperName}("${retiredFunctionName}", await readJsonBody(req), { action: "add" }));\n`
];

for (const route of legacyRoutes) {
  const occurrences = server.split(route).length - 1;
  if (occurrences !== 1) {
    throw new Error(`legacy_edge_route_occurrences:${occurrences}`);
  }
  server = server.replace(route, "");
}

if (server.includes(helperName) || server.includes(retiredFunctionName)) {
  throw new Error("legacy_edge_caller_still_present");
}

await writeFile(serverPath, server, "utf8");

const retirementDocument = JSON.parse(await readFile(retirementPath, "utf8"));
if (!Array.isArray(retirementDocument.entries)) {
  throw new Error("invalid_retirement_document");
}
if (retirementDocument.entries.some((entry) => entry.phase === "A5.2")) {
  throw new Error("a5_2_retirement_already_recorded");
}
retirementDocument.entries.unshift({
  phase: "A5.2",
  completedAt: "2026-07-15",
  owner: "legacy-backend",
  reason: "The legacy server fallback caller to mcp-day-8b3 was removed after the authenticated Gateway result/add cutover was verified. Direct internal fallback now fails closed instead of restoring the retired Edge hop.",
  fingerprints: ["554f43f7c06fc8a9a4da0b21"]
});
await writeFile(retirementPath, `${JSON.stringify(retirementDocument, null, 2)}\n`, "utf8");

const packageDocument = JSON.parse(await readFile(packagePath, "utf8"));
packageDocument.scripts["test:edge-retirement"] = "node --test test/a5-3-edge-retirement.test.mjs test/a5-3-no-legacy-edge-caller.test.mjs";
await writeFile(packagePath, `${JSON.stringify(packageDocument, null, 2)}\n`, "utf8");

await mkdir("test", { recursive: true });
await writeFile(testPath, `import assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\nimport path from "node:path";\nimport test from "node:test";\nimport { fileURLToPath } from "node:url";\n\nconst repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");\n\ntest("legacy server cannot call retired MCP day Edge functions", async () => {\n  const source = await readFile(path.join(repositoryRoot, "apps/backend/server.js"), "utf8");\n  assert.doesNotMatch(source, /proxySupabaseFunction\\s*\\(/);\n  assert.doesNotMatch(source, /["'\\\`]mcp-day-8b3["'\\\`]/);\n  assert.doesNotMatch(source, /["'\\\`]mcp-day-followup["'\\\`]/);\n});\n\ntest("canonical result and add remain owned by the Foundation transitional API", async () => {\n  const source = await readFile(path.join(repositoryRoot, "apps/backend/foundation/transitional-api.js"), "utf8");\n  assert.match(source, /pathname === "\\/api\\/mcp-day\\/session-customer\\/result"/);\n  assert.match(source, /return saveSessionCustomerResult\\(/);\n  assert.match(source, /pathname === "\\/api\\/mcp-day\\/session-customer\\/add"/);\n  assert.match(source, /return saveAddedSessionCustomer\\(/);\n});\n`, "utf8");

let document = await readFile(docPath, "utf8");
const previousStatus = "> Trạng thái: **IMPLEMENTING / SOURCE PREPARED / PRODUCTION NOT YET DEPLOYED**";
const nextStatus = "> Trạng thái: **SOURCE COMPLETE / EDGE DEPLOYED / VPS PULL PENDING**";
if (!document.includes(previousStatus)) {
  throw new Error("a5_3_document_status_not_found");
}
document = document.replace(previousStatus, nextStatus);
await writeFile(docPath, document, "utf8");
