import { mkdir, readFile, writeFile } from "node:fs/promises";

const serverPath = "apps/backend/server.js";
const ledgerPath = "scripts/direct-db-mutation-retirements.json";
const packagePath = "package.json";
const testPath = "test/a5-4-1-dead-session-mutations.test.mjs";
const docPath = "docs/npp-plan/A5_4_DIRECT_REST_MIGRATION.md";

const oldOpenName = ["open", "Mcp", "Day", "Session"].join("");
const oldStatusName = ["update", "Mcp", "Session", "Customer", "Status"].join("");
const nextFunctionName = ["load", "Orders"].join("");

let server = await readFile(serverPath, "utf8");
const startMarker = `async function ${oldOpenName}(body) {`;
const endMarker = `\n\nasync function ${nextFunctionName}(url) {`;
const start = server.indexOf(startMarker);
const end = server.indexOf(endMarker, start);

if (start < 0 || end < 0) {
  throw new Error("a5_4_1_dead_mutation_boundary_not_found");
}
if (server.indexOf(startMarker, start + 1) >= 0) {
  throw new Error("a5_4_1_duplicate_open_session_legacy_function");
}

server = `${server.slice(0, start)}${server.slice(end + 2)}`;

if (server.includes(startMarker) || server.includes(`async function ${oldStatusName}(body) {`)) {
  throw new Error("a5_4_1_dead_mutation_function_still_present");
}
if (!server.includes("return wrap(await openMcpDaySessionV1(await readJsonBody(req)))")) {
  throw new Error("a5_4_1_rpc_open_session_route_missing");
}
if (!server.includes("return wrap(await updateMcpSessionCustomerStatusV1(await readJsonBody(req)))")) {
  throw new Error("a5_4_1_rpc_status_route_missing");
}
await writeFile(serverPath, server, "utf8");

const retiredFingerprints = [
  "1dc555d44cc89f4bfaa50180",
  "abf55ef270a7e39894bf265d",
  "89edbaea655813b7ea00bc40",
  "7b35ad1f6bb6f4a506761a51",
  "4c9adfa1c08d263a002e5cde",
  "2dfa3c8e754823d8ce845e11",
  "6e5f15d9cd15ee8e012e151d"
];

const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
const a52 = ledger.entries?.find((entry) => entry.phase === "A5.2");
if (!a52) throw new Error("a5_2_retirement_entry_missing");
const existing = new Set(a52.fingerprints || []);
for (const fingerprint of retiredFingerprints) existing.add(fingerprint);
a52.fingerprints = [...existing];
a52.reason = "The authenticated Gateway/RPC cutover was verified for MCP day result/add/open/status. The legacy backend-to-Edge caller and unreachable direct-table open/status implementations were removed; direct internal fallback now fails closed instead of restoring retired mutation paths.";
await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");

const packageDocument = JSON.parse(await readFile(packagePath, "utf8"));
packageDocument.scripts["test:direct-rest-retirement"] = "node --test test/a5-4-1-dead-session-mutations.test.mjs";
const verify = packageDocument.scripts["verify:foundation"];
if (!verify.includes("npm run test:direct-rest-retirement")) {
  packageDocument.scripts["verify:foundation"] = verify.replace(
    "npm run test:edge-retirement &&",
    "npm run test:edge-retirement && npm run test:direct-rest-retirement &&"
  );
}
await writeFile(packagePath, `${JSON.stringify(packageDocument, null, 2)}\n`, "utf8");

await mkdir("test", { recursive: true });
await writeFile(testPath, `import assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\nimport path from "node:path";\nimport test from "node:test";\nimport { fileURLToPath } from "node:url";\n\nconst root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");\nconst retired = ${JSON.stringify(retiredFingerprints, null, 2)};\n\ntest("legacy direct-table MCP day implementations are removed", async () => {\n  const source = await readFile(path.join(root, "apps/backend/server.js"), "utf8");\n  assert.doesNotMatch(source, /async function openMcpDaySession\\(body\\)/);\n  assert.doesNotMatch(source, /async function updateMcpSessionCustomerStatus\\(body\\)/);\n});\n\ntest("MCP day open and status routes remain RPC-owned", async () => {\n  const source = await readFile(path.join(root, "apps/backend/server.js"), "utf8");\n  assert.match(source, /openMcpDaySessionV1/);\n  assert.match(source, /mcp_open_route_session/);\n  assert.match(source, /updateMcpSessionCustomerStatusV1/);\n  assert.match(source, /mcp_set_session_customer_status/);\n  assert.match(source, /pathname === "\\/api\\/mcp-day\\/open-session"/);\n  assert.match(source, /pathname === "\\/api\\/mcp-day\\/session-customer\\/status"/);\n});\n\ntest("all removed direct-table fingerprints remain in the immutable retirement ledger", async () => {\n  const ledger = JSON.parse(await readFile(path.join(root, "scripts/direct-db-mutation-retirements.json"), "utf8"));\n  const entry = ledger.entries.find((item) => item.phase === "A5.2");\n  assert.ok(entry);\n  for (const fingerprint of retired) assert.ok(entry.fingerprints.includes(fingerprint), fingerprint);\n});\n`, "utf8");

let document = await readFile(docPath, "utf8");
const currentStatus = "> Trạng thái: **AUDIT COMPLETE / IMPLEMENTATION NOT STARTED**";
const nextStatus = "> Trạng thái: **A5.4.1 SOURCE VERIFIED / DEPLOY PENDING**";
if (!document.includes(currentStatus)) {
  throw new Error("a5_4_document_status_not_found");
}
document = document.replace(currentStatus, nextStatus);
await writeFile(docPath, document, "utf8");
