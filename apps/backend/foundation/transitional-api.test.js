import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { handleTransitionalApi } from "./transitional-api.js";

const config = {
  supabaseUrl: "https://project.example.com",
  supabaseServiceRoleKey: "server-only-key"
};

const context = {
  requestId: "request_12345678",
  installation: { id: "installation-a", nppCode: "NPP-A" },
  actor: { id: "service:npp-a:mcp-v1", type: "service" }
};

function request(method, body) {
  const stream = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  stream.method = method;
  stream.headers = {};
  return stream;
}

test("field check writes use VPS service role and persist foundation context", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify([{ id: "result-1", product_name: "Sản phẩm A" }]), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  const result = await handleTransitionalApi(
    request("POST", {
      fileId: "file-1",
      customerId: "customer-1",
      productName: "Sản phẩm A",
      status: "opportunity"
    }),
    new URL("http://local/api/field-checks/result"),
    context,
    config,
    { fetchImpl }
  );

  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.data.id, "result-1");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.headers.apikey, "server-only-key");
  assert.equal(calls[0].init.headers.Authorization, "Bearer server-only-key");
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.raw_payload.foundation_context.requestId, "request_12345678");
  assert.equal(body.raw_payload.foundation_context.installationId, "installation-a");
  assert.equal(body.raw_payload.foundation_context.actorId, "service:npp-a:mcp-v1");
});

test("product search runs the canonical RPC behind the boundary", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify([{ id: "product-1" }]), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  const result = await handleTransitionalApi(
    request("GET"),
    new URL("http://local/api/products/search?q=gao&limit=500"),
    context,
    config,
    { fetchImpl }
  );

  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.payload.data, [{ id: "product-1" }]);
  assert.match(calls[0].url, /\/rest\/v1\/rpc\/mcp_search_products$/);
  const args = JSON.parse(calls[0].init.body);
  assert.equal(args.p_q, "gao");
  assert.equal(args.p_limit, 100);
});

test("unknown route is delegated to legacy runtime", async () => {
  const result = await handleTransitionalApi(
    request("GET"),
    new URL("http://local/api/routes"),
    context,
    config,
    { fetchImpl: async () => { throw new Error("must_not_call_provider"); } }
  );
  assert.equal(result, null);
});
