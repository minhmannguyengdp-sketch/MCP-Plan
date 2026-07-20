import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const appBase = process.env.ORDER_CREATE_APP_BASE || "http://127.0.0.1:3001";
const mockBase = process.env.ORDER_CREATE_MOCK_BASE || "http://127.0.0.1:3110";
const resultsDir = process.env.ORDER_CREATE_RESULTS_DIR || "test-results/order-create-smoke";

await mkdir(resultsDir, { recursive: true });

async function waitForHttp(url, timeoutMs = 120_000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) return;
      lastError = new Error(`${url} -> ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw lastError || new Error(`timeout_waiting_for_${url}`);
}

async function resetMock() {
  const response = await fetch(`${mockBase}/__reset`, { method: "POST" });
  assert.equal(response.status, 200, "mock reset must succeed");
}

async function mockState() {
  const response = await fetch(`${mockBase}/__state`, { cache: "no-store" });
  assert.equal(response.status, 200, "mock state must be readable");
  return response.json();
}

function orderRequests(state) {
  return state.requests.filter((request) => request.method === "POST" && request.path === "/api/orders");
}

async function openOrderSheet(page) {
  await page.goto(`${appBase}/orders`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "+ Tạo đơn", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Tạo đơn hàng", exact: true });
  await dialog.waitFor({ state: "visible" });
  return dialog;
}

async function existingSessionCustomerFlow(browser) {
  await resetMock();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const dialog = await openOrderSheet(page);

  const sessionSelect = dialog.getByLabel("Phiên / tuyến *", { exact: true });
  await sessionSelect.waitFor({ state: "visible" });
  assert.equal(await sessionSelect.inputValue(), "session-active", "active session must be selected first");
  await dialog.getByText("Tuyến phiên đang chạy", { exact: true }).first().waitFor({ state: "visible" });

  const firstCustomer = dialog.getByRole("radio", { name: /UI Existing Customer/ });
  const secondCustomer = dialog.getByRole("radio", { name: /UI Second Customer/ });
  await firstCustomer.waitFor({ state: "visible" });
  await secondCustomer.waitFor({ state: "visible" });
  assert.equal(await dialog.getByText("UI Other Route Customer", { exact: true }).count(), 0, "customers from another session route must be excluded");

  await firstCustomer.click();
  assert.equal(await firstCustomer.getAttribute("aria-checked"), "true", "selected customer must own the single radio state");
  assert.equal(await secondCustomer.getAttribute("aria-checked"), "false", "second customer must remain unselected");
  await dialog.getByRole("button", { name: "Tiếp tục với UI Existing Customer", exact: true }).click();

  await dialog.getByText("Siro Hưng Phát", { exact: true }).waitFor({ state: "visible" });
  const syrupCard = dialog.locator("article").filter({ hasText: "Siro Hưng Phát" });
  assert.equal(await syrupCard.count(), 1, "one product must render as one card even with multiple variants");
  const strawberry = syrupCard.getByRole("button", { name: /Thêm Siro Hưng Phát, Dâu/ });
  const peach = syrupCard.getByRole("button", { name: /Thêm Siro Hưng Phát, Đào/ });
  await strawberry.waitFor({ state: "visible" });
  await peach.waitFor({ state: "visible" });
  assert.equal(await strawberry.count(), 1, "strawberry variant must live inside the product card");
  assert.equal(await peach.count(), 1, "peach variant must live inside the same product card");

  await strawberry.click();
  await syrupCard.getByText("1 trong đơn", { exact: true }).waitFor({ state: "visible" });
  assert.equal(orderRequests(await mockState()).length, 0, "variant selection must not submit an order");

  await dialog.getByRole("button", { name: "Xem lại đơn", exact: true }).click();
  await dialog.getByText("Đơn đang lên", { exact: true }).waitFor({ state: "visible" });
  assert.equal(orderRequests(await mockState()).length, 0, "first primary action must only open cart review");

  const orderResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === "POST" && url.pathname === "/api/backend/orders";
  });
  await dialog.getByRole("button", { name: "Tạo đơn", exact: true }).click();
  const orderResponse = await orderResponsePromise;
  assert.equal(orderResponse.status(), 201, "existing-customer order must be created");
  await dialog.waitFor({ state: "hidden" });
  await page.getByText("Đã tạo DH-UI-0001.", { exact: true }).waitFor({ state: "visible" });

  const state = await mockState();
  const requests = orderRequests(state);
  assert.equal(requests.length, 1, "one click must create exactly one order request");
  assert.ok(requests[0].idempotencyKey, "order request must carry Idempotency-Key");
  assert.equal(requests[0].payload.customerMode, "existing");
  assert.equal(requests[0].payload.routeCustomerId, "rc-existing");
  assert.equal(requests[0].payload.items.length, 1);
  assert.equal(requests[0].payload.items[0].variantId, "variant-strawberry");

  await page.screenshot({ path: `${resultsDir}/01-existing-session-customer-order.png`, fullPage: true });
  await context.close();
  return "PASS";
}

async function manualCustomerFlow(browser) {
  await resetMock();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const dialog = await openOrderSheet(page);

  await dialog.getByRole("button", { name: /Khách nhập tay/ }).click();
  await dialog.getByLabel("Tên khách *", { exact: true }).fill("UI Manual Customer");
  await dialog.getByLabel("Số điện thoại", { exact: true }).fill("0911222333");
  await dialog.getByLabel("Khu vực", { exact: true }).fill("Mỹ Tho");
  await dialog.getByLabel("Địa chỉ giao hàng", { exact: true }).fill("123 Đường Browser Smoke");
  await dialog.getByText("Khách nhập tay được lưu trong đơn như một snapshot độc lập, không tự thêm vào tuyến.", { exact: true }).waitFor({ state: "visible" });
  await dialog.getByRole("button", { name: "Tiếp tục chọn sản phẩm", exact: true }).click();

  const teaVariant = dialog.getByRole("button", { name: /Thêm Trà Lài Hưng Phát, Lài/ });
  await teaVariant.waitFor({ state: "visible" });
  await teaVariant.click();
  await dialog.getByRole("button", { name: "Xem lại đơn", exact: true }).click();

  const responsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === "POST" && url.pathname === "/api/backend/orders";
  });
  await dialog.getByRole("button", { name: "Tạo đơn", exact: true }).click();
  const response = await responsePromise;
  assert.equal(response.status(), 201, "manual-customer order must be created");
  await dialog.waitFor({ state: "hidden" });

  const state = await mockState();
  const requests = orderRequests(state);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].payload.customerMode, "manual");
  assert.equal(Object.hasOwn(requests[0].payload, "routeCustomerId"), false);
  assert.equal(requests[0].payload.customer.name, "UI Manual Customer");
  assert.equal(requests[0].payload.customer.phone, "0911222333");
  assert.equal(requests[0].payload.items[0].variantId, "variant-tea-jasmine");

  await page.screenshot({ path: `${resultsDir}/02-manual-customer-order.png`, fullPage: true });
  await context.close();
  return "PASS";
}

await waitForHttp(`${mockBase}/health`);
await waitForHttp(`${appBase}/orders`);

const browser = await chromium.launch({ headless: true });
const evidence = {};
try {
  evidence.existingSessionCustomerFlow = await existingSessionCustomerFlow(browser);
  evidence.manualCustomerFlow = await manualCustomerFlow(browser);
  evidence.result = "PASS";
  console.log("ORDER_CREATE_NORMALIZED_BROWSER_SMOKE=PASS");
} catch (error) {
  evidence.result = "FAIL";
  evidence.error = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack || ""}` : String(error);
  throw error;
} finally {
  await writeFile(`${resultsDir}/browser-smoke-result.json`, JSON.stringify(evidence, null, 2));
  await browser.close();
}
