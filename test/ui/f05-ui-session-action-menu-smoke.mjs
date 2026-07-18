import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const appBase = process.env.F05_UI_APP_BASE || "http://127.0.0.1:3000";
const resultsDir = process.env.F05_UI_RESULTS_DIR || "test-results/f05-ui-smoke";

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

function overlaps(first, second) {
  return !(
    first.x + first.width <= second.x ||
    second.x + second.width <= first.x ||
    first.y + first.height <= second.y ||
    second.y + second.height <= first.y
  );
}

await waitForHttp(`${appBase}/visits?routeId=route-active&date=2099-12-30`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

try {
  await page.goto(`${appBase}/visits?routeId=route-active&date=2099-12-30`, { waitUntil: "networkidle" });

  const settingsButton = page.getByRole("button", { name: "Cài đặt", exact: true });
  const actionButton = page.getByRole("button", { name: "Mở menu tác vụ phiên", exact: true });
  await settingsButton.waitFor({ state: "visible" });
  await actionButton.waitFor({ state: "visible" });

  const [settingsBox, actionBox] = await Promise.all([settingsButton.boundingBox(), actionButton.boundingBox()]);
  assert.ok(settingsBox, "settings button must have a mobile bounding box");
  assert.ok(actionBox, "session action button must have a mobile bounding box");
  assert.equal(overlaps(settingsBox, actionBox), false, `session action and settings controls overlap: ${JSON.stringify({ settingsBox, actionBox })}`);

  await actionButton.click();
  const menu = page.getByRole("dialog", { name: "Tác vụ phiên", exact: true });
  await menu.waitFor({ state: "visible" });
  await menu.getByRole("button", { name: /Xem báo cáo phiên/ }).waitFor({ state: "visible" });
  const exportButton = menu.getByRole("button", { name: /Xuất dữ liệu/ });
  await exportButton.waitFor({ state: "visible" });
  const closeSessionButton = menu.getByRole("button", { name: /Chốt phiên/ });
  await closeSessionButton.waitFor({ state: "visible" });
  assert.match(String(await closeSessionButton.getAttribute("class")), /danger/, "close session must remain a destructive menu item");

  await page.screenshot({ path: `${resultsDir}/09-session-action-menu-mobile.png`, fullPage: true });
  await exportButton.click();

  const exportSheet = page.getByRole("dialog", { name: "Xuất dữ liệu phiên", exact: true });
  await exportSheet.waitFor({ state: "visible" });
  const pdfLink = exportSheet.getByRole("link", { name: /Báo cáo phiên PDF/ });
  const excelLink = exportSheet.getByRole("link", { name: /Checklist khách Excel/ });
  assert.match(String(await pdfLink.getAttribute("href")), /^\/api\/pdf\/session-day\?/);
  assert.match(String(await excelLink.getAttribute("href")), /^\/api\/backend\/exports\/mcp-sessions\.csv\?/);
  await page.screenshot({ path: `${resultsDir}/10-session-export-menu-mobile.png`, fullPage: true });

  console.log(JSON.stringify({
    F05_SESSION_ACTION_MENU_SMOKE: "PASS",
    viewport: "390x844",
    headerCollision: false,
    actions: ["report", "export", "close"],
    exportLinks: "PASS"
  }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
