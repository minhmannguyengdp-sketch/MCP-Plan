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

function hexToRgb(value) {
  let hex = value.trim().replace(/^#/, "");
  if (hex.length === 3) hex = hex.split("").map((part) => `${part}${part}`).join("");
  assert.match(hex, /^[0-9a-f]{6}$/i, `unsupported color ${value}`);
  return [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
}

function luminance(value) {
  const [red, green, blue] = hexToRgb(value).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground, background) {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

async function shellMetrics(page) {
  return page.evaluate(() => {
    const top = document.querySelector("[data-app-top-bar]")?.getBoundingClientRect();
    const main = document.querySelector("[data-app-scroll-region]")?.getBoundingClientRect();
    const bottom = document.querySelector('[data-bottom-navigation="true"]')?.getBoundingClientRect();
    const sidebar = document.querySelector(".sidebar")?.getBoundingClientRect();
    const content = document.querySelector("[data-app-content-shell]")?.getBoundingClientRect();
    const mainNode = document.querySelector("[data-app-scroll-region]");
    const mainStyle = mainNode ? getComputedStyle(mainNode) : null;
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      top: top ? { top: top.top, right: top.right, bottom: top.bottom, left: top.left, width: top.width, height: top.height } : null,
      main: main ? { top: main.top, right: main.right, bottom: main.bottom, left: main.left, width: main.width, height: main.height } : null,
      bottom: bottom ? { top: bottom.top, right: bottom.right, bottom: bottom.bottom, left: bottom.left, width: bottom.width, height: bottom.height } : null,
      sidebar: sidebar ? { top: sidebar.top, right: sidebar.right, bottom: sidebar.bottom, left: sidebar.left, width: sidebar.width, height: sidebar.height } : null,
      content: content ? { top: content.top, right: content.right, bottom: content.bottom, left: content.left, width: content.width, height: content.height } : null,
      mainPaddingBottom: mainStyle ? Number.parseFloat(mainStyle.paddingBottom) : 0
    };
  });
}

async function verifySingleTrigger(page) {
  const triggers = page.getByRole("button", { name: "Mở menu ứng dụng", exact: true });
  assert.equal(await triggers.count(), 1, "AppShell must render exactly one menu trigger");
  return triggers.first();
}

async function verifyContrast(page) {
  const tokens = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const read = (name) => style.getPropertyValue(name).trim();
    return {
      canvas: read("--npp-color-canvas"),
      surface: read("--npp-color-surface"),
      header: read("--npp-color-header"),
      primary: read("--npp-color-primary"),
      text: read("--npp-color-text"),
      muted: read("--npp-color-text-muted"),
      onHeader: read("--npp-color-on-header")
    };
  });
  const ratios = {
    header: contrastRatio(tokens.onHeader, tokens.header),
    primary: contrastRatio(tokens.onHeader, tokens.primary),
    body: contrastRatio(tokens.text, tokens.surface),
    muted: contrastRatio(tokens.muted, tokens.canvas)
  };
  for (const [name, ratio] of Object.entries(ratios)) assert.ok(ratio >= 4.5, `${name} contrast ${ratio.toFixed(2)} must be >= 4.5`);
  return ratios;
}

async function verifyMobile(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${appBase}/routes`, { waitUntil: "networkidle" });

  const trigger = await verifySingleTrigger(page);
  const bottomNav = page.locator('[data-bottom-navigation="true"]');
  await bottomNav.waitFor({ state: "visible" });
  const bottomItems = bottomNav.locator("a");
  const bottomItemCount = await bottomItems.count();
  assert.ok(bottomItemCount <= 5, "bottom navigation must contain at most five items");
  assert.equal(Number(await bottomNav.getAttribute("data-navigation-item-count")), bottomItemCount);

  const before = await shellMetrics(page);
  assert.ok(before.top && before.main && before.bottom, "mobile shell regions must exist");
  assert.ok(before.top.bottom <= before.main.top + 1, "top bar must not overlap the scroll region");
  assert.ok(before.bottom.left >= 0 && before.bottom.right <= before.viewport.width, "bottom nav must stay inside viewport width");
  assert.ok(before.bottom.bottom <= before.viewport.height + 1, "bottom nav must stay inside viewport height");
  assert.ok(before.mainPaddingBottom >= before.bottom.height + 12, "scroll region must reserve clearance for bottom navigation");

  await page.evaluate(() => {
    const main = document.querySelector("[data-app-scroll-region]");
    const spacer = document.createElement("div");
    spacer.dataset.acceptanceSpacer = "true";
    spacer.style.height = "1800px";
    main?.append(spacer);
    if (main instanceof HTMLElement) main.scrollTop = main.scrollHeight;
  });
  await page.waitForTimeout(80);
  const after = await shellMetrics(page);
  assert.equal(Math.round(after.top.top), Math.round(before.top.top), "top bar must remain fixed while main scrolls");
  assert.equal(Math.round(after.bottom.top), Math.round(before.bottom.top), "bottom nav must remain fixed while main scrolls");
  await trigger.waitFor({ state: "visible" });

  const triggerBox = await trigger.boundingBox();
  assert.ok(triggerBox, "menu trigger must have a box");
  await page.mouse.move(triggerBox.x + triggerBox.width / 2, triggerBox.y + triggerBox.height / 2);
  await page.mouse.down();
  const pressedTransform = await trigger.evaluate((node) => getComputedStyle(node).transform);
  assert.notEqual(pressedTransform, "none", "pressed state must provide visible transform feedback");
  await page.mouse.up();

  await trigger.click();
  const menu = page.getByRole("dialog").last();
  await menu.waitFor({ state: "visible" });
  const menuBox = await menu.boundingBox();
  assert.ok(menuBox && menuBox.y >= 0 && menuBox.y + menuBox.height <= 845, "expanded menu must fit the mobile viewport");

  const contrast = await verifyContrast(page);
  await page.screenshot({ path: `${resultsDir}/16-app-shell-mobile-acceptance.png`, fullPage: true });
  await context.close();
  return { bottomItems: bottomItemCount, contrast };
}

async function verifyDesktop(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${appBase}/routes`, { waitUntil: "networkidle" });

  await verifySingleTrigger(page);
  assert.equal(await page.locator('[data-bottom-navigation="true"]').isVisible(), false, "bottom navigation must be hidden on desktop");
  assert.equal(await page.locator(".sidebar").isVisible(), true, "sidebar must be visible on desktop");

  const before = await shellMetrics(page);
  assert.ok(before.sidebar && before.content && before.top && before.main, "desktop shell regions must exist");
  assert.ok(before.sidebar.right <= before.content.left + 1, "desktop sidebar must not overlap app content");
  assert.ok(before.top.left >= before.sidebar.right - 1, "desktop top bar must remain inside app content");
  assert.ok(before.top.bottom <= before.main.top + 1, "desktop top bar must not overlap main content");

  await page.evaluate(() => {
    const main = document.querySelector("[data-app-scroll-region]");
    const spacer = document.createElement("div");
    spacer.dataset.acceptanceSpacer = "desktop";
    spacer.style.height = "1800px";
    main?.append(spacer);
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await page.waitForTimeout(80);
  const after = await shellMetrics(page);
  assert.equal(Math.round(after.top.top), 0, "desktop top bar must remain sticky at viewport top");

  const contrast = await verifyContrast(page);
  await page.screenshot({ path: `${resultsDir}/17-app-shell-desktop-acceptance.png`, fullPage: false });
  await context.close();
  return { contrast };
}

await waitForHttp(`${appBase}/routes`);
const browser = await chromium.launch({ headless: true });
const result = { APP_SHELL_BROWSER_ACCEPTANCE: "FAIL" };

try {
  result.mobile = await verifyMobile(browser);
  result.desktop = await verifyDesktop(browser);
  result.singleMenuTrigger = "PASS";
  result.bottomNavigationLimit = "PASS";
  result.noOverlap = "PASS";
  result.fixedTopBar = "PASS";
  result.contrast = "PASS";
  result.pressedState = "PASS";
  result.APP_SHELL_BROWSER_ACCEPTANCE = "PASS";
} catch (error) {
  result.error = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack || ""}` : String(error);
  throw error;
} finally {
  await writeFile(`${resultsDir}/app-shell-browser-acceptance-result.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}
