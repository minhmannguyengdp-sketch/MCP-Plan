import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appShell = await readFile("src/ui/shell/AppShell.tsx", "utf8");
const appMenu = await readFile("src/ui/shell/MobileAppMenu.tsx", "utf8");
const appMenuStyles = await readFile("src/ui/shell/MobileAppMenu.module.css", "utf8");
const owner = await readFile("src/features/mcp/VisitsSessionReportPanel.tsx", "utf8");
const wrapper = await readFile("src/features/mcp/McpSessionCompactView.tsx", "utf8");

assert.match(appShell, /MobileAppMenuProvider/, "AppShell must own one shared mobile menu provider");
assert.doesNotMatch(appShell, /SettingsQuickButton/, "standalone settings trigger must not return");
assert.match(appMenu, /aria-label="Mở menu ứng dụng"/, "mobile app must expose exactly one menu trigger");
assert.equal((appMenu.match(/aria-label="Mở menu ứng dụng"/g) || []).length, 1, "there must be one mobile menu trigger");
assert.match(appMenu, /Cài đặt ứng dụng/, "settings must live inside the shared menu");
assert.match(appMenu, /MobileAppMenuContext/, "screen actions must register into the shared menu instead of adding buttons");

assert.match(owner, /useRegisterMobileAppMenu/, "session screen must register contextual actions");
assert.match(owner, /Xem báo cáo phiên/, "report action must live in the shared menu");
assert.match(owner, /Xuất dữ liệu/, "export action must live in the shared menu");
assert.match(owner, /Chốt phiên/, "close action must live in the shared menu");
assert.match(owner, /tone:\s*"danger"/, "close session must remain destructive");
assert.doesNotMatch(owner, /PageHeaderActionsPortal/, "session screen must not add a second header menu button");
assert.doesNotMatch(owner, /Mở menu tác vụ phiên/, "legacy session menu trigger must be removed");
assert.doesNotMatch(wrapper, /VisitsExportMenu/, "legacy inline export trigger must remain removed");

assert.match(appMenuStyles, /position:\s*fixed/, "one shared mobile trigger must own the top-right surface");
assert.match(appMenuStyles, /grid-template-columns:\s*42px minmax\(0, 1fr\) auto/, "menu items must keep a scalable icon-copy-chevron layout");

console.log("UNIFIED_MOBILE_APP_MENU_CONTRACT=PASS");
