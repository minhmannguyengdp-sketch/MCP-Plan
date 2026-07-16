import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const path = new URL("../apps/backend/server.js", import.meta.url);
const source = await readFile(path, "utf8");

const functionPattern = /async function persistMcpSessionAiResultV1\(body\) \{[\s\S]*?\n\}\n\nfunction mcpSettingSlugV1/;
const routeLine = '  if (url.pathname === "/api/mcp-session-report/ai-result") return wrap(await persistMcpSessionAiResultV1(await readJsonBody(req)));\n';

const functionMatches = source.match(new RegExp(functionPattern.source, "g")) || [];
const routeMatches = source.split(routeLine).length - 1;

assert.equal(functionMatches.length, 1, "expected exactly one legacy AI result function");
assert.equal(routeMatches, 1, "expected exactly one legacy AI result route");

const next = source
  .replace(functionPattern, "function mcpSettingSlugV1")
  .replace(routeLine, "");

assert.doesNotMatch(next, /persistMcpSessionAiResultV1/);
assert.doesNotMatch(next, /supabasePatch\(\s*["']mcp_session_reports["']/);
assert.notEqual(next, source);

await writeFile(path, next, "utf8");
