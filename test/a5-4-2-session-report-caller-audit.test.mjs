import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(root, "src");
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"]);

async function filesBelow(directory) {
  const info = await stat(directory).catch(() => null);
  if (!info) return [];
  if (info.isFile()) return sourceExtensions.has(path.extname(directory)) ? [directory] : [];
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => filesBelow(path.join(directory, entry.name))));
  return nested.flat();
}

async function occurrences(token) {
  const matches = [];
  for (const file of await filesBelow(sourceRoot)) {
    const content = await readFile(file, "utf8");
    if (!content.includes(token)) continue;
    matches.push({
      file: path.relative(root, file).split(path.sep).join("/"),
      lines: content
        .split(/\r?\n/)
        .map((line, index) => ({ line: index + 1, text: line.trim() }))
        .filter((item) => item.text.includes(token))
    });
  }
  return matches;
}

test("A5.4.2 inventories every Next session-report snapshot writer/caller", async () => {
  const matches = await occurrences("saveMcpSessionReportSnapshot");
  console.log(JSON.stringify({ event: "a5_4_2_session_report_callers", matches }, null, 2));

  const files = matches.map((item) => item.file).sort();
  assert.deepEqual(files, [
    "src/lib/mcp/session-report-snapshot.ts",
    "src/lib/mcp/session-report.ts"
  ]);

  for (const match of matches) {
    assert.ok(
      match.lines.every((item) => item.text.startsWith("export async function saveMcpSessionReportSnapshot")),
      `unexpected caller remains in ${match.file}`
    );
  }
});

test("public session-report POST already proxies to the backend owner", async () => {
  const route = await readFile(path.join(root, "src/app/api/mcp-session-report/route.ts"), "utf8");
  assert.match(route, /proxyBackendRequest\(request, "\/api\/mcp-session-report", "POST"\)/);
  assert.doesNotMatch(route, /saveMcpSessionReportSnapshot/);
});
