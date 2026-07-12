const base = String(
  process.env.MCP_API_BASE_URL || "http://127.0.0.1:3001"
).replace(/\/+$/, "");

const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const routeName = `__MCP_V1_API_SMOKE__${stamp}`;
const customerName = `__MCP_V1_API_CUSTOMER__${stamp}`;
const sessionDate = "2099-12-31";

let routeId = "";
let sessionId = "";
let cleaned = false;

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

async function call(path, init = {}) {
  const response = await fetch(`${base}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {})
    }
  });
  const payload = object(await response.json().catch(() => ({})));
  return { response, payload };
}

async function must(path, init = {}) {
  const result = await call(path, init);
  if (!result.response.ok) {
    throw new Error(
      `${init.method || "GET"} ${path} -> ${result.response.status}: ${result.payload.error || result.payload.message || "request_failed"}`
    );
  }
  return object(result.payload.data);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function cleanupRoute() {
  if (!routeId || cleaned) return;
  const result = await call(`/api/routes/${encodeURIComponent(routeId)}/archive`, {
    method: "POST",
    body: "{}"
  });
  if (!result.response.ok && result.response.status !== 404) {
    throw new Error(
      `cleanup route failed: ${result.response.status} ${result.payload.error || "unknown"}`
    );
  }
  cleaned = true;
}

try {
  const health = await must("/api/health");
  assert(health.ok === true, "health_not_ok");

  const route = await must("/api/routes", {
    method: "POST",
    body: JSON.stringify({
      routeName,
      area: "API Smoke",
      weekday: 5,
      note: "temporary MCP v1 API smoke"
    })
  });
  routeId = String(route.routeId || route.id || "");
  assert(routeId, "route_id_missing");

  const customer = await must("/api/route-customers", {
    method: "POST",
    body: JSON.stringify({
      routeId,
      customerName,
      area: "API Smoke",
      sortOrder: 1,
      note: "temporary MCP v1 API smoke"
    })
  });
  assert(customer.routeCustomerId || customer.id, "route_customer_id_missing");

  const firstOpen = await must("/api/mcp-day/open-session", {
    method: "POST",
    body: JSON.stringify({ routeId, sessionDate, owner: "API Smoke" })
  });
  const secondOpen = await must("/api/mcp-day/open-session", {
    method: "POST",
    body: JSON.stringify({ routeId, sessionDate, owner: "API Smoke" })
  });

  sessionId = String(object(firstOpen.session).id || "");
  assert(sessionId, "session_id_missing");
  assert(firstOpen.created === true, "first_open_not_created");
  assert(secondOpen.created === false, "second_open_created_duplicate");
  assert(String(object(secondOpen.session).id || "") === sessionId, "open_not_idempotent");

  const day = await must(
    `/api/mcp-day/data?routeId=${encodeURIComponent(routeId)}&date=${sessionDate}`
  );
  assert(object(day.run).id === sessionId, "day_session_mismatch");
  assert(Array.isArray(day.lines) && day.lines.length === 1, "snapshot_count_mismatch");

  const deleted = await must(`/api/mcp-sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE"
  });
  assert(deleted.deleted === true, "empty_session_not_deleted");

  await cleanupRoute();

  console.log(
    JSON.stringify(
      {
        ok: true,
        base,
        routeId,
        sessionId,
        openCreatedFirst: firstOpen.created,
        openCreatedSecond: secondOpen.created,
        snapshotCount: day.lines.length,
        emptySessionDeleted: deleted.deleted,
        cleanup: true
      },
      null,
      2
    )
  );
} catch (error) {
  try {
    await cleanupRoute();
  } catch (cleanupError) {
    console.error(
      cleanupError instanceof Error ? cleanupError.message : cleanupError
    );
  }
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
}
