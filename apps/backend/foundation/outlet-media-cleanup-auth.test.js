import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { handleTransitionalApi } from "./transitional-api.js";

function request(body = {}) {
  const stream = Readable.from([JSON.stringify(body)]);
  stream.method = "POST";
  stream.headers = {};
  return stream;
}

const config = {
  supabaseUrl: "https://project.example.com",
  supabaseServiceRoleKey: "server-only-key"
};

const baseContext = {
  requestId: "cleanup-auth-test",
  installation: { id: "installation-a", nppCode: "NPP-A" }
};

test("normal application service actor cannot invoke internal media cleanup", async () => {
  let providerCalled = false;
  await assert.rejects(
    handleTransitionalApi(
      request(),
      new URL("http://local/api/internal/outlet-media/cleanup"),
      {
        ...baseContext,
        actor: { id: "service:npp-a:mcp-v1", type: "service", authentication: "backend-token" }
      },
      config,
      { fetchImpl: async () => { providerCalled = true; } }
    ),
    (error) => error.code === "outlet_media_cleanup_forbidden" && error.statusCode === 403
  );
  assert.equal(providerCalled, false);
});

test("cleanup system actor reaches the cleanup owner", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    if (calls.length === 1) return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
    if (calls.length === 2) return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
    throw new Error("unexpected_provider_call");
  };

  const result = await handleTransitionalApi(
    request({ pendingAgeHours: 24, retryAgeMinutes: 15, limit: 10 }),
    new URL("http://local/api/internal/outlet-media/cleanup"),
    {
      ...baseContext,
      actor: {
        id: "service:mcp-plan:outlet-media-cleanup",
        type: "service",
        authentication: "backend-token"
      }
    },
    config,
    { fetchImpl }
  );

  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.data.claimedCount, 0);
  assert.equal(result.payload.data.claimedDeleteJobCount, 0);
  assert.equal(calls.length, 2);
});
