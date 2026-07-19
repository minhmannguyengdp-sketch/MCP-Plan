import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const endpoints = [
  "order-template",
  "test-template",
  "report-template",
  "followup-template",
  "skip-reason-template",
  "customer-add-rule",
  "session-status"
].map((name) => `/mcp-settings/${name}`);

async function sourceFiles(root) {
  const output = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) output.push(...await sourceFiles(full));
    else if (/\.(?:js|jsx|mjs|ts|tsx)$/.test(entry.name)) output.push(full);
  }
  return output;
}

test("inventory every route-settings browser caller before onboarding", async () => {
  const files = await sourceFiles(path.resolve("src"));
  const inventory = Object.fromEntries(endpoints.map((endpoint) => [endpoint, []]));

  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const endpoint of endpoints) {
      if (!source.includes(endpoint)) continue;
      const lines = source.split("\n");
      lines.forEach((line, index) => {
        if (line.includes(endpoint)) inventory[endpoint].push({ file: path.relative(process.cwd(), file), line: index + 1, text: line.trim().slice(0, 240) });
      });
    }
  }

  assert.fail(`A5_5_2_ROUTE_SETTINGS_CALLER_INVENTORY=${JSON.stringify(inventory)}`);
});
