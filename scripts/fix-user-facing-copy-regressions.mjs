import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const filePath = (relativePath) => path.join(root, relativePath);
const read = (relativePath) => fs.readFileSync(filePath(relativePath), "utf8");
const write = (relativePath, content) => {
  fs.mkdirSync(path.dirname(filePath(relativePath)), { recursive: true });
  fs.writeFileSync(filePath(relativePath), content.replace(/^\uFEFF/, ""), "utf8");
};
const writeLines = (relativePath, lines) => write(relativePath, `${lines.join("\n")}\n`);

function replaceMany(relativePath, replacements) {
  let content = read(relativePath);
  for (const [from, to] of replacements) {
    if (content.includes(from)) content = content.split(from).join(to);
  }
  write(relativePath, content);
}

function ensureImport(relativePath, anchor, importLine) {
  let content = read(relativePath);
  if (!content.includes(importLine)) content = content.replace(anchor, `${anchor}\n${importLine}`);
  write(relativePath, content);
}

function replaceRegex(relativePath, pattern, replacement) {
  const content = read(relativePath);
  write(relativePath, content.replace(pattern, replacement));
}

// Restore identifiers and API contracts accidentally changed by broad copy replacements.
replaceMany("src/features/mcp/McpSessionsManagerSafe.tsx", [
  ["lượt thửCount?: number;", "testCount?: number;"],
  ["${session.reportCount || 0} BC", "${session.reportCount || 0} báo cáo"],
  ["Không rebuild được BC phiên", "Không tạo lại được báo cáo phiên"],
  ["Đã khóa checklist và xóa phiên", "Phiên đã chốt, chỉ có thể xem và xuất báo cáo"],
  ["Khách snapshot chưa ghé chỉ là kế hoạch và sẽ được xóa cùng phiên.", "Danh sách điểm bán chưa phát sinh hoạt động sẽ được xóa cùng phiên."],
  ["Database sẽ chặn nếu đã có lượt ghé, đơn, lượt thử, báo cáo hoặc việc theo dõi.", "Phiên đã có lượt ghé, đơn hàng, thử sản phẩm, báo cáo hoặc việc theo dõi sẽ được giữ lại."],
  ["Phiên chạy tuyến", "Lịch sử phiên đi tuyến"]
]);
ensureImport("src/features/mcp/McpSessionsManagerSafe.tsx", 'import { useRouter } from "next/navigation";', 'import { userFacingError } from "@/lib/ui/user-facing-error";');
replaceMany("src/features/mcp/McpSessionsManagerSafe.tsx", [
  ["  return raw;", "  return userFacingError(error, fallback);"]
]);

replaceMany("src/features/market-checks/MarketChecksClientPage.tsx", [
  ["      Phiên: check.sessionId,", "      sessionId: check.sessionId,"],
  ['meta={[`routeId: ${group.routeId || "-"}`, `Phiên: ${group.sessionId}`, `${group.visitedCustomers}/${group.plannedCustomers} khách đã ghé`]}', 'meta={[`Tuyến: ${group.routeName}`, sessionStatusLabel(group.status), `${group.visitedCustomers}/${group.plannedCustomers} điểm bán đã ghé`]}'],
  ["<h2>Test nằm trong phiên MCP</h2>", "<h2>Kết quả thử sản phẩm theo phiên</h2>"],
  ["Không còn dàn flat từng dòng như module riêng. Danh sách dưới đây là từng phiên có nhánh test.", "Mỗi phiên hiển thị các điểm bán, sản phẩm đã thử và kết quả cần cập nhật."],
  ["Vào từng phiên để xem các khách/sản phẩm test và nhập kết quả khi cần.", "Mở từng phiên để xem điểm bán, sản phẩm đã thử và cập nhật kết quả."],
  ["Chưa có test nào được gắn với phiên MCP.", "Chưa có kết quả thử sản phẩm trong các phiên đi tuyến."],
  ["<h2 className=\"panel-title\">Vai trò màn này</h2>", "<h2 className=\"panel-title\">Thông tin tổng hợp</h2>"],
  ["<span>Thao tác chính</span><strong>/visits</strong>", "<span>Nguồn dữ liệu</span><strong>Phiên đi tuyến</strong>"],
  ["<span>Màn này</span><strong>Tổng hợp phụ</strong>", "<span>Phạm vi</span><strong>Theo từng phiên</strong>"],
  ["<span>Logic nhóm</span><strong>Theo phiên đi tuyến</strong>", "<span>Sắp xếp</span><strong>Mới nhất trước</strong>"]
]);

// Fully rewrite the install card so no mixed accented/unaccented copy remains.
writeLines("src/features/settings/InstallAppCard.tsx", [
  '"use client";',
  '',
  'import { useEffect, useMemo, useState } from "react";',
  '',
  'type BeforeInstallPromptEvent = Event & {',
  '  prompt: () => Promise<void>;',
  '  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;',
  '};',
  '',
  'function isStandaloneMode() {',
  '  if (typeof window === "undefined") return false;',
  '  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;',
  '}',
  '',
  'export function InstallAppCard() {',
  '  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);',
  '  const [isStandalone, setIsStandalone] = useState(false);',
  '  const [isInstalling, setIsInstalling] = useState(false);',
  '  const [isUpdating, setIsUpdating] = useState(false);',
  '  const [message, setMessage] = useState("Có thể cài MCP-Plan như một ứng dụng riêng trên điện thoại.");',
  '',
  '  const platformHint = useMemo(() => {',
  '    if (typeof navigator === "undefined") return "";',
  '    const userAgent = navigator.userAgent.toLowerCase();',
  '    if (userAgent.includes("iphone") || userAgent.includes("ipad")) return "iPhone/iPad: bấm Chia sẻ, sau đó chọn Thêm vào màn hình chính.";',
  '    return "Android/Chrome: bấm Cài ứng dụng hoặc mở menu trình duyệt và chọn Thêm vào màn hình chính.";',
  '  }, []);',
  '',
  '  useEffect(() => {',
  '    setIsStandalone(isStandaloneMode());',
  '    function handleBeforeInstallPrompt(event: Event) {',
  '      event.preventDefault();',
  '      setInstallPrompt(event as BeforeInstallPromptEvent);',
  '      setMessage("Thiết bị này có thể cài MCP-Plan như một ứng dụng riêng.");',
  '    }',
  '    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);',
  '    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);',
  '  }, []);',
  '',
  '  async function handleInstall() {',
  '    if (isInstalling) return;',
  '    if (isStandalone) { setMessage("MCP-Plan đã được cài trên thiết bị này."); return; }',
  '    if (!installPrompt) { setMessage(platformHint || "Trình duyệt hiện chưa hỗ trợ nút cài đặt tự động."); return; }',
  '    setIsInstalling(true);',
  '    try {',
  '      await installPrompt.prompt();',
  '      const choice = await installPrompt.userChoice;',
  '      setInstallPrompt(null);',
  '      setMessage(choice.outcome === "accepted" ? "Đã gửi yêu cầu cài ứng dụng." : "Đã hủy cài ứng dụng.");',
  '    } finally { setIsInstalling(false); }',
  '  }',
  '',
  '  async function handleRefreshApp() {',
  '    if (isUpdating) return;',
  '    setIsUpdating(true);',
  '    setMessage("Đang kiểm tra và làm mới ứng dụng...");',
  '    try {',
  '      if ("caches" in window) { const names = await caches.keys(); await Promise.all(names.map((name) => caches.delete(name))); }',
  '      if ("serviceWorker" in navigator) { const registrations = await navigator.serviceWorker.getRegistrations(); await Promise.all(registrations.map((registration) => registration.update())); }',
  '      window.setTimeout(() => window.location.reload(), 300);',
  '    } catch {',
  '      setMessage("Chưa thể làm mới tự động. Vui lòng tải lại trang một lần nữa.");',
  '      setIsUpdating(false);',
  '    }',
  '  }',
  '',
  '  return <div className="card settings-card">',
  '    <div><span className="badge">Cài trên thiết bị</span><h2 className="panel-title">Cài ứng dụng và cập nhật phiên bản</h2><p className="page-subtitle">{message}</p><p className="settings-hint">{platformHint}</p></div>',
  '    <div className="settings-actions">',
  '      <button className="button primary" disabled={isInstalling || isUpdating} onClick={handleInstall} type="button">{isInstalling ? "Đang mở..." : "Cài ứng dụng"}</button>',
  '      <button className="button" disabled={isUpdating} onClick={handleRefreshApp} type="button">{isUpdating ? "Đang làm mới..." : "Cập nhật bản mới"}</button>',
  '    </div>',
  '  </div>;',
  '}'
]);

replaceMany("src/features/dashboard/DashboardPage.tsx", [
  ["${sessionMetrics.tests} test", "${sessionMetrics.tests} lượt thử sản phẩm"],
  ["${reportTests} test", "${reportTests} lượt thử sản phẩm"],
  ["lượt thử sản phẩm sản phẩm", "thử sản phẩm"],
  ["text(latestSession.sales) || \"Sale\"", "text(latestSession.sales) || \"Chưa phân công\""],
  ["[\"đơn/test\"", "[\"đơn / thử sản phẩm\""],
  ["text(latestReport.snapshot_source) || \"snapshot\"", "\"Báo cáo đã chốt\""],
  ["[\"cần chốt phiên\", \"cần snapshot\", \"chưa có kết quả phân tích\"]", "[\"cần chốt phiên\", \"chưa có báo cáo\", \"chưa có phân tích\"]"],
  ["Phiên đã chốt nhưng chưa có BC", "Phiên đã chốt nhưng chưa có báo cáo"],
  ["cần tạo lại báo cáo để /reports có dữ liệu chính thức.", "cần tạo lại báo cáo để quản lý có dữ liệu đầy đủ."],
  ["BC mới nhất", "Báo cáo mới nhất"],
  ["lịch việc theo dõi phiên sau", "lịch theo dõi cho phiên sau"],
  ["Xem BC", "Xem báo cáo"],
  ["Mở BC", "Mở báo cáo"],
  ["{ label: \"BC\", value: homeFacts.reports.length }", "{ label: \"báo cáo\", value: homeFacts.reports.length }"],
  ["phiên MCP, BC mới nhất", "phiên đi tuyến, báo cáo mới nhất"],
  ["Mở phiên từ tuyến gốc", "Mở phiên từ tuyến bán hàng"],
  ["để bắt đầu ghi đơn, lượt thử sản phẩm và quan sát", "để bắt đầu ghi đơn, thử sản phẩm và ghi nhận thị trường"],
  ["${sessionMetrics.observations} quan sát", "${sessionMetrics.observations} ghi nhận thị trường"],
  ["${reportObservations} quan sát", "${reportObservations} ghi nhận thị trường"]
]);

replaceMany("src/features/exports/ExportLinks.tsx", [
  ["Danh sách khách tuyến, tọa độ, Google Maps", "Danh sách điểm bán, vị trí và liên kết bản đồ"],
  ["Snapshot khách trong phiên, trạng thái ghé", "Danh sách điểm bán và trạng thái ghé trong phiên"],
  ["Header đơn và dòng sản phẩm", "Thông tin đơn hàng và chi tiết sản phẩm"],
  ["Đối thủ, brand đang dùng, nhu cầu", "Đối thủ, thương hiệu đang dùng và nhu cầu"],
  ['{ label: "Test", href: "/api/backend/exports/tests.csv", hint: "Thông tin thử sản phẩm và kết quả theo khách" }', '{ label: "Kết quả thử sản phẩm", href: "/api/backend/exports/tests.csv", hint: "Sản phẩm đã thử và kết quả theo điểm bán" }']
]);

// Remove sample brand/product constants and use configured report groups instead.
replaceRegex("src/features/mcp/McpMarketReportFields.tsx", /const USED_PRODUCT_GROUPS = \[[\s\S]*?\n\];\n/, "");
replaceRegex("src/features/mcp/McpMarketReportFields.tsx", /function slug\(value: string\) \{[\s\S]*?\n\}\n\n/, "");
replaceRegex("src/features/mcp/McpMarketReportFields.tsx", /function usedProductSelection\(category: string, label: string\): ReportSettingSelection \{[\s\S]*?\n\}\n\n/, "");
replaceMany("src/features/mcp/McpMarketReportFields.tsx", [
  ["  const competitorGroups = useMemo(() => groups.filter((group) => !isFieldGroup(group) && !isLegacyUsedProductGroup(group) && isCompetitorGroup(group) && group.items.length > 0), [groups]);", "  const competitorGroups = useMemo(() => groups.filter((group) => !isFieldGroup(group) && !isLegacyUsedProductGroup(group) && isCompetitorGroup(group) && group.items.length > 0), [groups]);\n  const usedProductGroups = useMemo(() => groups.filter((group) => isLegacyUsedProductGroup(group) && group.items.length > 0), [groups]);"],
  ["{fieldCount} ô ghi thêm", "{fieldCount} nội dung bổ sung"],
  ["Đang tải dữ liệu tick...", "Đang tải lựa chọn..."],
  ["Không tải được dữ liệu tick", "Không tải được lựa chọn báo cáo"],
  ["<div className=\"report-quick-group\"><strong>Thương hiệu/sản phẩm khách đang dùng</strong><div className=\"report-used-product-groups\">{USED_PRODUCT_GROUPS.map((group) => <div className=\"report-used-product-group\" key={group.title}><span>{group.title}</span><div className=\"report-chip-grid\">{group.items.map((label) => { const item = usedProductSelection(group.title, label); return <ReportChip active={selectedIds.has(item.id)} disabled={saving} key={item.id} label={label} onClick={() => applySelection(item)} />; })}</div></div>)}</div></div>", "<div className=\"report-quick-group\"><strong>Thương hiệu hoặc sản phẩm điểm bán đang dùng</strong>{usedProductGroups.length ? <div className=\"report-used-product-groups\">{usedProductGroups.map((group) => <div className=\"report-used-product-group\" key={group.id}><span>{group.title}</span><div className=\"report-chip-grid\">{group.items.map((item) => { const selection = selectionFrom(group, item); return <ReportChip active={selectedIds.has(selection.id)} disabled={saving} key={selection.id} label={selection.label} onClick={() => applySelection(selection)} />; })}</div></div>)}</div> : <p className=\"page-subtitle\">Chưa có danh mục gợi ý. Có thể nhập thông tin ở phần ghi thêm quan sát.</p>}</div>"],
  ["Quan sát nhanh theo khách", "Ghi nhận nhanh theo điểm bán"]
]);

// Remove hardcoded test product suggestions; product name remains free input and orders still use the real catalog.
replaceMany("src/features/mcp/McpSessionCompactViewFinal2.tsx", [
  ['const TEST_PRODUCT_CHIPS = ["Siro Carisa", "Sinh tố Berrino", "Trà Cozy", "Trà GTP", "Topping Bibi", "Topping Ok", "Bột sữa Frima", "Bột sữa HP"];\n', ""],
  ["Đã test", "Đã thử"],
  ["Test lại", "Thử lại"],
  ["Mang mẫu test", "Mang mẫu thử"],
  ["Báo giá sau test", "Báo giá sau khi thử"],
  ["Lưu test", "Lưu kết quả thử"],
  ["Lưu follow-up", "Lưu việc theo dõi"],
  [">Ghi test<", ">Thử sản phẩm<"],
  ["trạng thái test", "kết quả thử"],
  ["Nhập nhanh nếu chưa có chip", "Nhập tên sản phẩm"],
  ["placeholder=\"Sale phụ trách\"", "placeholder=\"Nhân viên phụ trách\""],
  ["Sau test", "Sau khi thử sản phẩm"],
  ["Follow-up khách", "Theo dõi điểm bán"],
  ["Test nhanh từ checklist", "Kết quả thử sản phẩm trong phiên"],
  ["Kết quả thử sản phẩm từ checklist", "Kết quả thử sản phẩm trong phiên"],
  ["Tất cả khách", "Tất cả điểm bán"],
  ["{counters.followups} follow-up", "{counters.followups} việc theo dõi"],
  ["Có follow-up", "Có việc theo dõi"]
]);
replaceRegex("src/features/mcp/McpSessionCompactViewFinal2.tsx", /<div className="report-quick-group"><strong>Sản phẩm thường test<\/strong><div className="report-chip-grid">\{TEST_PRODUCT_CHIPS\.map\([\s\S]*?<\/div><\/div>/, "");

// Complete business language and route all caught errors through the common mapper.
ensureImport("src/features/mcp/McpMasterView.tsx", 'import { BottomSheet } from "@/ui/overlay/BottomSheet";', 'import { userFacingError } from "@/lib/ui/user-facing-error";');
replaceMany("src/features/mcp/McpMasterView.tsx", [
  ["Tạo tuyến gốc", "Tạo tuyến bán hàng"],
  ["Sửa tuyến gốc", "Sửa tuyến bán hàng"],
  ["Xóa dứt điểm tuyến", "Xóa tuyến bán hàng"],
  ["Xóa dứt điểm khách tuyến", "Xóa điểm bán"],
  ["Xóa dứt điểm", "Xóa"],
  ["xóa thật, không archive", "xóa toàn bộ dữ liệu liên quan"],
  ["xóa thật khỏi tuyến gốc", "xóa khỏi tuyến và dữ liệu liên quan"],
  ["Thêm khách vào tuyến", "Thêm điểm bán vào tuyến"],
  ["Sửa khách tuyến", "Sửa điểm bán"],
  ["Thêm khách", "Thêm điểm bán"],
  ["Lưu khách", "Lưu điểm bán"],
  ["Xem khách", "Xem điểm bán"],
  ["Trạng thái khách", "Trạng thái điểm bán"],
  ["Định vị khách", "Định vị điểm bán"],
  ["Bấm lấy định vị trên điện thoại, chờ trình duyệt cấp quyền rồi bấm Lưu khách.", "Bấm lấy vị trí trên điện thoại, cấp quyền định vị rồi lưu điểm bán."],
  ["Bấm Lưu khách để ghi vào tuyến.", "Bấm Lưu điểm bán để hoàn tất."],
  ["Quản lý master tuyến: tạo, sửa, xóa dứt điểm, quản lý khách rồi mở phiên theo ngày.", "Quản lý tuyến bán hàng, điểm bán trong tuyến và mở phiên đi thị trường theo ngày."],
  ["Tuyến gốc mới", "tuyến bán hàng mới"],
  ["Vui lòng chọn tuyến gốc trước, rồi hệ thống mới hiện khách thuộc tuyến đó.", "Vui lòng chọn tuyến để xem các điểm bán thuộc tuyến."],
  ["Bấm Thêm khách vào tuyến để tạo khách gốc.", "Bấm Thêm điểm bán vào tuyến để bắt đầu."],
  ["Vui lòng chọn tuyến trước để xem khách cần GPS.", "Vui lòng chọn tuyến để xem các điểm bán cần bổ sung vị trí."],
  ["GPS đã ổn", "Vị trí đã đầy đủ"],
  ["Tuyến đang chọn không có khách cần bổ sung GPS.", "Tuyến đang chọn không có điểm bán cần bổ sung vị trí."],
  ["Cần GPS", "Cần định vị"],
  ["Khách", "Điểm bán"],
  ["Không lấy được định vị, kiểm tra quyền GPS của trình duyệt", "Không lấy được vị trí. Vui lòng kiểm tra quyền định vị của trình duyệt."],
  ["setMessage(error instanceof Error ? error.message : \"Không lưu được tuyến\")", "setMessage(userFacingError(error, \"Không lưu được tuyến. Vui lòng thử lại.\"))"],
  ["setMessage(error instanceof Error ? error.message : \"Không lưu được khách tuyến\")", "setMessage(userFacingError(error, \"Không lưu được điểm bán. Vui lòng thử lại.\"))"],
  ["setMessage(error instanceof Error ? error.message : \"Không mở được phiên MCP\")", "setMessage(userFacingError(error, \"Không mở được phiên đi tuyến. Vui lòng thử lại.\"))"]
]);

ensureImport("src/features/market-reports/MarketReportsClientPage.tsx", 'import { AppShell } from "@/ui/shell/AppShell";', 'import { userFacingError } from "@/lib/ui/user-facing-error";');
replaceMany("src/features/market-reports/MarketReportsClientPage.tsx", [
  ['{ id: "tests", label: "Test" }', '{ id: "tests", label: "Kết quả thử" }'],
  ['{ id: "observations", label: "Quan sát" }', '{ id: "observations", label: "Ghi nhận thị trường" }'],
  ['{ id: "customers", label: "Khách" }', '{ id: "customers", label: "Điểm bán" }'],
  ['title: "Dữ liệu AI"', 'title: "Dữ liệu báo cáo"'],
  ['buildExportLink("JSON cho Gemini/ADK", dataExportUrl(report, "json"), undefined, "Dữ liệu máy đọc có cấu trúc")', 'buildExportLink("Xuất dữ liệu", dataExportUrl(report, "json"), undefined, "Dữ liệu có cấu trúc để phân tích")'],
  ['"Văn bản để dán vào AI hoặc lưu kỹ thuật"', '"Bản văn bản để đọc hoặc phân tích"'],
  ['leading={<span>BC</span>}', 'leading={<span>BC</span>}'],
  ['${ov.visited}/${ov.planned} khách', '${ov.visited}/${ov.planned} điểm bán'],
  ['${ov.tests} test', '${ov.tests} lượt thử'],
  ['<div className="metric-row"><span>Nhân viên phụ trách</span><strong>{report.schemaVersion || "-"}</strong></div>', '<div className="metric-row"><span>Nhân viên phụ trách</span><strong>{report.sales || "-"}</strong></div>'],
  ['<div className="metric-row"><span>Thời điểm chốt</span><strong>{report.snapshotSource || "-"}</strong></div>', '<div className="metric-row"><span>Thời điểm chốt</span><strong>{report.snapshotAt || "-"}</strong></div>'],
  ["Phiên này chưa có test sản phẩm.", "Phiên này chưa có kết quả thử sản phẩm."],
  ["Phiên này chưa có follow-up.", "Phiên này chưa có việc cần theo dõi."],
  ["Kết quả AI đã lưu{state.source ? ` · ${state.source}` : \"\"}", "Kết quả phân tích đã lưu"],
  ['meta={item.status || "unknown"}', 'meta={item.status || "Chưa phân loại"}'],
  ['meta={item.priority || "medium"}', 'meta={item.priority || "Ưu tiên vừa"}'],
  ['${item.confidence || "medium"}', '${item.confidence || "Mức vừa"}'],
  ["Agent chưa phân tích được Báo cáo phiên.", "Chưa thể phân tích báo cáo."],
  ["Không gọi được MCP Report Agent.", "Chưa thể phân tích báo cáo."],
  ["setError(payload.error || result.summary || \"Chưa thể phân tích báo cáo.\")", "setError(userFacingError(payload.error || result.summary, \"Chưa thể phân tích báo cáo. Vui lòng thử lại.\"))"],
  ["setError(cause instanceof Error ? cause.message : \"Chưa thể phân tích báo cáo.\")", "setError(userFacingError(cause, \"Chưa thể phân tích báo cáo. Vui lòng thử lại.\"))"],
  ["Kết quả AI đã lưu", "Kết quả phân tích đã lưu"],
  ["Đã có kết quả AI", "Đã có kết quả phân tích"],
  ["Agent đã sẵn sàng", "Sẵn sàng phân tích"],
  ["Snapshot chưa có nhận định.", "Báo cáo chưa có nhận định."],
  ["Chi tiết Báo cáo phiên", "Chi tiết báo cáo phiên"],
  ["Báo cáo phiên MCP", "Báo cáo phiên"],
  ["Snapshot hoàn chỉnh cho quản lý: xem nhanh, xuất PDF/Excel/Word và dùng AI khi cần.", "Tổng hợp kết quả đi tuyến để quản lý xem nhanh, xuất báo cáo và phân tích khi cần."],
  ['<FilterBar filters={[{ label: "Nguồn", value: "Phiên MCP" }, { label: "Nhân viên phụ trách", value: "Báo cáo đã chốt" }, { label: "Nhóm", value: "Theo phiên" }]} />', '<FilterBar filters={[{ label: "Phạm vi", value: "Theo phiên đi tuyến" }, { label: "Tình trạng", value: "Đã chốt" }, { label: "Sắp xếp", value: "Mới nhất trước" }]} />'],
  ["<span>Đủ khách</span>", "<span>Chi tiết điểm bán</span>"],
  ["<span>AI lưu kết quả</span>", "<span>Lưu kết quả phân tích</span>"],
  ["Chưa có Báo cáo phiên.", "Chưa có báo cáo phiên."]
]);

// Expand the audit to catch the exact regression classes that caused the failed build and contract mutation.
let audit = read("scripts/audit-user-facing-copy.mjs");
audit = audit.replace('  "Dữ liệu từ phiên MCP"', '  "Dữ liệu từ phiên MCP",\n  "Route Master",\n  "Route Customer Master",\n  "Session Customer Snapshot",\n  "MCP Daily Session",\n  "MCP Report Agent",\n  "popup BC",\n  "dàn flat",\n  "bam Chia se",\n  "Dang mo..."');
audit = audit.replace('console.log("User-facing copy audit passed.");', `const sourceFiles = walk(srcRoot);
const integrityChecks = [
  { path: "src/features/mcp/McpSessionsManagerSafe.tsx", phrase: "lượt thửCount" },
  { path: "src/features/market-checks/MarketChecksClientPage.tsx", phrase: "Phiên: check.sessionId" },
  { path: "src/features/mcp/McpSessionCompactViewFinal2.tsx", phrase: "TEST_PRODUCT_CHIPS" },
  { path: "src/features/mcp/McpMarketReportFields.tsx", phrase: "USED_PRODUCT_GROUPS" }
];
for (const check of integrityChecks) {
  const content = fs.readFileSync(path.join(process.cwd(), check.path), "utf8");
  if (content.includes(check.phrase)) failures.push(check.path + ": " + check.phrase);
}
if (failures.length) {
  console.error("Phát hiện nội dung kỹ thuật, nội dung mẫu hoặc lỗi toàn vẹn do thay copy:");
  failures.forEach((failure) => console.error("- " + failure));
  process.exit(1);
}
console.log("User-facing copy audit passed.");`);
// Remove the earlier failure block so checks run once after integrity checks.
audit = audit.replace(/if \(failures\.length\) \{\n  console\.error\("Phát hiện nội dung kỹ thuật hoặc nội dung mẫu còn xuất hiện trong giao diện:"\);\n  failures\.forEach\(\(failure\) => console\.error\("- " \+ failure\)\);\n  process\.exit\(1\);\n\}\n\n/, "");
write("scripts/audit-user-facing-copy.mjs", audit);

const packageJson = JSON.parse(read("package.json"));
packageJson.scripts = { ...packageJson.scripts, "verify:copy": "npm run audit:copy && npm run typecheck" };
write("package.json", `${JSON.stringify(packageJson, null, 2)}\n`);

console.log("Fixed copy cleanup regressions, restored contracts, and removed hardcoded UI samples.");
