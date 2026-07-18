import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const header = await readFile("src/ui/layout/PageHeader.tsx", "utf8");
const portal = await readFile("src/ui/layout/PageHeaderActionsPortal.tsx", "utf8");
const owner = await readFile("src/features/mcp/VisitsSessionReportPanel.tsx", "utf8");
const wrapper = await readFile("src/features/mcp/McpSessionCompactView.tsx", "utf8");
const styles = await readFile("src/features/mcp/VisitsSessionActionMenu.module.css", "utf8");

assert.match(header, /data-page-header-actions/, "PageHeader must expose one owned action slot");
assert.match(header, /page-header-copy/, "PageHeader must separate copy from actions");
assert.match(portal, /createPortal/, "session actions must render into the header slot");
assert.match(portal, /\[data-page-header-actions\]/, "portal must target the owned header action slot");

assert.match(owner, /aria-label="Mở menu tác vụ phiên"/, "mobile session action trigger must be accessible");
assert.match(owner, /title="Tác vụ phiên"/, "session actions must open one bottom sheet");
assert.match(owner, /Xem báo cáo phiên/, "report action must live in the session menu");
assert.match(owner, /Xuất dữ liệu/, "export action must live in the session menu");
assert.match(owner, /Chốt phiên/, "close action must live in the session menu");
assert.match(owner, /styles\.danger/, "close session must remain visually destructive");
assert.doesNotMatch(owner, /position:\s*"fixed"/, "feature owner must not use fixed action controls");
assert.doesNotMatch(wrapper, /VisitsExportMenu/, "legacy inline export trigger must be removed from the session header");

assert.match(styles, /page-header\):has\(\.headerActions\)/, "mobile header must reserve an action column through local ownership");
assert.match(styles, /\.triggerLabel\s*\{\s*display:\s*none/, "mobile trigger must collapse to one menu icon");
assert.match(styles, /grid-template-columns:\s*42px minmax\(0, 1fr\) auto/, "menu items must keep a scalable icon-copy-chevron layout");

console.log("SESSION_ACTION_MENU_UI_CONTRACT=PASS");
