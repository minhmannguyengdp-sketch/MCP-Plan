import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { handleRouteApi } from "./route-api.js";

const config = {
  supabaseUrl: "https://project.example.com",
  supabaseServiceRoleKey: "server-only-key"
};

const context = {
  requestId: "request-route-master-12345678",
  idempotencyKey: "route.master.write:abcdefgh",
  receivedAt: "2026-07-19T12:00:00.000Z",
  installation: { id: "installation-a", nppCode: "NPP-A" },
  actor: { id: "service:npp-a:mcp-v1", type: "service", authentication: "backend-token" }
};

function request(method, body) {
  const stream = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  stream.method = method;
  stream.headers = {};
  return stream;
}

test("route API intercepts route and route-customer writes before legacy fallback", async () => {
  const cases = [
    {
      method: "POST",
      route: "/api/routes",
      rpc: "mcp_idempotent_create_route",
      body: { routeName: "Tuyến A", weekday: 1 }
    },
    {
      method: "PATCH",
      route: "/api/routes/route-1",
      rpc: "mcp_idempotent_update_route",
      body: { routeName: "Tuyến A mới", active: false }
    },
    {
      method: "PATCH",
      route: "/api/route-customers/route-customer-1",
      rpc: "mcp_idempotent_update_route_customer",
      body: { customerName: "Điểm bán A", geoLat: 10.75, geoLng: 106.66 }
    }
  ];

  for (const item of cases) {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({
        data: { id: "result-1", routeId: "route-1" },
        meta: { idempotency: { replayed: false } }
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    };

    const result = await handleRouteApi(
      request(item.method, item.body),
      new URL(`http://local${item.route}`),
      context,
      config,
      { fetchImpl }
    );

    assert.equal(result.statusCode, 200, item.route);
    assert.equal(result.payload.meta.idempotency.replayed, false, item.route);
    assert.equal(calls.length, 1, item.route);
    assert.equal(new URL(calls[0].url).pathname.split("/").at(-1), item.rpc, item.route);
  }
});

test("archive routes are claimed by the cross-system archive intent owner", async () => {
  for (const item of [
    { path: "/api/routes/route-1/archive", targetId: "route-1" },
    { path: "/api/route-customers/route-customer-1/archive", targetId: "route-customer-1" }
  ]) {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({
        mode: "replay",
        intent: {
          id: "mai-replay",
          status: "completed",
          response_payload: {
            targetId: item.targetId,
            deleteJobId: "msdj-replay",
            deleted: true,
            deletedMediaCount: 1
          }
        }
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    };

    const result = await handleRouteApi(
      request("POST"),
      new URL(`http://local${item.path}`),
      context,
      config,
      { fetchImpl }
    );

    assert.equal(result.statusCode, 200, item.path);
    assert.equal(result.payload.data.targetId, item.targetId, item.path);
    assert.equal(result.payload.meta.idempotency.replayed, true, item.path);
    assert.equal(calls.length, 1, item.path);
    assert.equal(new URL(calls[0].url).pathname.split("/").at(-1), "mcp_claim_archive_intent", item.path);
  }
});

test("dynamic route and route-customer ids are decoded once", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({
      data: { id: "result id" },
      meta: { idempotency: { replayed: false } }
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  await handleRouteApi(
    request("PATCH", { active: true }),
    new URL("http://local/api/routes/route%20id"),
    context,
    config,
    { fetchImpl }
  );

  await handleRouteApi(
    request("PATCH", { active: true }),
    new URL("http://local/api/route-customers/route-customer%20id"),
    context,
    config,
    { fetchImpl }
  );

  const routeArgs = JSON.parse(calls[0].init.body);
  const customerArgs = JSON.parse(calls[1].init.body);
  assert.equal(routeArgs.p_route_id, "route id");
  assert.equal(customerArgs.p_route_customer_id, "route-customer id");
});
