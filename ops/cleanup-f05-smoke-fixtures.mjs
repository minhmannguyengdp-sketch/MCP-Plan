#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const SMOKE_PREFIX = "__NPP_F05_RUNTIME_SMOKE__";

function parseEnv(source) {
  const values = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.replace(/^export\s+/, "").match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[match[1]] = value;
  }
  return values;
}

function required(env, name) {
  const value = String(env[name] || "").trim();
  if (!value) throw new Error(`missing_${name.toLowerCase()}`);
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function supabaseRows(url, serviceRole, path) {
  const response = await fetch(`${url.replace(/\/+$/, "")}/rest/v1/${path}`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`
    }
  });
  if (!response.ok) throw new Error(`supabase_read_${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload)) throw new Error("supabase_response_invalid");
  return payload;
}

async function routeStillExists(env, routeId) {
  const rows = await supabaseRows(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    `mcp_routes?select=id&id=eq.${encodeURIComponent(routeId)}&limit=1`
  );
  return rows.length > 0;
}

async function archiveRoute(env, routeId, attempt) {
  const base = env.MCP_API_BASE_URL.replace(/\/+$/, "");
  const requestId = `f05-stale-cleanup-${routeId}-${attempt}`;
  const response = await fetch(`${base}/api/routes/${encodeURIComponent(routeId)}/archive`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Backend-Token": env.BACKEND_API_TOKEN,
      "X-Request-Id": requestId,
      "X-Actor-Id": env.NPP_F05_EXPECTED_ACTOR_ID || "service:mcp-plan:f05-fixture-cleanup",
      "X-Actor-Type": "service",
      "X-Actor-Authentication": env.NPP_F05_EXPECTED_ACTOR_AUTHENTICATION || "backend-token",
      "Idempotency-Key": `f05-fixture-cleanup.${routeId}.${attempt}`
    },
    body: "{}"
  });
  if (!response.ok && response.status !== 404) throw new Error(`archive_route_${routeId}_${response.status}`);
}

async function waitUntilAbsent(env, routeId) {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    if (!(await routeStillExists(env, routeId))) return true;
    if (attempt % 6 === 0) await archiveRoute(env, routeId, attempt);
    await sleep(500);
  }
  return false;
}

async function main() {
  const envPath = process.argv[2] || "/var/www/mcp-plan-backend/.env";
  const env = { ...parseEnv(await readFile(envPath, "utf8")), ...process.env };
  env.SUPABASE_URL = required(env, "SUPABASE_URL");
  env.SUPABASE_SERVICE_ROLE_KEY = required(env, "SUPABASE_SERVICE_ROLE_KEY");
  env.MCP_API_BASE_URL = required(env, "MCP_API_BASE_URL");
  env.BACKEND_API_TOKEN = required(env, "BACKEND_API_TOKEN");

  const rows = await supabaseRows(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    "mcp_routes?select=id,route_name,note&limit=5000"
  );
  const fixtures = rows.filter((row) => (
    String(row.route_name || "").trim().startsWith(SMOKE_PREFIX) ||
    String(row.note || "").trim().startsWith(SMOKE_PREFIX)
  ));

  for (const fixture of fixtures) {
    const routeId = String(fixture.id || "").trim();
    if (!routeId) continue;
    await archiveRoute(env, routeId, 1);
    if (!(await waitUntilAbsent(env, routeId))) throw new Error(`fixture_route_remains_${routeId}`);
    console.log(`fixture_route_removed:${routeId}`);
  }

  console.log(`F05_SMOKE_FIXTURE_CLEANUP=PASS routes=${fixtures.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "f05_smoke_fixture_cleanup_failed");
  process.exitCode = 1;
});
