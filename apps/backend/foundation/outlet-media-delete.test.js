import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanupOutletMedia,
  deleteRouteCustomerAndMedia
} from "./outlet-media.js";

const config = {
  supabaseUrl: "https://project.example.com",
  supabaseServiceRoleKey: "service-role",
  r2: {
    configured: true,
    endpoint: "https://account.r2.cloudflarestorage.com",
    bucket: "hung-phat",
    region: "auto",
    accessKeyId: "access-key",
    secretAccessKey: "secret-key"
  }
};

const context = {
  requestId: "req-delete-media",
  receivedAt: "2026-07-19T08:00:00.000Z",
  installation: { id: "npp-demo", nppCode: "NPP-DEMO" },
  actor: { id: "sales-1", type: "service", authentication: "backend-token" }
};

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function requestInfo(input, init = {}) {
  const url = new URL(typeof input === "string" ? input : input.url || String(input));
  return { url, method: String(init.method || "GET").toUpperCase(), body: init.body ? JSON.parse(init.body) : null };
}

test("route customer hard delete waits until every R2 object is deleted", async () => {
  const calls = [];
  const fetchImpl = async (input, init = {}) => {
    const request = requestInfo(input, init);
    calls.push(request);
    if (request.url.pathname === "/rest/v1/rpc/mcp_claim_route_customer_media_delete") {
      return json({
        routeCustomer: { id: "rc-1", active: false },
        media: [
          { id: "media-1", object_key: "mcp-plan/outlets/npp/rc-1/one.jpg", status: "deleting" },
          { id: "media-2", object_key: "mcp-plan/outlets/npp/rc-1/two.jpg", status: "deleting" }
        ]
      });
    }
    if (request.url.hostname === "account.r2.cloudflarestorage.com" && request.method === "DELETE") {
      return new Response(null, { status: 204 });
    }
    if (request.url.pathname === "/rest/v1/rpc/mcp_finish_outlet_media_delete") {
      assert.equal(request.body.p_succeeded, true);
      return json({ id: request.body.p_media_id, status: "deleted" });
    }
    if (request.url.pathname === "/rest/v1/rpc/mcp_delete_route_customer_hard") {
      return json({ deleted: true, routeCustomerId: request.body.p_route_customer_id });
    }
    throw new Error(`unexpected_request:${request.method}:${request.url}`);
  };

  const result = await deleteRouteCustomerAndMedia("rc-1", context, config, { fetchImpl });
  assert.equal(result.deleted, true);
  assert.equal(result.deletedMediaCount, 2);
  const hardDeleteIndex = calls.findIndex((call) => call.url.pathname.endsWith("mcp_delete_route_customer_hard"));
  const finishIndexes = calls
    .map((call, index) => call.url.pathname.endsWith("mcp_finish_outlet_media_delete") ? index : -1)
    .filter((index) => index >= 0);
  assert.ok(finishIndexes.length === 2);
  assert.ok(finishIndexes.every((index) => index < hardDeleteIndex), "database customer delete must happen after all R2 delete finishes");
});

test("one R2 failure keeps customer data and records a retryable delete failure", async () => {
  let hardDeleteCalled = false;
  let finishSucceeded = null;
  const fetchImpl = async (input, init = {}) => {
    const request = requestInfo(input, init);
    if (request.url.pathname === "/rest/v1/rpc/mcp_claim_route_customer_media_delete") {
      return json({
        routeCustomer: { id: "rc-2", active: false },
        media: [{ id: "media-fail", object_key: "mcp-plan/outlets/npp/rc-2/fail.jpg", status: "deleting" }]
      });
    }
    if (request.url.hostname === "account.r2.cloudflarestorage.com" && request.method === "DELETE") {
      return new Response(null, { status: 503 });
    }
    if (request.url.pathname === "/rest/v1/rpc/mcp_finish_outlet_media_delete") {
      finishSucceeded = request.body.p_succeeded;
      return json({ id: request.body.p_media_id, status: "delete_failed" });
    }
    if (request.url.pathname === "/rest/v1/rpc/mcp_delete_route_customer_hard") {
      hardDeleteCalled = true;
      return json({ deleted: true });
    }
    throw new Error(`unexpected_request:${request.method}:${request.url}`);
  };

  await assert.rejects(
    deleteRouteCustomerAndMedia("rc-2", context, config, { fetchImpl }),
    (error) => error.code === "route_customer_media_delete_incomplete" && error.statusCode === 502
  );
  assert.equal(finishSucceeded, false);
  assert.equal(hardDeleteCalled, false);
});

test("cleanup treats an already absent R2 object as successfully deleted", async () => {
  const fetchImpl = async (input, init = {}) => {
    const request = requestInfo(input, init);
    if (request.url.pathname === "/rest/v1/rpc/mcp_claim_stale_outlet_media_delete") {
      return json([{ id: "media-stale", object_key: "mcp-plan/outlets/npp/rc/stale.jpg", status: "deleting" }]);
    }
    if (request.url.hostname === "account.r2.cloudflarestorage.com" && request.method === "DELETE") {
      return new Response(null, { status: 404 });
    }
    if (request.url.pathname === "/rest/v1/rpc/mcp_finish_outlet_media_delete") {
      assert.equal(request.body.p_succeeded, true);
      return json({ id: "media-stale", status: "deleted" });
    }
    throw new Error(`unexpected_request:${request.method}:${request.url}`);
  };

  const result = await cleanupOutletMedia({}, context, config, {
    fetchImpl,
    now: new Date("2026-07-19T08:00:00.000Z")
  });
  assert.equal(result.claimedCount, 1);
  assert.equal(result.deletedCount, 1);
  assert.equal(result.failedCount, 0);
  assert.equal(result.pendingBefore, "2026-07-18T08:00:00.000Z");
  assert.equal(result.retryBefore, "2026-07-19T07:45:00.000Z");
});
