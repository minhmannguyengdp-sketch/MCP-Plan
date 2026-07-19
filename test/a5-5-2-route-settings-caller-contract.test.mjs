import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

async function sourceFiles(root) {
  const output = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) output.push(...await sourceFiles(full));
    else if (/\.(?:js|jsx|mjs|ts|tsx)$/.test(entry.name)) output.push(full);
  }
  return output;
}

test("inventory dynamic MCP settings browser callers before onboarding", async () => {
  const files = await sourceFiles(path.resolve("src"));
  const inventory = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (!source.includes("mcp-settings")) continue;
    source.split("\n").forEach((line, index) => {
      if (line.includes("mcp-settings")) inventory.push({
        file: path.relative(process.cwd(), file),
        line: index + 1,
        text: line.trim().slice(0, 1000)
      });
    });
  }

  await writeFile("route-settings-caller-inventory.json", `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
  assert.ok(inventory.length > 0);
});
