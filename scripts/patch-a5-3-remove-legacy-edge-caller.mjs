import { readFile, writeFile } from "node:fs/promises";

const serverPath = "apps/backend/server.js";
let source = await readFile(serverPath, "utf8");

const helperStart = source.indexOf("async function proxySupabaseFunction(functionName, body, extraBody = {}) {");
const helperEndMarker = "\n\nasync function supabaseRpc(functionName, args = {}) {";
const helperEnd = source.indexOf(helperEndMarker, helperStart);

if (helperStart < 0 || helperEnd < 0) {
  throw new Error("legacy_edge_proxy_helper_boundary_not_found");
}

source = `${source.slice(0, helperStart)}async function supabaseRpc(functionName, args = {}) {${source.slice(helperEnd + helperEndMarker.length)}`;

const legacyRoutes = [
  '  if (url.pathname === "/api/mcp-day/session-customer/result") return wrap(await proxySupabaseFunction("mcp-day-8b3", await readJsonBody(req)));\n',
  '  if (url.pathname === "/api/mcp-day/session-customer/add") return wrap(await proxySupabaseFunction("mcp-day-8b3", await readJsonBody(req), { action: "add" }));\n'
];

for (const route of legacyRoutes) {
  const occurrences = source.split(route).length - 1;
  if (occurrences !== 1) {
    throw new Error(`legacy_edge_route_occurrences:${occurrences}`);
  }
  source = source.replace(route, "");
}

if (/proxySupabaseFunction\s*\(|["'`]mcp-day-8b3["'`]|["'`]mcp-day-followup["'`]/.test(source)) {
  throw new Error("legacy_edge_caller_still_present");
}

await writeFile(serverPath, source, "utf8");
