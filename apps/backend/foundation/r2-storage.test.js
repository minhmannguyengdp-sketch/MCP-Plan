import test from "node:test";
import assert from "node:assert/strict";
import { presignR2Put, signedR2HeadRequest } from "./r2-storage.js";

const config = {
  endpoint: "https://account.r2.cloudflarestorage.com",
  bucket: "hung-phat",
  region: "auto",
  accessKeyId: "access-key",
  secretAccessKey: "secret-key"
};
const now = new Date("2026-07-19T08:00:00.000Z");

test("presigned PUT is short-lived and binds content type", () => {
  const result = presignR2Put(config, "mcp-plan/outlets/npp/customer/photo 1.jpg", "image/jpeg", { now, expiresSeconds: 300 });
  const url = new URL(result.putUrl);
  assert.equal(url.pathname, "/hung-phat/mcp-plan/outlets/npp/customer/photo%201.jpg");
  assert.equal(url.searchParams.get("X-Amz-Expires"), "300");
  assert.equal(url.searchParams.get("X-Amz-SignedHeaders"), "content-type;host");
  assert.match(url.searchParams.get("X-Amz-Signature") || "", /^[0-9a-f]{64}$/);
  assert.deepEqual(result.requiredHeaders, { "Content-Type": "image/jpeg" });
  assert.equal(result.expiresAt, "2026-07-19T08:05:00.000Z");
});

test("HEAD verification uses signed R2 request without exposing secret", () => {
  const request = signedR2HeadRequest(config, "mcp-plan/outlets/npp/customer/photo.jpg", { now });
  assert.equal(request.init.method, "HEAD");
  assert.match(request.init.headers.Authorization, /^AWS4-HMAC-SHA256 Credential=access-key\//);
  assert.doesNotMatch(request.init.headers.Authorization, /secret-key/);
  assert.equal(request.init.headers["x-amz-content-sha256"], "UNSIGNED-PAYLOAD");
});
