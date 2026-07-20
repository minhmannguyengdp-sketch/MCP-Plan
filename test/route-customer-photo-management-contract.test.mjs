import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [master, manager, client, profile, preview, css, backend] = await Promise.all([
  read("../src/features/mcp/McpMasterView.tsx"),
  read("../src/features/mcp/OutletPhotoManager.tsx"),
  read("../src/features/mcp/outlet-media-client.ts"),
  read("../src/features/mcp/McpCustomerProfileSheet.tsx"),
  read("../src/features/mcp/RouteCustomerMediaPreview.tsx"),
  read("../src/features/mcp/McpCustomerProfileSheet.module.css"),
  read("../apps/backend/foundation/outlet-media.js")
]);

test("edit mode alone mounts the shared manager", () => {
  assert.match(master, /import \{ OutletPhotoManager \}/);
  assert.match(master, /mode === "edit" && customer \? <OutletPhotoManager/);
  assert.match(master, /routeCustomerId=\{customer\.id\}/);
  assert.match(master, /active=\{open && mode === "edit"\}/);
  assert.doesNotMatch(master, /mode === "create"[^\n]{0,300}<OutletPhotoManager/);
  assert.match(manager, /if \(!active \|\| !routeCustomerId\) return null/);
  assert.match(profile, /<OutletPhotoManager/);
});

test("manager owns private read, add, delete, retry and total limit", () => {
  assert.match(manager, /customer-profile\?routeCustomerId=/);
  assert.match(manager, /uploadOutletPhoto\(photo, \{ routeCustomerId, sessionId, location \}\)/);
  assert.match(manager, /outlet-media\/delete/);
  assert.match(manager, /buildOutletPhotoDrafts\(files, remaining\)/);
  assert.match(manager, /limit - media\.length - drafts\.length/);
  assert.match(manager, /"Thử lại"/);
  assert.match(manager, /disabled=\{busy \|\| remaining <= 0\}/);
  assert.match(manager, /await loadProfile\(\)/);
  assert.match(manager, /router\.refresh\(\)/);
});

test("upload order remains init then signed PUT then finalize", () => {
  const init = client.indexOf("outlet-media/upload-init");
  const put = client.indexOf('method: "PUT"');
  const done = client.indexOf("outlet-media/upload-finalize");
  assert.ok(init >= 0 && put > init && done > put);
  assert.match(client, /sessionId\?: string \| null/);
});

test("route preview is a bounded horizontal gallery", () => {
  assert.match(preview, /styles\.previewScroller/);
  assert.match(preview, /styles\.previewCard/);
  assert.doesNotMatch(preview, /styles\.mediaGrid/);
  assert.match(css, /\.previewScroller\s*\{[\s\S]*?overflow-x:\s*auto;/);
  assert.match(css, /scroll-snap-type:\s*x mandatory/);
  assert.match(css, /scroll-snap-align:\s*start/);
  assert.match(css, /flex:\s*0 0 min\(72vw, 280px\)/);
  assert.match(css, /aspect-ratio:\s*4 \/ 3;[\s\S]*?object-fit:\s*cover/);
});

test("browser-facing photo code exposes no bucket or object key", () => {
  for (const source of [master, manager, client, profile, preview]) {
    assert.doesNotMatch(source, /hung-phat|object[_A-Z]?key|r2\.cloudflarestorage\.com/i);
  }
  assert.doesNotMatch(backend, /objectKey:\s*media\.object_key/);
});
