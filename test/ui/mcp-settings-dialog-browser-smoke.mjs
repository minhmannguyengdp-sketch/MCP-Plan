import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const appBase = process.env.F05_UI_APP_BASE || "http://127.0.0.1:3000";
const resultsDir = process.env.F05_UI_RESULTS_DIR || "test-results/f05-ui-smoke";
await mkdir(resultsDir, { recursive: true });

async function waitForHttp(url, timeoutMs = 120000) {
  const started = Date.now();
  let lastError;
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

await waitForHttp(`${appBase}/mcp-setting`);

let item = {
  id: "setting-item-1",
  key: "old-competitor",
  label: "Đối thủ cũ",
  value: "Giá thấp",
  category: "Đối thủ",
  brandName: "Nguồn A",
  status: "active",
  sortOrder: 1
};
const mutations = [];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

await page.route("**/api/mcp-report-settings**", async (route) => {
  const request = route.request();
  const method = request.method();
  if (method === "GET") {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          groups: [{
            id: "setting-group-1",
            key: "competitor",
            title: "Đối thủ cạnh tranh",
            description: "Nhóm dùng cho browser regression",
            status: "active",
            sortOrder: 1,
            items: [item]
          }]
        }
      })
    });
  }

  if (method === "PATCH") {
    const payload = request.postDataJSON();
    const idempotencyKey = request.headers()["idempotency-key"] || "";
    mutations.push({ method, payload, idempotencyKey });
    item = {
      ...item,
      label: payload.label ?? item.label,
      value: payload.value ?? item.value,
      category: payload.category ?? item.category,
      brandName: payload.brandName ?? item.brandName,
      sortOrder: payload.sortOrder ?? item.sortOrder,
      status: payload.status ?? item.status
    };
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { id: item.id }, meta: { idempotency: { replayed: false } } })
    });
  }

  return route.fulfill({ status: 405, contentType: "application/json", body: JSON.stringify({ error: { message: "method_not_allowed" } }) });
});

try {
  await page.goto(`${appBase}/mcp-setting`, { waitUntil: "networkidle" });
  await page.getByText("Đối thủ cũ", { exact: true }).waitFor({ state: "visible" });

  const main = page.locator("[data-app-scroll-region]");
  const editButton = page.getByRole("button", { name: "Sửa", exact: true });
  await page.evaluate(() => {
    const scrollRegion = document.querySelector("[data-app-scroll-region]");
    const spacer = document.createElement("div");
    spacer.dataset.settingsDialogSpacer = "true";
    spacer.style.height = "700px";
    scrollRegion?.append(spacer);
  });
  await editButton.evaluate((node) => node.scrollIntoView({ block: "center" }));
  const scrollBefore = await main.evaluate((node) => node.scrollTop);

  await editButton.click();
  const dialog = page.getByRole("dialog", { name: "Sửa lựa chọn" });
  await dialog.waitFor({ state: "visible" });
  const scrollWhileOpen = await main.evaluate((node) => node.scrollTop);
  assert.ok(Math.abs(scrollWhileOpen - scrollBefore) <= 1, "opening edit dialog must preserve the current MCP settings scroll position");

  const dialogBox = await dialog.boundingBox();
  assert.ok(dialogBox, "edit dialog must have a visible box");
  assert.ok(dialogBox.width <= 460, "edit dialog must stay compact");
  assert.ok(dialogBox.y > 20, "edit dialog must be centered instead of becoming a bottom sheet");
  assert.ok(dialogBox.y + dialogBox.height < 824, "edit dialog must stay inside the mobile viewport");
  assert.ok(Math.abs(dialogBox.x + dialogBox.width / 2 - 195) <= 2, "edit dialog must be horizontally centered");

  const nameInput = dialog.getByLabel("Tên mẫu");
  await nameInput.waitFor({ state: "visible" });
  assert.equal(await nameInput.evaluate((node) => document.activeElement === node), true, "edit dialog must focus the first field");
  await nameInput.fill("Đối thủ đã sửa");
  await dialog.getByRole("button", { name: "Cập nhật", exact: true }).click();

  await dialog.waitFor({ state: "hidden" });
  await page.getByText("Đối thủ đã sửa", { exact: true }).waitFor({ state: "visible" });
  const scrollAfter = await main.evaluate((node) => node.scrollTop);
  assert.ok(Math.abs(scrollAfter - scrollBefore) <= 1, "editing must not jump the MCP settings page to the create form");

  assert.equal(mutations.length, 1, "edit dialog must issue exactly one PATCH mutation");
  assert.equal(mutations[0].payload.itemId, "setting-item-1");
  assert.equal(mutations[0].payload.label, "Đối thủ đã sửa");
  assert.ok(mutations[0].idempotencyKey.length >= 16, "PATCH mutation must include a stable idempotency key");

  await page.screenshot({ path: `${resultsDir}/18-mcp-settings-edit-dialog.png`, fullPage: false });
  await writeFile(`${resultsDir}/mcp-settings-edit-dialog.json`, JSON.stringify({ scrollBefore, scrollWhileOpen, scrollAfter, dialogBox, mutations }, null, 2));
  console.log(JSON.stringify({ status: "PASS", scrollBefore, scrollWhileOpen, scrollAfter, dialogBox, mutations: mutations.length }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
