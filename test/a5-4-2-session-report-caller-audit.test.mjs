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

test("A5.4.2 leaves no Next session-report snapshot writer or caller", async () => {
  const matches = await occurrences("saveMcpSessionReportSnapshot");
  console.log(JSON.stringify({ event: "a5_4_2_session_report_callers", matches }, null, 2));
  assert.deepEqual(matches, []);
});

test("session report read model contains no direct service-role mutation", async () => {
  const source = await readFile(path.join(root, "src/lib/mcp/session-report.ts"), "utf8");
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(source, /\/rest\/v1\/mcp_session_reports/);
  assert.doesNotMatch(source, /method:\s*"POST"/);
});

test("public session-report POST proxies to the backend owner", async () => {
  const route = await readFile(path.join(root, "src/app/api/mcp-session-report/route.ts"), "utf8");
  assert.match(route, /proxyBackendRequest\(request, "\/api\/mcp-session-report", "POST"\)/);
  assert.doesNotMatch(route, /saveMcpSessionReportSnapshot/);
});
