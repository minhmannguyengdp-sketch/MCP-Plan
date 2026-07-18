import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appShell = await readFile("src/ui/shell/AppShell.tsx", "utf8");
const shellCss = await readFile("src/app/app-shell-contract.css", "utf8");
const layout = await readFile("src/app/layout.tsx", "utf8");
const sessionView = await readFile("src/features/mcp/McpSessionCompactViewFinal2.tsx", "utf8");
const browserSmoke = await readFile("test/ui/app-shell-browser-acceptance-smoke.mjs", "utf8");
const actionSmoke = await readFile("test/ui/mcp-session-actions-browser-smoke.mjs", "utf8");
const actionMock = await readFile("test/ui/mcp-session-actions-mock-backend.mjs", "utf8");
const workflow = await readFile(".github/workflows/f05-ui-browser-smoke.yml", "utf8");

test("AppShell owns one menu trigger, one scroll region and at most five bottom shortcuts", () => {
  assert.match(appShell, /const BOTTOM_NAV_LIMIT = 5/);
  assert.match(appShell, /PRIMARY_NAV_ITEMS\.slice\(0, BOTTOM_NAV_LIMIT\)/);
  assert.match(appShell, /data-bottom-navigation/);
  assert.match(appShell, /data-navigation-item-count/);
  assert.match(appShell, /data-app-scroll-region/);
  assert.match(appShell, /<AppTopBar activeHref=\{activeHref\} \/>/);
});

test("AppShell layout fixes the top bar outside the only mobile scroll region", () => {
  assert.match(layout, /import "\.\/app-shell-contract\.css"/);
  assert.match(shellCss, /\.app-content-shell \{[\s\S]*?grid-template-rows: auto minmax\(0, 1fr\)/);
  assert.match(shellCss, /\[data-app-scroll-region\] \{[\s\S]*?overflow-y: auto/);
  assert.match(shellCss, /\[data-app-top-bar\] \{[\s\S]*?position: sticky/);
  assert.match(shellCss, /--app-bottom-nav-clearance: 84px/);
  assert.match(shellCss, /padding-bottom: calc\(var\(--app-bottom-nav-clearance\) \+ env\(safe-area-inset-bottom\)\)/);
});

test("browser gate locks mobile and desktop layout, contrast, pressed, loading and error states", () => {
  for (const phrase of [
    "exactly one menu trigger",
    "bottom navigation must contain at most five items",
    "top bar must remain fixed while main scrolls",
    "desktop top bar must remain sticky at viewport top",
    "must not overlap",
    "contrast",
    "pressed state must provide visible transform feedback"
  ]) assert.match(browserSmoke, new RegExp(phrase));

  assert.match(actionMock, /productDelayMs/);
  assert.match(actionMock, /productError/);
  assert.match(actionSmoke, /loading control must be disabled while request is pending/);
  assert.match(actionSmoke, /error state must not use muted text styling/);
  assert.match(workflow, /app-shell-browser-acceptance-smoke\.mjs/);
});

test("canonical API errors render their message instead of object coercion", () => {
  assert.match(sessionView, /function apiErrorMessage\(payload: unknown, fallback: string\)/);
  assert.match(sessionView, /typeof value\.error === "object" && value\.error\.message\?\.trim\(\)/);
  assert.match(sessionView, /apiErrorMessage\(payload, "Không tìm được sản phẩm"\)/);
  assert.match(sessionView, /apiErrorMessage\(payload, "Không tải được quy cách sản phẩm"\)/);
  assert.doesNotMatch(sessionView, /new Error\(err\.error \|\| err\.detail/);
});
