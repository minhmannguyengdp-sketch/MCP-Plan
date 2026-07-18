import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const appBase = process.env.MCP_ACTION_UI_APP_BASE || "http://127.0.0.1:3011";
const mockBase = process.env.MCP_ACTION_UI_MOCK_BASE || "http://127.0.0.1:3110";
const resultsDir = process.env.MCP_ACTION_UI_RESULTS_DIR || "test-results/mcp-session-actions";
await mkdir(resultsDir, { recursive: true });

async function waitForHttp(url, timeoutMs = 120000) { const start = Date.now(); let error; while (Date.now() - start < timeoutMs) { try { const response = await fetch(url, { cache: "no-store" }); if (response.ok) return; error = new Error(`${url}:${response.status}`); } catch (next) { error = next; } await new Promise((resolve) => setTimeout(resolve, 500)); } throw error || new Error(`timeout:${url}`); }
async function reset() { const response = await fetch(`${mockBase}/__reset`, { method: "POST" }); assert.equal(response.status, 200); }
async function state() { const response = await fetch(`${mockBase}/__state`, { cache: "no-store" }); assert.equal(response.status, 200); return response.json(); }
function card(page) { return page.locator("article").filter({ hasText: "UI Existing Customer" }).first(); }
async function saveAndWait(page, dialogName, saveName) { const dialog = page.getByRole("dialog", { name: dialogName, exact: true }); await dialog.getByRole("button", { name: saveName, exact: true }).click(); await dialog.waitFor({ state: "hidden" }); }
async function shot(page, name) { await page.screenshot({ path: `${resultsDir}/${name}.png`, fullPage: true }); }

await waitForHttp(`${mockBase}/health`);
await waitForHttp(`${appBase}/visits?routeId=route-active&date=2099-12-30`);
await reset();

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const result = { MCP_SESSION_ACTION_UI_SMOKE: "FAIL" };

try {
  await page.goto(`${appBase}/visits?routeId=route-active&date=2099-12-30`, { waitUntil: "networkidle" });
  const tokens = await page.evaluate(() => { const style = getComputedStyle(document.documentElement); return { canvas: style.getPropertyValue("--npp-color-canvas").trim(), surface: style.getPropertyValue("--npp-color-surface").trim(), header: style.getPropertyValue("--npp-color-header").trim(), primary: style.getPropertyValue("--npp-color-primary").trim(), accent: style.getPropertyValue("--npp-color-accent").trim() }; });
  assert.deepEqual(tokens, { canvas: "#f7f3ed", surface: "#ffffff", header: "#5a3a24", primary: "#4f7a3a", accent: "#c89b5b" });
  await shot(page, "01-warm-theme-session");

  await card(page).getByRole("button", { name: "Đơn", exact: true }).click();
  const order = page.getByRole("dialog", { name: "Tạo đơn hàng", exact: true });
  await order.getByRole("button", { name: "+ Chọn sản phẩm", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Chọn sản phẩm", exact: true });
  await picker.getByRole("button", { name: /Trà UI Smoke/ }).first().click();
  await picker.getByRole("button", { name: "Thêm 1 mã vào đơn", exact: true }).click();
  await saveAndWait(page, "Tạo đơn hàng", "Lưu đơn hàng");

  await card(page).getByRole("button", { name: "Test", exact: true }).click();
  const testDialog = page.getByRole("dialog", { name: "Ghi kết quả thử sản phẩm", exact: true });
  await testDialog.getByPlaceholder("Nhập tên sản phẩm").fill("Trà UI Smoke");
  await testDialog.getByRole("button", { name: "Đạt", exact: true }).click();
  await saveAndWait(page, "Ghi kết quả thử sản phẩm", "Lưu kết quả thử");

  await card(page).getByRole("button", { name: "Quan sát", exact: true }).click();
  const reportDialog = page.getByRole("dialog", { name: "Ghi quan sát thị trường", exact: true });
  await reportDialog.getByRole("button", { name: "Cần báo giá", exact: true }).click();
  await saveAndWait(page, "Ghi quan sát thị trường", "Lưu quan sát");

  await card(page).getByRole("button", { name: "Theo dõi", exact: true }).click();
  const followupDialog = page.getByRole("dialog", { name: "Tạo việc cần theo dõi", exact: true });
  await followupDialog.getByRole("button", { name: "Gửi báo giá", exact: true }).click();
  await followupDialog.getByRole("button", { name: "Mai", exact: true }).click();
  await saveAndWait(page, "Tạo việc cần theo dõi", "Lưu việc theo dõi");
  await shot(page, "02-four-actions-pass");

  const mock = await state();
  const expected = ["order", "test", "report", "followup"];
  for (const route of expected) {
    const request = mock.requests.find((item) => item.path === `/api/mcp-day/session-customer/${route}`);
    assert.ok(request, `missing ${route} request`);
    assert.ok(request.idempotencyKey, `${route} request must carry Idempotency-Key`);
    assert.equal(request.payload.sessionCustomerId, "sc-existing");
  }
  assert.equal(mock.aggregates.orders.length, 1);
  assert.equal(mock.aggregates.tests.length, 1);
  assert.equal(mock.aggregates.reports.length, 1);
  assert.equal(mock.aggregates.followups.length, 1);
  result.MCP_SESSION_ACTION_UI_SMOKE = "PASS";
  result.actions = expected;
  result.idempotencyKeys = "PASS";
  result.themeTokens = tokens;
} catch (error) {
  result.error = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack || ""}` : String(error);
  await shot(page, "failure").catch(() => {});
  await writeFile(`${resultsDir}/failure.html`, await page.content()).catch(() => {});
  throw error;
} finally {
  await writeFile(`${resultsDir}/result.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  await context.close();
  await browser.close();
}
