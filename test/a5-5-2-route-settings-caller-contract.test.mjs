import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const retiredRoutes = [
  "order-template",
  "test-template",
  "report-template",
  "followup-template",
  "skip-reason-template",
  "customer-add-rule",
  "session-status"
];

const retiredSymbols = [
  "normalizeMcpOrderTemplateItems",
  "saveMcpOrderTemplateSettings",
  "normalizeMcpTestTemplateItems",
  "saveMcpTestTemplateSettings",
  "saveMcpReportTemplateSettings",
  "saveMcpFollowupTemplateSettings",
  "normalizeMcpSkipReasonItems",
  "saveMcpSkipReasonTemplateSettings",
  "normalizeMcpCustomerAddMode",
  "saveMcpCustomerAddRuleSettings",
  "normalizeMcpRouteSessionStatus",
  "saveMcpRouteSessionStatusSettings"
];

async function sourceFiles(root) {
  const output = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) output.push(...await sourceFiles(full));
    else if (/\.(?:js|jsx|mjs|ts|tsx)$/.test(entry.name)) output.push(full);
  }
  return output;
}

test("dead route-settings POST handlers and save helpers stay retired", async () => {
  const server = await readFile("apps/backend/server.js", "utf8");
  const postOwner = server.slice(server.indexOf("async function handlePost"), server.indexOf("async function handleGet"));

  for (const route of retiredRoutes) {
    assert.doesNotMatch(postOwner, new RegExp(`/api/mcp-settings/${route.replaceAll("-", "\\-")}`), route);
  }
  for (const symbol of retiredSymbols) assert.doesNotMatch(server, new RegExp(`\\b${symbol}\\b`), symbol);
});

test("required legacy GET readers remain available during source retirement", async () => {
  const server = await readFile("apps/backend/server.js", "utf8");
  const getOwner = server.slice(server.indexOf("async function handleGet"));

  for (const route of ["order-template", "skip-reason-template", "customer-add-rule", "session-status"]) {
    assert.match(getOwner, new RegExp(`/api/mcp-settings/${route.replaceAll("-", "\\-")}`), route);
  }
  assert.match(getOwner, /\/api\/mcp-settings\/templates/);
});

test("current MCP settings UI remains on the typed idempotent report-settings owner", async () => {
  const page = await readFile("src/features/mcp-settings/McpReportSettingsPage.tsx", "utf8");
  assert.match(page, /const REPORT_SETTINGS_API = "\/api\/mcp-report-settings"/);
  assert.match(page, /idempotentMutationFetch\(path[\s\S]*?report-setting-item\.\$\{method\.toLowerCase\(\)\}/);
  for (const route of retiredRoutes) assert.doesNotMatch(page, new RegExp(`/api/mcp-settings/${route}`), route);
});

test("no live source caller posts to a retired route-settings endpoint", async () => {
  const files = await sourceFiles(path.resolve("src"));
  const references = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const route of retiredRoutes) {
      const endpoint = `/api/mcp-settings/${route}`;
      if (source.includes(endpoint)) references.push({ file: path.relative(process.cwd(), file), route, source });
    }
  }

  assert.deepEqual(
    references.map(({ file, route }) => ({ file, route })),
    [
      { file: "src/lib/api/api-client.ts", route: "session-status" }
    ]
  );

  const apiClient = references[0].source;
  assert.match(apiClient, /fetchJson<McpSessionStatusData>\([\s\S]*?"\/api\/mcp-settings\/session-status"/);
  assert.doesNotMatch(apiClient, /post(?:Idempotent)?Json[^\n]*\/api\/mcp-settings\/session-status/);
});
