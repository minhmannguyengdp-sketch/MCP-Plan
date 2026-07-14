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
    if (!content.includes(from)) {
      console.warn(`[copy-cleanup] ${relativePath}: missing target: ${String(from).slice(0, 100)}`);
      continue;
    }
    content = content.split(from).join(to);
  }
  write(relativePath, content);
}

writeLines("src/lib/ui/user-facing-error.ts", [
  'const BUSINESS_ERROR_RULES: Array<{ match: string[]; message: string }> = [',
  '  { match: ["session_not_found", "route_not_found", "session_customer_not_found", "no_data_found"], message: "Dữ liệu không còn tồn tại. Vui lòng tải lại trang." },',
  '  { match: ["session_has_activity", "session_has_activity_cancel_instead"], message: "Phiên đã có hoạt động nên không thể xóa. Hãy hủy phiên để giữ lại lịch sử." },',
  '  { match: ["session_closed", "session_closed_read_only", "read_only"], message: "Phiên đã chốt và không thể chỉnh sửa." },',
  '  { match: ["route_inactive"], message: "Tuyến đang tạm dừng nên chưa thể mở phiên." },',
  '  { match: ["required", "invalid_"], message: "Thông tin chưa đầy đủ hoặc chưa hợp lệ. Vui lòng kiểm tra lại." },',
  '  { match: ["missing_supabase", "missing_backend", "missing_config", "supabase_", "backend_unavailable", "fetch failed", "failed_5"], message: "Hệ thống tạm thời chưa sẵn sàng. Vui lòng thử lại sau hoặc liên hệ quản trị." },',
  '  { match: ["duplicate key", "already exists"], message: "Dữ liệu này đã tồn tại. Vui lòng kiểm tra lại." }',
  '];',
  '',
  'export function userFacingError(error: unknown, fallback = "Không thể hoàn tất thao tác. Vui lòng thử lại.") {',
  '  const raw = error instanceof Error ? error.message : String(error || "");',
  '  const normalized = raw.toLowerCase();',
  '  const matched = BUSINESS_ERROR_RULES.find((rule) => rule.match.some((token) => normalized.includes(token)));',
  '  return matched?.message || fallback;',
  '}'
]);

writeLines("src/ui/shell/AppShell.tsx", [
  'import Link from "next/link";',
  'import type { ReactNode } from "react";',
  'import { PRIMARY_NAV_ITEMS, SIDEBAR_NAV_ITEMS, type NavItem } from "./navigation";',
  'import { SettingsQuickButton } from "./SettingsQuickButton";',
  '',
  'type AppShellProps = { children: ReactNode; activeHref?: string };',
  '',
  'function NavLinks({ activeHref, items, mode }: { activeHref: string; items: NavItem[]; mode: "sidebar" | "bottom" }) {',
  '  const style = mode === "bottom" ? { gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` } : undefined;',
  '  return <nav className={mode === "sidebar" ? "sidebar-nav" : "bottom-nav"} style={style} aria-label="Điều hướng chính">',
  '    {items.map((item) => {',
  '      const isActive = item.href === activeHref;',
  '      const className = mode === "sidebar" ? (isActive ? "sidebar-link active" : "sidebar-link") : (isActive ? "bottom-nav-link active" : "bottom-nav-link");',
  '      return <Link className={className} href={item.href} key={item.href} prefetch><span className="nav-icon" aria-hidden="true">{item.icon}</span><span className="nav-label">{mode === "sidebar" ? item.label : item.shortLabel}</span></Link>;',
  '    })}',
  '  </nav>;',
  '}',
  '',
  'export function AppShell({ children, activeHref = "/" }: AppShellProps) {',
  '  return <div className="app-shell">',
  '    <aside className="sidebar">',
  '      <div className="sidebar-brand"><div className="sidebar-title">MCP-Plan</div><div className="sidebar-subtitle">Quản lý tuyến bán hàng, điểm bán, đơn hàng và công việc.</div></div>',
  '      <NavLinks activeHref={activeHref} items={SIDEBAR_NAV_ITEMS} mode="sidebar" />',
  '      <Link className={activeHref === "/settings" ? "sidebar-link active utility-link" : "sidebar-link utility-link"} href="/settings" prefetch><span className="nav-icon" aria-hidden="true">⚙</span><span>Cài đặt ứng dụng</span></Link>',
  '      <div className="sidebar-footer">MCP-Plan · Quản lý phân phối</div>',
  '    </aside>',
  '    <SettingsQuickButton />',
  '    <main className="main">{children}</main>',
  '    <NavLinks activeHref={activeHref} items={PRIMARY_NAV_ITEMS} mode="bottom" />',
  '  </div>;',
  '}'
]);

writeLines("src/ui/shell/navigation.ts", [
  'export type NavItem = { label: string; shortLabel: string; href: string; description: string; icon: string };',
  '',
  'export const PRIMARY_NAV_ITEMS: NavItem[] = [',
  '  { label: "Tổng quan", shortLabel: "Tổng", href: "/", description: "Tình hình kinh doanh và công việc cần xử lý", icon: "⌂" },',
  '  { label: "MCP", shortLabel: "MCP", href: "/mcp", description: "Quản lý tuyến và phiên đi thị trường", icon: "◇" },',
  '  { label: "Đơn hàng", shortLabel: "Đơn", href: "/orders", description: "Theo dõi đơn hàng và doanh số", icon: "+" },',
  '  { label: "Báo cáo phiên", shortLabel: "Báo cáo", href: "/reports", description: "Báo cáo sau mỗi phiên đi tuyến", icon: "▣" },',
  '  { label: "Kế hoạch", shortLabel: "Việc", href: "/plans", description: "Công việc cần theo dõi và xử lý", icon: "✓" }',
  '];',
  '',
  'export const SIDEBAR_NAV_ITEMS: NavItem[] = [',
  '  PRIMARY_NAV_ITEMS[0], PRIMARY_NAV_ITEMS[1],',
  '  { label: "Tuyến bán hàng", shortLabel: "Tuyến", href: "/routes", description: "Quản lý tuyến và điểm bán trong tuyến", icon: "◎" },',
  '  { label: "Đi tuyến hôm nay", shortLabel: "Hôm nay", href: "/visits", description: "Ghi nhận kết quả tại từng điểm bán", icon: "◇" },',
  '  { label: "Lịch sử phiên", shortLabel: "Phiên", href: "/mcp/sessions", description: "Tra cứu các phiên đi tuyến theo ngày", icon: "▤" },',
  '  { label: "Cài đặt MCP", shortLabel: "Mẫu", href: "/mcp-setting", description: "Thiết lập lựa chọn nhanh cho báo cáo", icon: "⚙" },',
  '  { label: "Điểm bán", shortLabel: "Khách", href: "/customers", description: "Hồ sơ và lịch sử chăm sóc điểm bán", icon: "□" },',
  '  PRIMARY_NAV_ITEMS[2], PRIMARY_NAV_ITEMS[3], PRIMARY_NAV_ITEMS[4]',
  '];',
  '',
  'export const NAV_ITEMS = SIDEBAR_NAV_ITEMS;'
]);

writeLines("src/ui/status/SourceBadge.tsx", [
  'type SourceBadgeProps = { source: "api" | "mock" };',
  'export function SourceBadge({ source }: SourceBadgeProps) {',
  '  return source === "mock" ? <span className="badge">Dữ liệu tham khảo</span> : null;',
  '}'
]);

replaceMany("src/app/layout.tsx", [[
  'description: "Quan ly NPP, tuyen ban hang, don hang va ke hoach hanh dong."',
  'description: "Quản lý nhà phân phối, tuyến bán hàng, điểm bán, đơn hàng và công việc."'
]]);
replaceMany("src/app/manifest.ts", [[
  'description: "Quan ly NPP, tuyen ban hang, don hang va ke hoach hanh dong."',
  'description: "Quản lý nhà phân phối, tuyến bán hàng, điểm bán, đơn hàng và công việc."'
]]);

writeLines("src/features/settings/SettingsPage.tsx", [
  'import { PageHeader } from "@/ui/layout/PageHeader";',
  'import { AppShell } from "@/ui/shell/AppShell";',
  'import { InstallAppCard } from "./InstallAppCard";',
  '',
  'export function SettingsPage() {',
  '  return <AppShell activeHref="/settings">',
  '    <PageHeader eyebrow="Cài đặt" title="Cài đặt ứng dụng" subtitle="Cài MCP-Plan trên thiết bị và làm mới ứng dụng khi có phiên bản mới."><span className="badge">Ứng dụng web</span></PageHeader>',
  '    <section className="settings-grid">',
  '      <InstallAppCard />',
  '      <div className="card settings-card"><div><span className="badge">Thông tin ứng dụng</span><h2 className="panel-title">Trạng thái sử dụng</h2><p className="page-subtitle">MCP-Plan sẵn sàng hỗ trợ quản lý tuyến bán hàng, chăm sóc điểm bán và theo dõi công việc hằng ngày.</p></div><div className="grid"><div className="metric-row"><span>Trạng thái</span><strong>Sẵn sàng sử dụng</strong></div><div className="metric-row"><span>Thiết bị</span><strong>Điện thoại và máy tính bảng</strong></div><div className="metric-row"><span>Cập nhật</span><strong>Làm mới nhanh</strong></div></div></div>',
  '    </section>',
  '  </AppShell>;',
  '}'
]);

replaceMany("src/features/settings/InstallAppCard.tsx", [
  ["Cai dat app", "Cài ứng dụng"],
  ["Tai app", "Cài ứng dụng"],
  ["Cap nhat ban moi", "Cập nhật bản mới"],
  ["Dang tai...", "Đang mở..."],
  ["Dang cap nhat...", "Đang làm mới..."],
  ["PWA", "Ứng dụng web"],
  ["He thong", "Thông tin ứng dụng"],
  ["Mobile", "Điện thoại và máy tính bảng"]
]);

writeLines("src/app/mcp/page.tsx", [
  'import Link from "next/link";',
  'import { createApiClient } from "@/lib/api/api-client";',
  'import { CompactKpiStrip } from "@/ui/cards/CompactKpiStrip";',
  'import { TodaySummaryCard } from "@/ui/cards/TodaySummaryCard";',
  'import { FilterBar } from "@/ui/layout/FilterBar";',
  'import { PageHeader } from "@/ui/layout/PageHeader";',
  'import { AppShell } from "@/ui/shell/AppShell";',
  'import { ExportMenu } from "@/features/exports/ExportLinks";',
  'import styles from "./McpHome.module.css";',
  '',
  'const MCP_MODULES = [',
  '  { href: "/routes", tone: "routes", icon: "◎", title: "Tuyến bán hàng", description: "Quản lý tuyến, điểm bán và vị trí trước khi bắt đầu đi thị trường.", cta: "Xem tuyến" },',
  '  { href: "/routes", tone: "session", icon: "◇", title: "Đi tuyến hôm nay", description: "Mở hoặc tiếp tục phiên để ghi đơn hàng, thử sản phẩm, báo cáo và việc cần theo dõi.", cta: "Mở phiên" },',
  '  { href: "/mcp/sessions", tone: "session", icon: "▤", title: "Lịch sử phiên", description: "Tra cứu kết quả đi tuyến theo ngày, tuyến và trạng thái.", cta: "Xem lịch sử" },',
  '  { href: "/mcp-setting", tone: "settings", icon: "⚙", title: "Cài đặt MCP", description: "Quản lý các lựa chọn nhanh dùng khi ghi nhận tình hình thị trường.", cta: "Mở cài đặt" }',
  '] as const;',
  '',
  'function renderModuleCard(item: (typeof MCP_MODULES)[number]) {',
  '  return <Link className={[styles.card, styles[item.tone]].join(" ")} href={item.href} key={item.href + "-" + item.title} prefetch><span className={styles.icon} aria-hidden="true">{item.icon}</span><span className={styles.content}><strong>{item.title}</strong><small>{item.description}</small></span><span className={styles.cta}>{item.cta}</span></Link>;',
  '}',
  '',
  'export default async function McpPage() {',
  '  const api = createApiClient();',
  '  const routesResult = await api.getRoutesData();',
  '  const routes = routesResult.data.routes;',
  '  const activeRoutes = routes.filter((route) => route.status === "active" || route.status === "watch").length;',
  '  const pausedRoutes = routes.filter((route) => route.status === "paused").length;',
  '  const plannedCustomers = routes.reduce((sum, route) => sum + Number(route.plannedCustomers || 0), 0);',
  '  const visitedCustomers = routes.reduce((sum, route) => sum + Number(route.visitedCustomers || 0), 0);',
  '  return <AppShell activeHref="/mcp">',
  '    <PageHeader eyebrow="MCP" title="Quản lý đi thị trường" subtitle="Chuẩn bị tuyến, thực hiện phiên đi thị trường và theo dõi kết quả tại từng điểm bán."><ExportMenu label="Xuất dữ liệu" primary /></PageHeader>',
  '    <TodaySummaryCard eyebrow="Sẵn sàng đi tuyến" value={activeRoutes + " tuyến có thể đi"} description={plannedCustomers + " điểm bán trong tuyến · " + visitedCustomers + " lượt đã ghé theo dữ liệu hiện có"} pills={[{ label: "tuyến", value: routes.length }, { label: "đang hoạt động", value: activeRoutes }, { label: "tạm dừng", value: pausedRoutes }]} />',
  '    <section className={styles.grid} aria-label="Chức năng MCP">{MCP_MODULES.map(renderModuleCard)}</section>',
  '    <FilterBar title="Tình hình tuyến" filters={[{ label: "Tổng tuyến", value: String(routes.length) }, { label: "Có thể đi", value: String(activeRoutes) }, { label: "Tạm dừng", value: String(pausedRoutes) }, { label: "Điểm bán", value: String(plannedCustomers) }]} />',
  '    <CompactKpiStrip items={[{ label: "Tuyến", value: routes.length, hint: "Đang quản lý" }, { label: "Có thể đi", value: activeRoutes, hint: "Đang hoạt động hoặc cần theo dõi" }, { label: "Điểm bán", value: plannedCustomers, hint: "Tổng điểm bán trong tuyến" }, { label: "Đã ghé", value: visitedCustomers, hint: "Theo dữ liệu hiện có" }]} />',
  '  </AppShell>;',
  '}'
]);

replaceMany("src/features/dashboard/DashboardPage.tsx", [
  ["Chưa có BC phiên đã chốt", "Chưa có báo cáo phiên đã chốt"],
  ["BC phiên mới nhất", "Báo cáo phiên mới nhất"],
  ["snapshot BC phiên", "báo cáo phiên"],
  ["rebuild snapshot", "tạo lại báo cáo"],
  ["AI chưa có dữ liệu", "chưa có kết quả phân tích"],
  ["theo dashboard", "theo dữ liệu hiện tại"],
  ['eyebrow="Dashboard"', 'eyebrow="Tổng quan"'],
  ["không chỉ là menu điều hướng", "tập trung vào tình hình kinh doanh và công việc cần xử lý"],
  ["follow-up", "việc theo dõi"],
  [" test ", " lượt thử sản phẩm "]
]);

replaceMany("src/features/mcp/McpMasterView.tsx", [
  ["Tuyến gốc là master data để mở phiên theo ngày.", "Tuyến bán hàng dùng để quản lý danh sách điểm bán và mở phiên theo ngày."],
  ["Xóa thật khỏi DB", "Xóa khỏi hệ thống"],
  ["Tuyến, khách tuyến, phiên, checklist, visits, follow-up và mẫu route-bound của tuyến này sẽ bị xóa theo RPC hard delete.", "Tuyến, danh sách điểm bán và toàn bộ dữ liệu phát sinh liên quan sẽ bị xóa. Dữ liệu đã xóa không thể khôi phục."],
  ["Khách gốc, snapshot của khách trong phiên, visits và follow-up liên quan sẽ bị xóa dứt điểm.", "Điểm bán và các dữ liệu liên quan trong những phiên trước sẽ bị xóa. Dữ liệu đã xóa không thể khôi phục."],
  ["Tuyến gốc", "Tuyến bán hàng"],
  ["Khách tuyến", "Điểm bán"],
  ["Tên khách", "Tên điểm bán"],
  ["SĐT khách", "Số điện thoại"],
  ["VD: Say Me", "Nhập tên điểm bán"],
  ["GPS Lat", "Vĩ độ"],
  ["GPS Lng", "Kinh độ"],
  ["Lấy GPS", "Lấy vị trí"],
  ["Cập nhật GPS", "Cập nhật vị trí"],
  ["Anh chọn", "Vui lòng chọn"],
  ["anh chờ và cấp quyền GPS", "vui lòng cấp quyền định vị cho trình duyệt"],
  ["Mở phiên MCP", "Mở phiên đi tuyến"],
  ["checklist", "danh sách điểm bán"]
]);

replaceMany("src/app/mcp/sessions/page.tsx", [
  ["Lịch sử phiên theo ngày. Xuất file nằm trong menu, không rải nút trên hero.", "Tra cứu các phiên đi tuyến theo ngày, tuyến và trạng thái."],
  ["Phiên/checklist", "Danh sách điểm bán trong phiên"],
  ["BC thị trường", "Báo cáo thị trường"],
  ["Follow-up", "Việc cần theo dõi"]
]);

replaceMany("src/features/mcp/McpSessionsManagerSafe.tsx", [
  ["Backend chưa được cấu hình SUPABASE_SERVICE_ROLE_KEY.", "Hệ thống tạm thời chưa sẵn sàng. Vui lòng liên hệ quản trị."],
  ["Database không áp dụng thao tác xóa. Phiên vẫn được giữ nguyên.", "Không thể xóa phiên. Dữ liệu vẫn được giữ nguyên."],
  ["JSON cho Gemini/ADK", "Dữ liệu JSON"],
  ["JSON BC tạm tính", "Dữ liệu JSON tạm tính"],
  ["Rebuild BC", "Tạo lại báo cáo"],
  ["Đang rebuild...", "Đang tạo lại..."],
  ["Đã rebuild BC phiên", "Đã tạo lại báo cáo phiên"],
  ["Mở checklist", "Mở phiên"],
  ["Nhánh trong phiên:", "Kết quả phiên:"],
  ["TT", "Trạng thái"],
  ["follow-up", "việc theo dõi"],
  [" test", " lượt thử"]
]);

replaceMany("src/features/market-reports/MarketReportsClientPage.tsx", [
  ["AI Summary", "Phân tích AI"],
  ["AI Prompt Context đã lưu trong snapshot", "Dữ liệu báo cáo đã sẵn sàng để phân tích"],
  ["Phân tích bằng ADK Agent", "Phân tích báo cáo"],
  ["Agent đang phân tích...", "Đang phân tích..."],
  ["Agent chưa trả tóm tắt.", "Chưa có nội dung tóm tắt."],
  ["Nguồn snapshot", "Thời điểm chốt"],
  ["Schema", "Nhân viên phụ trách"],
  ["Snapshot v2", "Báo cáo đã chốt"],
  ["Snapshot chưa có customer_details. Hãy rebuild BC phiên.", "Báo cáo chưa có đủ chi tiết điểm bán. Vui lòng tạo lại báo cáo phiên."],
  ["BC phiên", "Báo cáo phiên"],
  ["Follow-up", "Việc theo dõi"],
  ["Sản phẩm test", "Sản phẩm được thử"],
  ["JSON cho AI", "Xuất dữ liệu"],
  ["Markdown", "Xuất văn bản"]
]);

replaceMany("src/features/market-checks/MarketChecksClientPage.tsx", [
  ["MCP / Admin phụ", "MCP"],
  ["Tổng hợp test theo phiên", "Kết quả thử sản phẩm"],
  ["Màn phụ để rà soát test. Test vẫn được ghi từ /visits → khách → Ghi test, gom theo routeId + sessionDate + sessionId.", "Tổng hợp kết quả thử sản phẩm theo từng phiên đi tuyến và điểm bán."],
  ["Session setup", "Theo phiên đi tuyến"],
  ["routeId + ngày + sessionId", "Theo phiên đi tuyến"],
  ["sessionId:", "Phiên:"],
  ["Nhánh test", "Kết quả thử sản phẩm"],
  ["Dòng test", "Kết quả thử"],
  ["Khách có test", "Điểm bán có thử"]
]);

replaceMany("src/features/mcp/McpMarketReportFields.tsx", [
  ["Next action", "Việc tiếp theo"],
  ["MCP Setting", "cài đặt báo cáo"],
  ["BC phiên sẽ tự gom", "Báo cáo phiên sẽ tự tổng hợp"],
  ["Ô trống không lưu. Dữ liệu này là đầu vào cho BC phiên, không tạo BC riêng theo từng khách.", "Chỉ nội dung đã nhập mới được lưu và tổng hợp vào báo cáo phiên."]
]);

replaceMany("src/features/mcp/McpSessionCompactViewFinal2.tsx", [
  ["Ghi test sản phẩm", "Ghi kết quả thử sản phẩm"],
  ["Test nhanh", "Kết quả thử sản phẩm"],
  ["Sản phẩm test khác", "Sản phẩm được thử"],
  ["Kết quả test", "Kết quả"],
  ["Ghi chú test", "Ghi chú"],
  ["Follow-up", "Theo dõi"],
  ["Tạo việc follow-up", "Tạo việc cần theo dõi"],
  ["Loại follow-up", "Loại công việc"],
  ["VD: Hẹn chốt đơn siro", "Nhập nội dung cần theo dõi"],
  ["Hành động checklist", "Thao tác tại điểm bán"],
  ["Checklist phiên", "Phiên đi tuyến"],
  ["Tuyến gốc:", "Tuyến:"],
  ["Sale:", "Phụ trách:"]
]);

replaceMany("src/features/mcp/McpSessionReadonlyView.tsx", [
  ["Checklist phiên", "Phiên đi tuyến"],
  ["Checklist phiên chỉ xem", "Phiên chỉ xem"],
  ["Tuyến gốc:", "Tuyến:"],
  ["Sale:", "Phụ trách:"],
  ["follow-up", "việc theo dõi"],
  ["Có test", "Có thử sản phẩm"]
]);

replaceMany("src/features/accounts/OutletsClientPage.tsx", [
  ["Tier ", "Hạng "],
  ["follow-up", "việc theo dõi"],
  ["quan sát MCP", "ghi nhận thị trường"],
  ["Tệp điểm bán", "Danh sách điểm bán"]
]);
replaceMany("src/features/orders/OrdersClientPage.tsx", [["Sale", "Nhân viên phụ trách"], ["Xuất file", "Xuất đơn hàng"]]);
replaceMany("src/features/actions/ActionsClientPage.tsx", [["Quan sát / test", "Ghi nhận / thử sản phẩm"], ["Đang mở", "Cần xử lý"], ["Nguồn phát sinh", "Phân loại công việc"]]);
replaceMany("src/features/exports/ExportLinks.tsx", [["Khách/tuyến + GPS", "Điểm bán và vị trí"], ["Phiên/checklist", "Phiên đi tuyến"], ["Đơn hàng + item", "Đơn hàng và sản phẩm"], ["BC thị trường", "Báo cáo thị trường"], ["Follow-up", "Việc cần theo dõi"], ["owner", "người phụ trách"], ["Hồ sơ test", "Thông tin thử sản phẩm"]]);

const packageJson = JSON.parse(read("package.json"));
packageJson.scripts = { ...packageJson.scripts, "audit:copy": "node scripts/audit-user-facing-copy.mjs" };
write("package.json", `${JSON.stringify(packageJson, null, 2)}\n`);

writeLines("scripts/audit-user-facing-copy.mjs", [
  'import fs from "node:fs";',
  'import path from "node:path";',
  'const root = path.join(process.cwd(), "src");',
  'const forbidden = ["Frontend sạch trước", "Backend/VPS", "API thật", "Dữ liệu mẫu", "master data", "RPC hard delete", "Xóa thật khỏi DB", "Admin phụ", "Session setup", "routeId + ngày + sessionId", "sessionId:", "Snapshot v2", "AI Prompt Context", "ADK Agent", "rebuild BC", "Đang rebuild", "MCP Setting", "Cai dat app", "Tai app", "Cap nhat ban moi"];',
  'function walk(directory) { return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => { const full = path.join(directory, entry.name); if (entry.isDirectory()) return walk(full); return /\\.(ts|tsx)$/.test(entry.name) ? [full] : []; }); }',
  'const failures = [];',
  'for (const filename of walk(root)) { const content = fs.readFileSync(filename, "utf8"); for (const phrase of forbidden) { if (content.includes(phrase)) failures.push(path.relative(process.cwd(), filename) + ": " + phrase); } }',
  'if (failures.length) { console.error("Phát hiện nội dung kỹ thuật hoặc nội dung mẫu còn xuất hiện trong giao diện:"); failures.forEach((failure) => console.error("- " + failure)); process.exit(1); }',
  'console.log("User-facing copy audit passed.");'
]);

console.log("Applied user-facing copy cleanup v2.");
