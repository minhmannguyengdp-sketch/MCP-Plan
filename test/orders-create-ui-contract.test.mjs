import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../src/features/orders/OrdersClientPage.tsx", import.meta.url), "utf8");
const sheet = await readFile(new URL("../src/features/orders/OrderCreateSheet.tsx", import.meta.url), "utf8");
const proxy = await readFile(new URL("../src/app/api/backend/orders/route.ts", import.meta.url), "utf8");
const serverPage = await readFile(new URL("../src/features/orders/OrdersPage.tsx", import.meta.url), "utf8");
const gateway = await readFile(new URL("../apps/backend/foundation/gateway.js", import.meta.url), "utf8");

test("orders tab exposes the real create-order entry point", () => {
  assert.match(page, />\+ Tạo đơn</);
  assert.match(page, /<OrderCreateSheet/);
  assert.match(serverPage, /api\.getRouteCustomersData\(\)/);
});

test("create-order sheet supports existing and manual customers", () => {
  assert.match(sheet, /type CustomerMode = "existing" \| "manual"/);
  assert.match(sheet, />Khách đã có</);
  assert.match(sheet, />Nhập khách</);
  assert.match(sheet, /routeCustomerId: customerMode === "existing"/);
  assert.match(sheet, /customer: customerMode === "manual"/);
  assert.match(sheet, /không tự thêm vào tuyến/i);
});

test("create-order caller uses persisted idempotency through the backend proxy", () => {
  assert.match(sheet, /idempotentMutationFetch\(/);
  assert.match(sheet, /"\/api\/backend\/orders"/);
  assert.match(sheet, /operation: "order\.create"/);
  assert.doesNotMatch(sheet, /supabase|service_role/i);
  assert.match(proxy, /proxyBackendRequest\(request, "\/api\/orders", "POST"\)/);
});

test("Foundation Gateway owns standalone order creation before legacy fallback", () => {
  assert.match(gateway, /import \{ handleOrderApi \} from "\.\/order-api\.js"/);
  const ownerIndex = gateway.indexOf("await handleOrderApi(req, url, context, config)");
  const transitionalIndex = gateway.indexOf("await handleTransitionalApi(req, url, context, config)");
  const legacyIndex = gateway.indexOf("await proxyToLegacy(req, res, url, context, origin, config)");
  assert.ok(ownerIndex > 0);
  assert.ok(transitionalIndex > ownerIndex);
  assert.ok(legacyIndex > transitionalIndex);
});
