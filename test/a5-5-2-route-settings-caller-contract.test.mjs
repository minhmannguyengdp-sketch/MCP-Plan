import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ignoredDirectories = new Set([".git", ".next", "node_modules", "coverage"]);
const needles = [
  "/api/mcp-settings/order-template",
  "/api/mcp-settings/test-template",
  "/api/mcp-settings/report-template",
  "/api/mcp-settings/followup-template",
  "/api/mcp-settings/skip-reason-template",
  "/api/mcp-settings/customer-add-rule",
  "/api/mcp-settings/session-status",
  "saveMcpOrderTemplateSettings",
  "saveMcpTestTemplateSettings",
  "saveMcpReportTemplateSettings",
  "saveMcpFollowupTemplateSettings",
  "saveMcpSkipReasonTemplateSettings",
  "saveMcpCustomerAddRuleSettings",
  "saveMcpRouteSessionStatusSettings"
];

async function sourceFiles(root) {
  const output = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) output.push(...await sourceFiles(full));
    else if (/\.(?:js|jsx|mjs|ts|tsx|md|json|yml|yaml)$/.test(entry.name)) output.push(full);
  }
  return output;
}

test("inventory all legacy route-settings references before retirement decision", async () => {
  const files = await sourceFiles(process.cwd());
  const inventory = [];

  for (const file of files) {
    if (file.endsWith("test/a5-5-2-route-settings-caller-contract.test.mjs")) continue;
    const source = await readFile(file, "utf8");
    if (!needles.some((needle) => source.includes(needle))) continue;
    source.split("\n").forEach((line, index) => {
      const matches = needles.filter((needle) => line.includes(needle));
      if (matches.length) inventory.push({
        file: path.relative(process.cwd(), file),
        line: index + 1,
        matches,
        text: line.trim().slice(0, 1200)
      });
    });
  }

  await writeFile("route-settings-caller-inventory.json", `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
  assert.ok(inventory.length > 0);
});
