import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../src/features/orders/OrdersClientPage.tsx", import.meta.url), "utf8");
const sheet = await readFile(new URL("../src/features/orders/OrderCreateSheet.tsx", import.meta.url), "utf8");
const sheetStyles = await readFile(new URL("../src/features/orders/OrderCreateSheet.module.css", import.meta.url), "utf8");
const workspaceStyles = await readFile(new URL("../src/app/order-create-workspace.css", import.meta.url), "utf8");
const bottomSheet = await readFile(new URL("../src/ui/overlay/BottomSheet.tsx", import.meta.url), "utf8");
const proxy = await readFile(new URL("../src/app/api/backend/orders/route.ts", import.meta.url), "utf8");
const serverPage = await readFile(new URL("../src/features/orders/OrdersPage.tsx", import.meta.url), "utf8");
const gateway = await readFile(new URL("../apps/backend/foundation/gateway.js", import.meta.url), "utf8");

test("orders tab exposes the real create-order entry point with proxied sessions", () => {
  assert.match(page, /createLoading \? "Đang tải phiên\.\.\." : "\+ Tạo đơn"/);
  assert.match(page, /<OrderCreateSheet/);
  assert.match(page, /sessions=\{sessions\}/);
  assert.match(page, /async function loadOrderSessions\(customers: RouteCustomerItem\[\]\)/);
  assert.match(page, /new URLSearchParams\(\{ routeId \}\)/);
  assert.match(page, /`\/api\/backend\/mcp-settings\/session-status\?\$\{query\.toString\(\)\}`/);
  assert.match(page, /Form chưa được mở để tránh hiển thị sai khách hoặc trộn khách giữa các tuyến/);
  assert.match(serverPage, /api\.getRouteCustomersData\(\)/);
  assert.doesNotMatch(serverPage, /session-status|loadMcpSessions|supabase/i);
});

test("customer step is session-first, single-select and keeps manual customer entry", () => {
  assert.match(sheet, /type CustomerMode = "existing" \| "manual"/);
  assert.match(sheet, /sessions: OrderSessionOption\[\]/);
  assert.match(sheet, /selectedSessionId/);
  assert.match(sheet, /activeCustomers\.filter\(\(customer\) => customer\.routeId === selectedSession\.routeId\)/);
  assert.match(sheet, />Khách trong phiên</);
  assert.match(sheet, /Chọn phiên → chọn khách/);
  assert.match(sheet, /role="radiogroup"/);
  assert.match(sheet, /role="radio"/);
  assert.match(sheet, /aria-checked=\{routeCustomerId === customer\.id\}/);
  assert.match(sheet, />Khách nhập tay</);
  assert.match(sheet, /Khách nhập tay được lưu trong đơn như một snapshot độc lập/);
  assert.match(sheet, /routeCustomerId: customerMode === "existing"/);
  assert.match(sheet, /customer: customerMode === "manual"/);
  assert.doesNotMatch(sheet, /activeCustomers\.slice\(0, 50\)/);
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
  assert.match(workspaceStyles, /\.bottom-sheet-workspace\s*\{[\s\S]*height: 100% !important/);
  assert.match(workspaceStyles, /\.bottom-sheet-workspace \.sheet-body\s*\{[\s\S]*overflow: hidden !important/);
});

test("mobile order flow exposes customer, catalog and cart as explicit guarded panels", () => {
  assert.match(sheet, /type MobilePanel = "customer" \| "catalog" \| "cart"/);
  assert.match(sheet, /data-mobile-panel=\{mobilePanel\}/);
  assert.match(sheet, />1\. Khách</);
  assert.match(sheet, />2\. Sản phẩm</);
  assert.match(sheet, />3\. Đơn</);
  assert.match(sheet, /disabled=\{!customerReady \|\| saving\}/);
  assert.match(sheet, /disabled=\{!customerReady \|\| items\.length === 0 \|\| saving\}/);
  assert.match(sheetStyles, /grid-template-rows: auto minmax\(0, 1fr\)/);
  assert.match(sheetStyles, /workspace\[data-mobile-panel="customer"\] \.catalogSection/);
  assert.match(sheetStyles, /workspace:not\(\[data-mobile-panel="cart"\]\) \.rightPane/);
  assert.doesNotMatch(sheetStyles, /\.workspace \{[\s\S]{0,260}overflow-y: auto/);
});

test("catalog groups variants inside one product card", () => {
  assert.match(sheet, /function groupCatalog\(products: ProductCatalogItem\[\]\)/);
  assert.match(sheet, /const groups = new Map<string, ProductGroup>\(\)/);
  assert.match(sheet, /productGroups\.map\(\(group\)/);
  assert.match(sheet, /group\.variants\.map\(\(product\)/);
  assert.match(sheet, /styles\.variantGrid/);
  assert.match(sheet, /variantPrimaryLabel\(product\)/);
  assert.match(sheet, /variantSecondaryLabel\(product\)/);
  assert.match(sheet, /aria-label=\{`Thêm \$\{product\.name\}, \$\{variantPrimaryLabel\(product\)\} vào đơn`\}/);
  assert.match(sheet, /\$\{productGroups\.length\} sản phẩm · \$\{products\.length\} vị/);
  assert.match(sheetStyles, /\.variantGrid \{[\s\S]*grid-template-columns: repeat\(auto-fit, minmax\(150px, 1fr\)\)/);
  assert.match(sheetStyles, /\.variantSelected \{/);
  assert.doesNotMatch(sheet, /products\.map\(\(product\)/);
});

test("variant selection is add-only and visibly confirmed", () => {
  assert.match(sheet, /onClick=\{\(\) => addProduct\(product\)\}/);
  assert.match(sheet, /setAddedNotice\(`/);
  assert.match(sheet, /aria-live="assertive"/);
  assert.match(sheet, /selectedQuantity \? `\$\{selectedQuantity\} trong đơn` : "\+ Thêm"/);
  assert.match(sheetStyles, /\.variantButton \{[\s\S]*min-height: 64px/);
  assert.match(sheetStyles, /touch-action: manipulation/);
});

test("primary create action requires a separate cart review gesture", () => {
  assert.match(sheet, /function runPrimaryAction\(\)/);
  assert.match(sheet, /setMobilePanel\("customer"\)/);
  assert.match(sheet, /setMobilePanel\("catalog"\)/);
  assert.match(sheet, /if \(mobilePanel !== "cart"\) \{[\s\S]*setMobilePanel\("cart"\);[\s\S]*return;/);
  assert.doesNotMatch(sheet, /setMobilePanel\("cart"\);\s*void submit\(\);/);
  assert.match(sheet, /mobilePanel === "cart"[\s\S]*\? "Tạo đơn"[\s\S]*: "Xem lại đơn"/);
  assert.match(sheet, /submitInFlightRef\.current/);
  assert.match(sheet, /Đơn \(\{totalQuantity\}\)/);
});

test("cart controls are compact but keep quantity, price and subtotal ownership", () => {
  assert.match(sheet, /styles\.cartItem/);
  assert.match(sheet, /styles\.variantBadge/);
  assert.match(sheet, /decreaseProduct\(item\.variantId\)/);
  assert.match(sheet, /updateItem\(item\.variantId, "unitPrice"/);
  assert.match(sheet, /styles\.lineTotal/);
  assert.match(sheetStyles, /\.itemControls \{[\s\S]*grid-template-columns: minmax\(122px, 0\.9fr\) minmax\(108px, 0\.9fr\) auto/);
  assert.match(sheetStyles, /\.removeItem \{[\s\S]*width: 30px/);
});

test("unfinished drafts are protected and the mobile footer stays visible", () => {
  assert.match(sheet, /function requestClose\(\)/);
  assert.match(sheet, /window\.confirm\("Đơn đang nhập chưa lưu\. Đóng và bỏ nội dung này\?"\)/);
  assert.match(sheet, /onClose=\{requestClose\}/);
  assert.match(sheetStyles, /\.cartButton \{[\s\S]*display: none !important/);
  assert.match(sheetStyles, /\.primaryAction \{[\s\S]*grid-column: 2/);
});

test("product selection is realtime, filterable and keeps a visible cart", () => {
  assert.match(sheet, /setTimeout\(\(\) => \{[\s\S]*loadProducts\(productSearch, productCategory, productBrand\)/);
  assert.match(sheet, /params\.set\("category", category\)/);
  assert.match(sheet, /params\.set\("brand", brand\)/);
  assert.match(sheet, />Nhóm hàng</);
  assert.match(sheet, />Nhãn hàng</);
  assert.match(sheet, /selectedQuantityByVariant/);
  assert.match(sheet, />Đơn đang lên</);
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
