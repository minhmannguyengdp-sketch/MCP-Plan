import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { handleOrderApi } from "./order-api.js";

const config = {
  supabaseUrl: "https://example.supabase.co",
  supabaseServiceRoleKey: "server-only-key"
};

const context = {
  requestId: "request-order-api-12345678",
  idempotencyKey: "order.create:api-12345678",
  receivedAt: "2026-07-19T12:00:00.000Z",
  installation: { id: "installation-a", nppCode: "NPP-A" },
  actor: { id: "service:npp-a:orders", type: "service", authentication: "backend-token" }
};

function request(body, method = "POST") {
  const stream = Readable.from([JSON.stringify(body)]);
  stream.method = method;
  return stream;
}

test("order API owns POST /api/orders and preserves idempotency metadata", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({
      data: { orderId: "order-1", orderCode: "ORD-1" },
      meta: { idempotency: { replayed: false, originalRequestId: context.requestId } }
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const result = await handleOrderApi(
    request({ customerMode: "manual", customer: { name: "Khách A" }, items: [{ productName: "Trà", quantity: 1, unitPrice: 10000 }] }),
    new URL("http://local/api/orders"),
    context,
    config,
    { fetchImpl }
  );

  assert.equal(result.statusCode, 201);
  assert.equal(result.payload.data.orderId, "order-1");
  assert.equal(result.payload.meta.idempotency.replayed, false);
  assert.equal(calls.length, 1);
});

test("order API ignores unrelated methods and paths", async () => {
  assert.equal(await handleOrderApi(request({}, "GET"), new URL("http://local/api/orders"), context, config), null);
  assert.equal(await handleOrderApi(request({}, "POST"), new URL("http://local/api/actions"), context, config), null);
});
