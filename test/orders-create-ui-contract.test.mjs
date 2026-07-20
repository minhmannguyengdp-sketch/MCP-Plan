import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../src/features/orders/OrdersClientPage.tsx", import.meta.url), "utf8");
const sheet = await readFile(new URL("../src/features/orders/OrderCreateSheet.tsx", import.meta.url), "utf8");
const sheetStyles = await readFile(new URL("../src/features/orders/OrderCreateSheet.module.css", import.meta.url), "utf8");
const bottomSheet = await readFile(new URL("../src/ui/overlay/BottomSheet.tsx", import.meta.url), "utf8");
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

test("create-order workspace is true fullscreen without the legacy drag handle", () => {
  assert.match(sheet, /variant="workspace"/);
  assert.match(bottomSheet, /variant\?: "default" \| "compact" \| "workspace"/);
  assert.match(bottomSheet, /width: "100vw"/);
  assert.match(bottomSheet, /height: "100dvh"/);
  assert.match(bottomSheet, /maxHeight: "100dvh"/);
  assert.match(bottomSheet, /gap: 0/);
  assert.match(bottomSheet, /padding: 0/);
  assert.match(bottomSheet, /variant === "workspace" \? null : <div className="sheet-handle"/);
  assert.match(bottomSheet, /data-fullscreen=/);
});

test("mobile order flow exposes customer, catalog and cart as explicit panels", () => {
  assert.match(sheet, /type MobilePanel = "customer" \| "catalog" \| "cart"/);
  assert.match(sheet, /data-mobile-panel=\{mobilePanel\}/);
  assert.match(sheet, /className=\{styles\.mobileTabs\}/);
  assert.match(sheet, />1\. Khách</);
  assert.match(sheet, />2\. Sản phẩm</);
  assert.match(sheet, />3\. Đơn</);
  assert.match(sheetStyles, /grid-template-rows: auto minmax\(0, 1fr\)/);
  assert.match(sheetStyles, /workspace\[data-mobile-panel="customer"\] \.catalogSection/);
  assert.match(sheetStyles, /workspace:not\(\[data-mobile-panel="cart"\]\) \.rightPane/);
  assert.doesNotMatch(sheetStyles, /\.workspace \{[\s\S]{0,220}overflow-y: auto/);
});

test("product selection uses a full-row touch target and immediate visible feedback", () => {
  assert.match(sheet, /className=\{styles\.productRow\}/);
  assert.match(sheet, /onClick=\{\(\) => addProduct\(product\)\}/);
  assert.match(sheet, /aria-label=\{`Thêm \$\{product\.name\} vào đơn`\}/);
  assert.match(sheet, /setAddedNotice\(`/);
  assert.match(sheet, /aria-live="assertive"/);
  assert.match(sheet, /Trong đơn: \{selectedQuantity\}/);
  assert.match(sheetStyles, /\.productRow \{[\s\S]*min-height: 54px/);
  assert.match(sheetStyles, /touch-action: manipulation/);
});

test("primary create action routes users to missing business prerequisites", () => {
  assert.match(sheet, /function runPrimaryAction\(\)/);
  assert.match(sheet, /setMobilePanel\("customer"\)/);
  assert.match(sheet, /setMobilePanel\("catalog"\)/);
  assert.match(sheet, /const primaryLabel = !customerReady \? "Chọn khách" : items\.length === 0 \? "Thêm sản phẩm" : "Tạo đơn"/);
  assert.match(sheet, /Xem đơn \(\{totalQuantity\}\)/);
});

test("product selection is realtime, filterable and keeps a visible cart", () => {
  assert.match(sheet, /setTimeout\(\(\) => \{[\s\S]*loadProducts\(productSearch, productCategory, productBrand\)/);
  assert.match(sheet, /params\.set\("category", category\)/);
  assert.match(sheet, /params\.set\("brand", brand\)/);
  assert.match(sheet, />Nhóm hàng</);
  assert.match(sheet, />Nhãn hàng</);
  assert.match(sheet, /selectedQuantityByVariant/);
  assert.match(sheet, />Đơn đang lên</);
  assert.match(sheet, /decreaseProduct\(item\.variantId\)/);
  assert.doesNotMatch(sheet, /products\.slice\(0, 30\)/);
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
