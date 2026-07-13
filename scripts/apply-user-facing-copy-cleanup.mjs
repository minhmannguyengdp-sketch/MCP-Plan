import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function filePath(relativePath) {
  return path.join(root, relativePath);
}

function read(relativePath) {
  return fs.readFileSync(filePath(relativePath), "utf8");
}

function write(relativePath, content) {
  fs.mkdirSync(path.dirname(filePath(relativePath)), { recursive: true });
  fs.writeFileSync(filePath(relativePath), content.replace(/^\uFEFF/, ""), "utf8");
}

function replaceMany(relativePath, replacements) {
  let content = read(relativePath);
  for (const [from, to] of replacements) {
    if (!content.includes(from)) {
      console.warn(`[copy-cleanup] ${relativePath}: missing target: ${from.slice(0, 100)}`);
      continue;
    }
    content = content.split(from).join(to);
  }
  write(relativePath, content);
}

write("src/lib/ui/user-facing-error.ts", `const BUSINESS_ERROR_RULES: Array<{ match: string[]; message: string }> = [
  {
    match: ["session_not_found", "route_not_found", "session_customer_not_found", "no_data_found"],
    message: "Dữ liệu không còn tồn tại. Vui lòng tải lại trang."
  },
  {
    match: ["session_has_activity", "session_has_activity_cancel_instead"],
    message: "Phiên đã có hoạt động nên không thể xóa. Hãy hủy phiên để giữ lại lịch sử."
  },
  {
    match: ["session_closed", "session_closed_read_only", "read_only"],
    message: "Phiên đã chốt và không thể chỉnh sửa."
  },
  {
    match: ["route_inactive"],
    message: "Tuyến đang tạm dừng nên chưa thể mở phiên."
  },
  {
    match: ["required", "invalid_"],
    message: "Thông tin chưa đầy đủ hoặc chưa hợp lệ. Vui lòng kiểm tra lại."
  },
  {
    match: ["missing_supabase", "missing_backend", "missing_config", "supabase_", "backend_unavailable", "fetch failed", "failed_5"],
    message: "Hệ thống tạm thời chưa sẵn sàng. Vui lòng thử lại sau hoặc liên hệ quản trị."
  },
  {
    match: ["duplicate key", "already exists"],
    message: "Dữ liệu này đã tồn tại. Vui lòng kiểm tra lại."
  }
];

export function userFacingError(error: unknown, fallback = "Không thể hoàn tất thao tác. Vui lòng thử lại.") {
  const raw = error instanceof Error ? error.message : String(error || "");
  const normalized = raw.toLowerCase();
  const matched = BUSINESS_ERROR_RULES.find((rule) => rule.match.some((token) => normalized.includes(token)));
  return matched?.message || fallback;
}
`);

write("src/ui/shell/AppShell.tsx", `import Link from "next/link";
import type { ReactNode } from "react";
import { PRIMARY_NAV_ITEMS, SIDEBAR_NAV_ITEMS, type NavItem } from "./navigation";
import { SettingsQuickButton } from "./SettingsQuickButton";

type AppShellProps = {
  children: ReactNode;
  activeHref?: string;
};

function NavLinks({ activeHref, items, mode }: { activeHref: string; items: NavItem[]; mode: "sidebar" | "bottom" }) {
  const style = mode === "bottom" ? { gridTemplateColumns: \`repeat(\${items.length}, minmax(0, 1fr))\` } : undefined;

  return (
    <nav className={mode === "sidebar" ? "sidebar-nav" : "bottom-nav"} style={style} aria-label="Điều hướng chính">
      {items.map((item) => {
        const isActive = item.href === activeHref;
        const className = mode === "sidebar" ? (isActive ? "sidebar-link active" : "sidebar-link") : isActive ? "bottom-nav-link active" : "bottom-nav-link";

        return (
          <Link className={className} href={item.href} key={item.href} prefetch>
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            <span className="nav-label">{mode === "sidebar" ? item.label : item.shortLabel}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children, activeHref = "/" }: AppShellProps) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-title">MCP-Plan</div>
          <div className="sidebar-subtitle">Quản lý tuyến bán hàng, điểm bán, đơn hàng và công việc.</div>
        </div>

        <NavLinks activeHref={activeHref} items={SIDEBAR_NAV_ITEMS} mode="sidebar" />

        <Link className={activeHref === "/settings" ? "sidebar-link active utility-link" : "sidebar-link utility-link"} href="/settings" prefetch>
          <span className="nav-icon" aria-hidden="true">{"⚙"}</span>
          <span>Cài đặt ứng dụng</span>
        </Link>

        <div className="sidebar-footer">MCP-Plan · Quản lý phân phối</div>
      </aside>

      <SettingsQuickButton />

      <main className="main">{children}</main>
      <NavLinks activeHref={activeHref} items={PRIMARY_NAV_ITEMS} mode="bottom" />
    </div>
  );
}
`);

write("src/ui/shell/navigation.ts", `export type NavItem = {
  label: string;
  shortLabel: string;
  href: string;
  description: string;
  icon: string;
};

export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { label: "Tổng quan", shortLabel: "Tổng", href: "/", description: "Tình hình kinh doanh và công việc cần xử lý", icon: "⌂" },
  { label: "MCP", shortLabel: "MCP", href: "/mcp", description: "Quản lý tuyến và phiên đi thị trường", icon: "◇" },
  { label: "Đơn hàng", shortLabel: "Đơn", href: "/orders", description: "Theo dõi đơn hàng và doanh số", icon: "+" },
  { label: "Báo cáo phiên", shortLabel: "Báo cáo", href: "/reports", description: "Báo cáo sau mỗi phiên đi tuyến", icon: "▣" },
  { label: "Kế hoạch", shortLabel: "Việc", href: "/plans", description: "Công việc cần theo dõi và xử lý", icon: "✓" }
];

export const SIDEBAR_NAV_ITEMS: NavItem[] = [
  PRIMARY_NAV_ITEMS[0],
  PRIMARY_NAV_ITEMS[1],
  { label: "Tuyến bán hàng", shortLabel: "Tuyến", href: "/routes", description: "Quản lý tuyến và điểm bán trong tuyến", icon: "◎" },
  { label: "Đi tuyến hôm nay", shortLabel: "Hôm nay", href: "/visits", description: "Ghi nhận kết quả tại từng điểm bán", icon: "◇" },
  { label: "Lịch sử phiên", shortLabel: "Phiên", href: "/mcp/sessions", description: "Tra cứu các phiên đi tuyến theo ngày", icon: "▤" },
  { label: "Cài đặt MCP", shortLabel: "Mẫu", href: "/mcp-setting", description: "Thiết lập lựa chọn nhanh cho báo cáo", icon: "⚙" },
  { label: "Điểm bán", shortLabel: "Khách", href: "/customers", description: "Hồ sơ và lịch sử chăm sóc điểm bán", icon: "□" },
  PRIMARY_NAV_ITEMS[2],
  PRIMARY_NAV_ITEMS[3],
  PRIMARY_NAV_ITEMS[4]
];

export const NAV_ITEMS = SIDEBAR_NAV_ITEMS;
`);

write("src/ui/status/SourceBadge.tsx", `type SourceBadgeProps = {
  source: "api" | "mock";
};

export function SourceBadge({ source }: SourceBadgeProps) {
  return source === "mock" ? <span className="badge">Dữ liệu tham khảo</span> : null;
}
`);

write("src/app/layout.tsx", read("src/app/layout.tsx")
  .replace('description: "Quan ly NPP, tuyen ban hang, don hang va ke hoach hanh dong."', 'description: "Quản lý nhà phân phối, tuyến bán hàng, điểm bán, đơn hàng và công việc."'));

write("src/app/manifest.ts", read("src/app/manifest.ts")
  .replace('description: "Quan ly NPP, tuyen ban hang, don hang va ke hoach hanh dong."', 'description: "Quản lý nhà phân phối, tuyến bán hàng, điểm bán, đơn hàng và công việc."'));

write("src/features/settings/SettingsPage.tsx", `import { PageHeader } from "@/ui/layout/PageHeader";
import { AppShell } from "@/ui/shell/AppShell";
import { InstallAppCard } from "./InstallAppCard";

export function SettingsPage() {
  return (
    <AppShell activeHref="/settings">
      <PageHeader
        eyebrow="Cài đặt"
        title="Cài đặt ứng dụng"
        subtitle="Cài MCP-Plan trên thiết bị và làm mới ứng dụng khi có phiên bản mới."
      >
        <span className="badge">Ứng dụng web</span>
      </PageHeader>

      <section className="settings-grid">
        <InstallAppCard />

        <div className="card settings-card">
          <div>
            <span className="badge">Thông tin ứng dụng</span>
            <h2 className="panel-title">Trạng thái sử dụng</h2>
            <p className="page-subtitle">MCP-Plan sẵn sàng hỗ trợ quản lý tuyến bán hàng, chăm sóc điểm bán và theo dõi công việc hằng ngày.</p>
          </div>

          <div className="grid">
            <div className="metric-row"><span>Trạng thái</span><strong>Sẵn sàng sử dụng</strong></div>
            <div className="metric-row"><span>Thiết bị</span><strong>Điện thoại và máy tính bảng</strong></div>
            <div className="metric-row"><span>Cập nhật</span><strong>Làm mới nhanh</strong></div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
`);

write("src/features/settings/InstallAppCard.tsx", `"use client";

import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function InstallAppCard() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState("Có thể cài MCP-Plan như một ứng dụng riêng trên điện thoại.");

  const platformHint = useMemo(() => {
    if (typeof navigator === "undefined") return "";
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes("iphone") || userAgent.includes("ipad")) {
      return "iPhone/iPad: bấm Chia sẻ, sau đó chọn Thêm vào màn hình chính.";
    }
    return "Android/Chrome: bấm Cài ứng dụng hoặc mở menu trình duyệt và chọn Thêm vào màn hình chính.";
  }, []);

  useEffect(() => {
    setIsStandalone(isStandaloneMode());

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setMessage("Thiết bị này có thể cài MCP-Plan như một ứng dụng riêng.");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  async function handleInstall() {
    if (isInstalling) return;

    if (isStandalone) {
      setMessage("MCP-Plan đã được cài trên thiết bị này.");
      return;
    }

    if (!installPrompt) {
      setMessage(platformHint || "Trình duyệt hiện chưa hỗ trợ nút cài đặt tự động.");
      return;
    }

    setIsInstalling(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      setMessage(choice.outcome === "accepted" ? "Đã gửi yêu cầu cài ứng dụng." : "Đã hủy cài ứng dụng.");
    } finally {
      setIsInstalling(false);
    }
  }

  async function handleRefreshApp() {
    if (isUpdating) return;

    setIsUpdating(true);
    setMessage("Đang kiểm tra và làm mới ứng dụng...");

    try {
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      }

      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.update()));
      }

      window.setTimeout(() => window.location.reload(), 300);
    } catch {
      setMessage("Chưa thể làm mới tự động. Vui lòng tải lại trang một lần nữa.");
      setIsUpdating(false);
    }
  }

  return (
    <div className="card settings-card">
      <div>
        <span className="badge">Cài trên thiết bị</span>
        <h2 className="panel-title">Cài ứng dụng và cập nhật phiên bản</h2>
        <p className="page-subtitle">{message}</p>
        <p className="settings-hint">{platformHint}</p>
      </div>

      <div className="settings-actions">
        <button className="button primary" disabled={isInstalling || isUpdating} onClick={handleInstall} type="button">
          {isInstalling ? "Đang mở..." : "Cài ứng dụng"}
        </button>
        <button className="button" disabled={isUpdating} onClick={handleRefreshApp} type="button">
          {isUpdating ? "Đang làm mới..." : "Cập nhật bản mới"}
        </button>
      </div>
    </div>
  );
}
`);

write("src/app/mcp/page.tsx", `import Link from "next/link";
import { createApiClient } from "@/lib/api/api-client";
import { CompactKpiStrip } from "@/ui/cards/CompactKpiStrip";
import { TodaySummaryCard } from "@/ui/cards/TodaySummaryCard";
import { FilterBar } from "@/ui/layout/FilterBar";
import { PageHeader } from "@/ui/layout/PageHeader";
import { AppShell } from "@/ui/shell/AppShell";
import { ExportMenu } from "@/features/exports/ExportLinks";
import styles from "./McpHome.module.css";

const MCP_MODULES = [
  { href: "/routes", tone: "routes", icon: "◎", title: "Tuyến bán hàng", description: "Quản lý tuyến, điểm bán và vị trí trước khi bắt đầu đi thị trường.", cta: "Xem tuyến" },
  { href: "/routes", tone: "session", icon: "◇", title: "Đi tuyến hôm nay", description: "Mở hoặc tiếp tục phiên để ghi đơn hàng, thử sản phẩm, báo cáo và việc cần theo dõi.", cta: "Mở phiên" },
  { href: "/mcp/sessions", tone: "session", icon: "▤", title: "Lịch sử phiên", description: "Tra cứu kết quả đi tuyến theo ngày, tuyến và trạng thái.", cta: "Xem lịch sử" },
  { href: "/mcp-setting", tone: "settings", icon: "⚙", title: "Cài đặt MCP", description: "Quản lý các lựa chọn nhanh dùng khi ghi nhận tình hình thị trường.", cta: "Mở cài đặt" }
] as const;

function renderModuleCard(item: (typeof MCP_MODULES)[number]) {
  return <Link className={\`${styles.card} ${styles[item.tone]}\`} href={item.href} key={\`${item.href}-${item.title}\`} prefetch><span className={styles.icon} aria-hidden="true">{item.icon}</span><span className={styles.content}><strong>{item.title}</strong><small>{item.description}</small></span><span className={styles.cta}>{item.cta}</span></Link>;
}

export default async function McpPage() {
  const api = createApiClient();
  const routesResult = await api.getRoutesData();
  const routes = routesResult.data.routes;
  const activeRoutes = routes.filter((route) => route.status === "active" || route.status === "watch").length;
  const pausedRoutes = routes.filter((route) => route.status === "paused").length;
  const plannedCustomers = routes.reduce((sum, route) => sum + Number(route.plannedCustomers || 0), 0);
  const visitedCustomers = routes.reduce((sum, route) => sum + Number(route.visitedCustomers || 0), 0);

  return <AppShell activeHref="/mcp">
    <PageHeader eyebrow="MCP" title="Quản lý đi thị trường" subtitle="Chuẩn bị tuyến, thực hiện phiên đi thị trường và theo dõi kết quả tại từng điểm bán."><ExportMenu label="Xuất dữ liệu" primary /></PageHeader>
    <TodaySummaryCard eyebrow="Sẵn sàng đi tuyến" value={`${activeRoutes} tuyến có thể đi`} description={`${plannedCustomers} điểm bán trong tuyến · ${visitedCustomers} lượt đã ghé theo dữ liệu hiện có`} pills={[{ label: "tuyến", value: routes.length }, { label: "đang hoạt động", value: activeRoutes }, { label: "tạm dừng", value: pausedRoutes }]} />
    <section className={styles.grid} aria-label="Chức năng MCP">{MCP_MODULES.map(renderModuleCard)}</section>
    <FilterBar title="Tình hình tuyến" filters={[{ label: "Tổng tuyến", value: String(routes.length) }, { label: "Có thể đi", value: String(activeRoutes) }, { label: "Tạm dừng", value: String(pausedRoutes) }, { label: "Điểm bán", value: String(plannedCustomers) }]} />
    <CompactKpiStrip items={[{ label: "Tuyến", value: routes.length, hint: "Đang quản lý" }, { label: "Có thể đi", value: activeRoutes, hint: "Đang hoạt động hoặc cần theo dõi" }, { label: "Điểm bán", value: plannedCustomers, hint: "Tổng điểm bán trong tuyến" }, { label: "Đã ghé", value: visitedCustomers, hint: "Theo dữ liệu hiện có" }]} />
    <section className="dashboard-section dashboard-actions-section"><div className="dashboard-section-head"><h2>Quy trình làm việc</h2><span>3 bước</span></div><div className="dashboard-action-list"><article className="action-card dashboard-action-card"><div><span className="dashboard-priority priority-high">Bước 1</span><h3>Chọn tuyến</h3><p>Kiểm tra danh sách điểm bán và vị trí trước khi bắt đầu.</p></div><Link href="/routes" prefetch>Xem tuyến</Link></article><article className="action-card dashboard-action-card"><div><span className="dashboard-priority priority-medium">Bước 2</span><h3>Mở phiên đi tuyến</h3><p>Ghi nhận kết quả ghé, đơn hàng, thử sản phẩm, báo cáo và việc cần theo dõi.</p></div><Link href="/routes" prefetch>Mở phiên</Link></article><article className="action-card dashboard-action-card"><div><span className="dashboard-priority priority-low">Bước 3</span><h3>Xem kết quả</h3><p>Tra cứu các phiên trước và xuất báo cáo khi cần.</p></div><Link href="/mcp/sessions" prefetch>Xem lịch sử</Link></article></div></section>
  </AppShell>;
}
`);

write("src/features/mcp/mcp-customer-actions.ts", `export type McpCustomerAction = "order" | "test" | "market_report" | "follow_up" | "skip";

export function mcpCustomerActionLabel(action: McpCustomerAction) {
  if (action === "order") return "Tạo đơn";
  if (action === "test") return "Thử sản phẩm";
  if (action === "market_report") return "Ghi nhận thị trường";
  if (action === "skip") return "Không ghé / chưa mua";
  return "Tạo việc theo dõi";
}

export function mcpCustomerActionDescription(action: McpCustomerAction) {
  if (action === "order") return "Tạo đơn hàng cho điểm bán trong phiên hiện tại.";
  if (action === "test") return "Ghi kết quả thử sản phẩm tại điểm bán.";
  if (action === "market_report") return "Ghi nhận giá, đối thủ, nhu cầu và tình hình bán hàng.";
  if (action === "skip") return "Đánh dấu chưa ghé hoặc chưa mua và ghi rõ lý do.";
  return "Tạo công việc cần theo dõi sau buổi ghé.";
}

export const MCP_CUSTOMER_ACTIONS: McpCustomerAction[] = ["order", "test", "market_report", "follow_up", "skip"];
`);

replaceMany("src/features/dashboard/DashboardPage.tsx", [
  ["Chưa có BC phiên đã chốt", "Chưa có báo cáo phiên đã chốt"],
  [" đơn · ${sessionMetrics.tests} test · ${sessionMetrics.observations} quan sát", " đơn · ${sessionMetrics.tests} lượt thử sản phẩm · ${sessionMetrics.observations} ghi nhận thị trường"],
  ["${sessionMetrics.followups} follow-up", "${sessionMetrics.followups} việc theo dõi"],
  ["BC phiên mới nhất", "Báo cáo phiên mới nhất"],
  ["${reportObservations} quan sát · ${reportFollowups} follow-up", "${reportObservations} ghi nhận thị trường · ${reportFollowups} việc theo dõi"],
  ["Chưa có snapshot BC phiên để quản lý đọc nhanh hoặc đưa vào AI phân tích.", "Chưa có báo cáo phiên đã chốt để xem nhanh hoặc phân tích."],
  ["đơn/test", "đơn / thử sản phẩm"],
  ["text(latestReport.snapshot_source) || \"snapshot\"", "\"Báo cáo đã chốt\""],
  ["[\"cần chốt phiên\", \"cần snapshot\", \"AI chưa có dữ liệu\"]", "[\"cần chốt phiên\", \"chưa có báo cáo\", \"chưa có phân tích\"]"],
  ["theo dashboard", "theo dữ liệu hiện tại"],
  ["Phiên đã chốt nhưng chưa có BC", "Phiên đã chốt nhưng chưa có báo cáo"],
  ["cần rebuild snapshot để /reports có dữ liệu chính thức.", "cần tạo lại báo cáo để quản lý có dữ liệu đầy đủ."],
  ["BC mới nhất chỉ ghé", "Báo cáo mới nhất chỉ ghi nhận"],
  ["lịch follow-up phiên sau", "lịch theo dõi cho phiên sau"],
  ["Có test nhưng chưa có follow-up", "Có thử sản phẩm nhưng chưa có việc theo dõi"],
  ["BC mới nhất có test sản phẩm nhưng chưa tạo việc theo dõi. Nên bổ sung follow-up để không mất tín hiệu mua hàng.", "Báo cáo mới nhất có kết quả thử sản phẩm nhưng chưa có việc theo dõi. Nên bổ sung để không bỏ sót cơ hội bán hàng."],
  ["tránh sót follow-up", "tránh sót việc theo dõi"],
  ["eyebrow=\"Dashboard\"", "eyebrow=\"Tổng quan\""],
  ["subtitle=\"Nhìn nhanh phiên MCP, BC mới nhất, việc cần xử lý và sức khỏe tuyến — không chỉ là menu điều hướng.\"", "subtitle=\"Theo dõi nhanh phiên đi tuyến, báo cáo mới nhất, công việc cần xử lý và tình hình từng tuyến.\""],
  ["hasLatestReport ? \"BC phiên mới nhất\"", "hasLatestReport ? \"Báo cáo phiên mới nhất\""],
  ["· ${sessionMetrics.tests} test", "· ${sessionMetrics.tests} lượt thử sản phẩm"],
  ["· ${reportTests} test · ${reportObservations} quan sát", "· ${reportTests} lượt thử sản phẩm · ${reportObservations} ghi nhận thị trường"],
  ["{ label: \"BC\", value: homeFacts.reports.length }", "{ label: \"báo cáo\", value: homeFacts.reports.length }"],
  ["{ label: \"BC mới nhất\"", "{ label: \"Báo cáo mới nhất\""],
  ["từ phiên, BC và tuyến hiện tại", "từ phiên, báo cáo và tuyến hiện tại"]
]);

replaceMany("src/features/mcp/McpMasterView.tsx", [
  ['import { BottomSheet } from "@/ui/overlay/BottomSheet";', 'import { BottomSheet } from "@/ui/overlay/BottomSheet";\nimport { userFacingError } from "@/lib/ui/user-facing-error";'],
  ["Tạo tuyến gốc", "Tạo tuyến bán hàng"],
  ["Sửa tuyến gốc", "Sửa tuyến bán hàng"],
  ["Xóa dứt điểm tuyến", "Xóa tuyến bán hàng"],
  ["Xóa dứt điểm", "Xóa"],
  ["xóa thật, không archive", "xóa toàn bộ dữ liệu liên quan"],
  ["Tuyến gốc là master data để mở phiên theo ngày.", "Tuyến bán hàng dùng để quản lý danh sách điểm bán và mở phiên theo ngày."],
  ["Xóa thật khỏi DB", "Xóa khỏi hệ thống"],
  ["Tuyến, khách tuyến, phiên, checklist, visits, follow-up và mẫu route-bound của tuyến này sẽ bị xóa theo RPC hard delete.", "Tuyến, danh sách điểm bán và toàn bộ dữ liệu phát sinh liên quan sẽ bị xóa. Dữ liệu đã xóa không thể khôi phục."],
  ["Thêm khách vào tuyến", "Thêm điểm bán vào tuyến"],
  ["Sửa khách tuyến", "Sửa điểm bán"],
  ["Xóa dứt điểm khách tuyến", "Xóa điểm bán"],
  ["xóa thật khỏi tuyến gốc", "xóa khỏi tuyến và các dữ liệu liên quan"],
  ["Khách gốc, snapshot của khách trong phiên, visits và follow-up liên quan sẽ bị xóa dứt điểm.", "Điểm bán và các dữ liệu liên quan trong những phiên trước sẽ bị xóa. Dữ liệu đã xóa không thể khôi phục."],
  ["Tên khách", "Tên điểm bán"],
  ["SĐT khách", "Số điện thoại"],
  ["VD: Say Me", "Nhập tên điểm bán"],
  ["GPS Lat", "Vĩ độ"],
  ["GPS Lng", "Kinh độ"],
  ["Độ chính xác GPS, mét", "Độ chính xác, mét"],
  ["Ghi chú khách tuyến", "Ghi chú điểm bán"],
  ["Xem khách", "Xem điểm bán"],
  ["Khách tuyến", "Điểm bán"],
  ["Cần GPS", "Cần định vị"],
  ["Lấy GPS", "Lấy vị trí"],
  ["Cập nhật GPS", "Cập nhật vị trí"],
  ["Cần chọn tuyến gốc trước khi thêm khách", "Vui lòng chọn tuyến trước khi thêm điểm bán."],
  ["Anh chọn tuyến gốc trước, rồi hệ thống mới hiện khách thuộc tuyến đó.", "Vui lòng chọn tuyến để xem các điểm bán thuộc tuyến."],
  ["Anh chọn tuyến trước để xem khách cần GPS.", "Vui lòng chọn tuyến để xem các điểm bán cần bổ sung vị trí."],
  ["Đang lấy định vị, anh chờ và cấp quyền GPS...", "Đang lấy vị trí. Vui lòng cấp quyền định vị cho trình duyệt."],
  ["Bấm Lưu khách để ghi vào tuyến.", "Bấm Lưu điểm bán để hoàn tất."],
  ["Không lấy được định vị, kiểm tra quyền GPS của trình duyệt", "Không lấy được vị trí. Vui lòng kiểm tra quyền định vị của trình duyệt."],
  ["Không thêm được khách tuyến", "Không thêm được điểm bán"],
  ["Không sửa được khách tuyến", "Không cập nhật được điểm bán"],
  ["Không xóa được khách tuyến", "Không xóa được điểm bán"],
  ["Không lưu được khách tuyến", "Không lưu được điểm bán"],
  ["Không mở được phiên MCP", "Không mở được phiên đi tuyến"],
  ["Mở phiên MCP", "Mở phiên đi tuyến"],
  ["Tuyến gốc", "Tuyến bán hàng"],
  ["Quản lý master tuyến: tạo, sửa, xóa dứt điểm, quản lý khách rồi mở phiên theo ngày.", "Quản lý tuyến bán hàng, điểm bán trong tuyến và mở phiên đi thị trường theo ngày."],
  ["Khách tuyến", "Điểm bán"],
  ["Chuẩn bị phiên", "Sẵn sàng đi tuyến"],
  ["Tuyến chưa có khách", "Tuyến chưa có điểm bán"],
  ["Bấm Thêm khách vào tuyến để tạo khách gốc.", "Bấm Thêm điểm bán vào tuyến để bắt đầu."],
  ["Mở phiên hôm nay", "Bắt đầu đi tuyến hôm nay"],
  ["GPS đã ổn", "Vị trí đã đầy đủ"],
  ["Tuyến đang chọn không có khách cần bổ sung GPS.", "Tuyến đang chọn không có điểm bán cần bổ sung vị trí."],
  ["setMessage(error instanceof Error ? error.message : \"Không lưu được tuyến\")", "setMessage(userFacingError(error, \"Không lưu được tuyến. Vui lòng thử lại.\"))"],
  ["setMessage(error instanceof Error ? error.message : \"Không lưu được khách tuyến\")", "setMessage(userFacingError(error, \"Không lưu được điểm bán. Vui lòng thử lại.\"))"],
  ["setMessage(error instanceof Error ? error.message : \"Không mở được phiên MCP\")", "setMessage(userFacingError(error, \"Không mở được phiên đi tuyến. Vui lòng thử lại.\"))"]
]);

replaceMany("src/app/mcp/sessions/page.tsx", [
  ["Lịch sử phiên theo ngày. Xuất file nằm trong menu, không rải nút trên hero.", "Tra cứu các phiên đi tuyến theo ngày, tuyến và trạng thái."],
  ["Phiên chạy tuyến", "Lịch sử phiên đi tuyến"],
  ["Phiên/checklist", "Danh sách điểm bán trong phiên"],
  ["BC thị trường", "Báo cáo thị trường"],
  ["Follow-up", "Việc cần theo dõi"]
]);

replaceMany("src/features/mcp/McpSessionsManagerSafe.tsx", [
  ["${session.testCount || 0} test", "${session.testCount || 0} lượt thử"],
  ["${session.reportCount || 0} BC", "${session.reportCount || 0} báo cáo"],
  ["${session.followupCount || 0} follow-up", "${session.followupCount || 0} việc theo dõi"],
  ["Phiên đã có lượt ghé, đơn, test, báo cáo hoặc follow-up nên không thể xóa. Hãy hủy phiên thay vì xóa.", "Phiên đã có hoạt động nên không thể xóa. Hãy hủy phiên để giữ lại lịch sử."],
  ["Backend chưa được cấu hình SUPABASE_SERVICE_ROLE_KEY.", "Hệ thống tạm thời chưa sẵn sàng. Vui lòng liên hệ quản trị."],
  ["Database không áp dụng thao tác xóa. Phiên vẫn được giữ nguyên.", "Không thể xóa phiên. Dữ liệu vẫn được giữ nguyên."],
  ["return raw;", "return fallback;"],
  ["Dữ liệu AI", "Dữ liệu mở rộng"],
  ["JSON cho Gemini/ADK", "Dữ liệu JSON"],
  ["JSON BC tạm tính", "Dữ liệu JSON tạm tính"],
  ["Dữ liệu máy đọc có cấu trúc", "Dữ liệu có cấu trúc để phân tích"],
  ["Văn bản để dán vào AI hoặc lưu kỹ thuật", "Bản văn bản để đọc hoặc phân tích"],
  ["Đã rebuild BC phiên", "Đã tạo lại báo cáo phiên"],
  ["Không rebuild được BC phiên", "Không tạo lại được báo cáo phiên"],
  ["<small>TT</small>", "<small>Trạng thái</small>"],
  ["Nhánh trong phiên:", "Kết quả phiên:"],
  ["Xem BC phiên", "Xem báo cáo phiên"],
  ["Đang rebuild...", "Đang tạo lại..."],
  ["Rebuild BC", "Tạo lại báo cáo"],
  ["Đã khóa checklist và xóa phiên", "Phiên đã chốt, chỉ có thể xem và xuất báo cáo"],
  ["Mở checklist", "Mở phiên"],
  ["Khách snapshot chưa ghé chỉ là kế hoạch và sẽ được xóa cùng phiên. Database sẽ chặn nếu đã có lượt ghé, đơn, test, báo cáo hoặc follow-up.", "Danh sách điểm bán chưa phát sinh hoạt động sẽ được xóa cùng phiên. Phiên đã có lượt ghé, đơn hàng, thử sản phẩm, báo cáo hoặc việc theo dõi sẽ được giữ lại."],
  ["Nhánh phát sinh", "Kết quả phát sinh"]
]);

replaceMany("src/features/market-reports/MarketReportsPage.tsx", [
  ["Snapshot chưa có nhận định.", "Báo cáo chưa có nhận định."],
  ["Theo dõi phiên sau", "Theo dõi trong phiên tiếp theo"],
  ["Theo snapshot đã chốt", "Theo các phiên đã chốt"],
  ["Đọc từ health đã lưu", "Theo mức đánh giá đã lưu"],
  ["Đủ khách", "Đủ chi tiết"],
  ["customer_details hoàn chỉnh", "Đủ thông tin điểm bán"],
  ["Có BC phiên", "Có báo cáo phiên"]
]);

replaceMany("src/features/market-reports/MarketReportsClientPage.tsx", [
  ['import { AppShell } from "@/ui/shell/AppShell";', 'import { AppShell } from "@/ui/shell/AppShell";\nimport { userFacingError } from "@/lib/ui/user-facing-error";'],
  ['{ id: "tests", label: "Test" }', '{ id: "tests", label: "Thử sản phẩm" }'],
  ['{ id: "followups", label: "Follow-up" }', '{ id: "followups", label: "Việc theo dõi" }'],
  ['{ id: "ai", label: "AI Summary" }', '{ id: "ai", label: "Phân tích AI" }'],
  ["Dữ liệu AI", "Dữ liệu mở rộng"],
  ["JSON cho Gemini/ADK", "Dữ liệu JSON"],
  ["Dữ liệu máy đọc có cấu trúc", "Dữ liệu có cấu trúc để phân tích"],
  ["Markdown", "Bản văn bản"],
  ["Văn bản để dán vào AI hoặc lưu kỹ thuật", "Bản văn bản để đọc hoặc phân tích"],
  ["Đánh giá snapshot", "Đánh giá phiên"],
  ["<strong>{report.health} · {report.score}/100</strong>", "<strong>{statusLabel(report.status)} · {report.score}/100</strong>"],
  ["<Metric label=\"Đơn/Test\"", "<Metric label=\"Đơn / thử sản phẩm\""],
  ["<div className=\"metric-row\"><span>Schema</span><strong>{report.schemaVersion || \"-\"}</strong></div>", "<div className=\"metric-row\"><span>Nhân viên phụ trách</span><strong>{report.sales || \"-\"}</strong></div>"],
  ["<div className=\"metric-row\"><span>Nguồn snapshot</span><strong>{report.snapshotSource || \"-\"}</strong></div>", "<div className=\"metric-row\"><span>Thời điểm chốt</span><strong>{report.snapshotAt || \"-\"}</strong></div>"],
  ["Sản phẩm test", "Sản phẩm được thử"],
  ["Phiên này chưa có test sản phẩm.", "Phiên này chưa có kết quả thử sản phẩm."],
  ["Follow-up", "Việc theo dõi"],
  ["follow-up", "việc theo dõi"],
  ["Snapshot chưa có customer_details. Hãy rebuild BC phiên.", "Báo cáo chưa có đủ chi tiết điểm bán. Vui lòng tạo lại báo cáo phiên."],
  ["Kết quả AI đã lưu{state.source ? ` · ${state.source}` : \"\"}", "Kết quả phân tích đã lưu"],
  ["Agent chưa trả tóm tắt.", "Chưa có nội dung tóm tắt."],
  ["meta={item.status || \"unknown\"}", "meta={item.status || \"Chưa phân loại\"}"],
  ["meta={item.priority || \"medium\"}", "meta={item.priority || \"Ưu tiên vừa\"}"],
  ["${item.confidence || \"medium\"}", "${item.confidence || \"Mức vừa\"}"],
  ["AI Prompt Context đã lưu trong snapshot", "Dữ liệu báo cáo đã sẵn sàng để phân tích"],
  ["Đã có kết quả AI", "Đã có kết quả phân tích"],
  ["Agent đã sẵn sàng", "Sẵn sàng phân tích"],
  ["Snapshot chưa có nhận định.", "Báo cáo chưa có nhận định."],
  ["Agent đang phân tích...", "Đang phân tích..."],
  ["Phân tích bằng ADK Agent", "Phân tích báo cáo"],
  [">JSON cho AI<", ">Xuất dữ liệu<"],
  [">Markdown<", ">Xuất văn bản<"],
  ["payload.error || result.summary || \"Agent chưa phân tích được BC phiên.\"", "userFacingError(payload.error || result.summary, \"Chưa thể phân tích báo cáo. Vui lòng thử lại.\")"],
  ["cause instanceof Error ? cause.message : \"Không gọi được MCP Report Agent.\"", "userFacingError(cause, \"Chưa thể phân tích báo cáo. Vui lòng thử lại.\")"],
  ["BC phiên MCP", "Báo cáo phiên"],
  ["title=\"BC phiên\"", "title=\"Báo cáo phiên\""],
  ["Snapshot hoàn chỉnh cho quản lý: xem nhanh, xuất PDF/Excel/Word và dùng AI khi cần.", "Tổng hợp kết quả đi tuyến để quản lý xem nhanh, xuất báo cáo và phân tích khi cần."],
  ["{ label: \"Nguồn\", value: \"Phiên MCP\" }, { label: \"Schema\", value: \"Snapshot v2\" }, { label: \"Nhóm\", value: \"Theo phiên\" }", "{ label: \"Phạm vi\", value: \"Theo phiên đi tuyến\" }, { label: \"Tình trạng\", value: \"Đã chốt\" }, { label: \"Sắp xếp\", value: \"Mới nhất trước\" }"],
  ["<span>Snapshot v2</span><span>Đủ khách</span><span>PDF · Excel · Word</span><span>AI lưu kết quả</span>", "<span>Báo cáo đã chốt</span><span>Chi tiết điểm bán</span><span>PDF · Excel · Word</span><span>Lưu kết quả phân tích</span>"],
  ["BC phiên đã chốt", "Báo cáo phiên đã chốt"],
  ["Chưa có BC phiên.", "Chưa có báo cáo phiên."]
]);

replaceMany("src/features/market-checks/MarketChecksClientPage.tsx", [
  ['import { AppShell } from "@/ui/shell/AppShell";', 'import { AppShell } from "@/ui/shell/AppShell";\nimport { userFacingError } from "@/lib/ui/user-facing-error";'],
  ["Gom theo sessionId", "Theo từng phiên đi tuyến"],
  ["Dòng test", "Kết quả thử"],
  ["Từ kết quả test", "Từ kết quả thử sản phẩm"],
  ["Nhánh test trong phiên MCP", "Kết quả thử sản phẩm"],
  ["khách có test", "điểm bán có thử sản phẩm"],
  ["`routeId: ${group.routeId || \"-\"}`", "`Tuyến: ${group.routeName}`"],
  ["`sessionId: ${group.sessionId}`", "`${sessionStatusLabel(group.status)}`"],
  ["Xem nhánh", "Xem kết quả"],
  [">Nhập<", ">Cập nhật<"],
  ["throw new Error(json.error || `save_failed_${response.status}`);", "throw new Error(json.error || `request_failed_${response.status}`);"],
  ["setError(err instanceof Error ? err.message : \"save_failed\")", "setError(userFacingError(err, \"Không lưu được kết quả. Vui lòng thử lại.\"))"],
  ["<small>{check.sessionCustomerId || \"Dữ liệu từ phiên MCP\"}</small>", "<small>{check.routeName} · {check.sessionDate || check.date}</small>"],
  ["<div className=\"metric-row\"><span>Session</span><strong>{check.sessionId || \"-\"}</strong></div>", "<div className=\"metric-row\"><span>Phiên đi tuyến</span><strong>{check.routeName}</strong></div>"],
  ["Nhánh test ·", "Kết quả thử ·"],
  ["\"Nhánh test\"", "\"Kết quả thử sản phẩm\""],
  ["`${group.sessionDate} · sessionId: ${group.sessionId}`", "`${group.sessionDate} · ${sessionStatusLabel(group.status)}`"],
  ["Mở checklist phiên", "Mở phiên đi tuyến"],
  ["Khách có test", "Điểm bán có thử"],
  ["MCP / Admin phụ", "MCP"],
  ["title=\"Tổng hợp test theo phiên\"", "title=\"Kết quả thử sản phẩm\""],
  ["Màn phụ để rà soát test. Test vẫn được ghi từ /visits → khách → Ghi test, gom theo routeId + sessionDate + sessionId.", "Tổng hợp kết quả thử sản phẩm theo từng phiên đi tuyến và điểm bán."],
  ["{ label: \"Nguồn\", value: \"Phiên MCP\" }, { label: \"Nhóm\", value: \"routeId + ngày + sessionId\" }, { label: \"Màn\", value: \"Admin phụ\" }", "{ label: \"Phạm vi\", value: \"Theo phiên đi tuyến\" }, { label: \"Sắp xếp\", value: \"Mới nhất trước\" }, { label: \"Cần xử lý\", value: String(needAction) }"],
  ["Session setup", "Theo phiên đi tuyến"],
  ["Test nằm trong phiên MCP", "Kết quả thử sản phẩm theo phiên"],
  ["Không còn dàn flat từng dòng như module riêng. Danh sách dưới đây là từng phiên có nhánh test.", "Mỗi phiên hiển thị các điểm bán, sản phẩm đã thử và kết quả cần cập nhật."],
  ["Vào từng phiên để xem các khách/sản phẩm test và nhập kết quả khi cần.", "Mở từng phiên để xem điểm bán, sản phẩm đã thử và cập nhật kết quả." ]
]);

write("src/features/mcp-settings/McpReportSettingsPageInternal.tsx", `"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AppShell } from "@/ui/shell/AppShell";
import { PageHeader } from "@/ui/layout/PageHeader";
import { userFacingError } from "@/lib/ui/user-facing-error";

const API = "/api/backend/mcp-report-settings";
type Item = { id: string; label: string; value: string; category: string; brandName: string; status: string; sortOrder: number };
type Group = { id: string; key?: string; title: string; description: string; items: Item[] };
type Draft = { label: string; value: string; category: string; brandName: string; sortOrder: string };
const emptyDraft: Draft = { label: "", value: "", category: "", brandName: "", sortOrder: "0" };

async function json(path: string, init?: RequestInit) {
  const res = await fetch(path, { cache: "no-store", ...init, headers: { Accept: "application/json", "Content-Type": "application/json", ...(init?.headers || {}) } });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || payload.message || "request_failed");
  return payload;
}
function norm(v: string) { return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d"); }
function kind(group?: Group) { const t = norm(`${group?.key || ""} ${group?.title || ""}`); if (t.includes("doi thu") || t.includes("competitor")) return "competitor"; if (t.includes("field")) return "field"; return "product"; }
function groupCategory(group?: Group) { const title = group?.title || ""; return title.includes("·") ? title.split("·").pop()?.trim() || "" : title.includes("-") ? title.split("-").pop()?.trim() || "" : ""; }
function copyHint(k: string) {
  if (k === "competitor") return { title: "Thêm đối thủ", label: "Tên đối thủ", labelPh: "Nhập tên đối thủ hoặc nguồn hàng cạnh tranh", value: "Ghi chú gợi ý", valuePh: "Ví dụ: giá thấp, chiết khấu cao, phủ kệ tốt" };
  if (k === "field") return { title: "Thêm ghi chú nhanh", label: "Nội dung lựa chọn", labelPh: "Ví dụ: cần báo giá, thiếu hàng, muốn thử sản phẩm", value: "Gợi ý cho nhân viên", valuePh: "Nội dung hiển thị khi ghi nhận thị trường" };
  return { title: "Nhóm sản phẩm đang dùng", label: "Tên thương hiệu hoặc sản phẩm", labelPh: "Nhập thương hiệu hoặc sản phẩm", value: "Ghi chú", valuePh: "Thông tin bổ sung khi cần" };
}

export function McpReportSettingsPageInternal({ activeHref = "/mcp-setting" }: { activeHref?: string }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editId, setEditId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, start] = useTransition();
  const group = useMemo(() => groups.find((g) => g.id === groupId) || groups[0], [groups, groupId]);
  const items = group?.items || [];
  const k = kind(group);
  const hint = copyHint(k);

  async function load() { setLoading(true); setMsg(null); try { const payload = await json(`${API}?groupType=market_report&includeInactive=1`); const next = (payload.data?.groups || []) as Group[]; setGroups(next); setGroupId((cur) => cur || next[0]?.id || ""); } catch (e) { setMsg(userFacingError(e, "Không tải được cài đặt báo cáo.")); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  function reset() { setDraft(emptyDraft); setEditId(""); }
  function edit(item: Item) { setEditId(item.id); setDraft({ label: item.label, value: item.value, category: item.category, brandName: item.brandName, sortOrder: String(item.sortOrder || 0) }); }
  function save() { if (!group) return; const cat = draft.category || (k === "product" ? groupCategory(group) : ""); start(async () => { try { await json(API, { method: editId ? "PATCH" : "POST", body: JSON.stringify({ groupId: group.id, itemId: editId || undefined, label: draft.label, value: draft.value || draft.label, category: cat, brandName: k === "product" ? draft.brandName : "", sortOrder: Number(draft.sortOrder || 0) }) }); setMsg(editId ? "Đã cập nhật lựa chọn." : "Đã thêm lựa chọn mới."); reset(); await load(); } catch (e) { setMsg(userFacingError(e, "Không lưu được lựa chọn.")); } }); }
  function toggle(item: Item) { start(async () => { try { await json(API, { method: "PATCH", body: JSON.stringify({ itemId: item.id, status: item.status === "active" ? "inactive" : "active" }) }); await load(); } catch (e) { setMsg(userFacingError(e, "Không thay đổi được trạng thái.")); } }); }

  return <AppShell activeHref={activeHref}>
    <PageHeader eyebrow="Cài đặt MCP" title="Lựa chọn nhanh cho báo cáo thị trường" subtitle="Quản lý đối thủ, ghi chú nhanh và nhóm sản phẩm để nhân viên ghi nhận thống nhất khi đi thị trường." />
    <section className="mcp-gate-banner"><strong>Cách sử dụng</strong><span>Các lựa chọn đang bật sẽ xuất hiện trong biểu mẫu ghi nhận thị trường. Có thể tắt mục ít dùng mà không làm mất dữ liệu cũ.</span></section>
    {msg ? <p className="page-subtitle order-message">{msg}</p> : null}
    <div className="mcp-status-chips">{groups.map((g) => <button key={g.id} type="button" className={group?.id === g.id ? "active" : ""} onClick={() => { setGroupId(g.id); reset(); }}>{g.title} <b>{g.items.filter((i) => i.status === "active").length}</b></button>)}</div>
    <section className="card" style={{ marginBottom: 12 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}><div><strong>{hint.title}</strong><p className="page-subtitle" style={{ margin: "4px 0 0" }}>{group?.title || "Đang tải"} · {items.filter((i) => i.status === "active").length}/{items.length} đang dùng</p></div><span className="pill">{editId ? "Đang sửa" : "Thêm mới"}</span></div><div className="grid" style={{ gap: 10 }}><label className="form-field"><small>{hint.label}</small><input value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} placeholder={hint.labelPh} /></label><label className="form-field"><small>{hint.value}</small><input value={draft.value} onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))} placeholder={hint.valuePh} /></label>{k === "product" ? <label className="form-field"><small>Thương hiệu hoặc nguồn hàng</small><input value={draft.brandName} onChange={(e) => setDraft((d) => ({ ...d, brandName: e.target.value }))} placeholder="Nhập khi cần phân biệt nguồn hàng" /></label> : null}<label className="form-field"><small>Thứ tự hiển thị</small><input inputMode="numeric" value={draft.sortOrder} onChange={(e) => setDraft((d) => ({ ...d, sortOrder: e.target.value }))} /></label></div><div className="sheet-action-grid" style={{ marginTop: 12 }}><button className="button primary" type="button" onClick={save} disabled={pending || loading || !group || !draft.label.trim()}>{pending ? "Đang lưu..." : editId ? "Cập nhật lựa chọn" : "+ Thêm lựa chọn"}</button>{editId ? <button className="button" type="button" onClick={reset}>Hủy sửa</button> : null}<button className="button" type="button" onClick={() => void load()} disabled={pending || loading}>Làm mới</button></div></section>
    <section className="mcp-line-list">{loading ? <div className="empty-inline"><strong>Đang tải cài đặt...</strong></div> : null}{!loading && items.length === 0 ? <div className="empty-inline"><strong>Chưa có lựa chọn</strong><p className="page-subtitle">Thêm lựa chọn đầu tiên cho nhóm này.</p></div> : null}{items.map((item) => <article className="card" key={item.id} style={{ padding: 12 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><div><strong>{item.label}</strong><p className="page-subtitle" style={{ margin: "4px 0 0" }}>{item.value || "Không có ghi chú"}{item.brandName ? ` · ${item.brandName}` : ""} · thứ tự {item.sortOrder}</p></div><span className="pill">{item.status === "active" ? "Đang sử dụng" : "Đã tắt"}</span></div><div className="sheet-action-grid" style={{ marginTop: 10 }}><button className="button" type="button" onClick={() => edit(item)}>Sửa</button><button className={item.status === "active" ? "button danger" : "button primary"} type="button" onClick={() => toggle(item)}>{item.status === "active" ? "Tắt" : "Bật"}</button></div></article>)}</section>
  </AppShell>;
}
`);

replaceMany("src/features/mcp/McpMarketReportFields.tsx", [
  ["const USED_PRODUCT_GROUPS = [\n  { title: \"Trà\", items: [\"Ona\", \"Lộc Phát\", \"Novia\", \"Phúc Long\", \"Hoàng Gia\"] },\n  { title: \"Siro\", items: [\"Mama\", \"Golden Farm\", \"Vina\", \"Torani\"] },\n  { title: \"Sinh tố\", items: [\"Berrino\", \"Gold / Golden Farm\", \"Vina\"] },\n  { title: \"Sữa\", items: [\"Frima\", \"B One\", \"HP\", \"Kievit\", \"Indo Mafac\"] },\n  { title: \"Topping\", items: [\"Bibi\", \"Douxian\", \"Ok\", \"Sea\"] }\n];\n", ""],
  ["function slug(value: string) {\n  return norm(value).replace(/[^a-z0-9]+/g, \"_\").replace(/^_+|_+$/g, \"\") || \"item\";\n}\n\n", ""],
  ["function usedProductSelection(category: string, label: string): ReportSettingSelection {\n  const id = `used_${slug(category)}_${slug(label)}`;\n  return { id, key: id, label, value: label, groupKey: `used_products_${slug(category)}`, groupTitle: category, category, brandName: label, productId: \"\" };\n}\n\n", ""],
  ["Next action", "Việc tiếp theo"],
  ["Không tải được MCP Setting", "Không tải được cài đặt báo cáo"],
  ["${fieldCount} ô ghi thêm", "${fieldCount} nội dung bổ sung"],
  ["const competitorGroups = useMemo(() => groups.filter((group) => !isFieldGroup(group) && !isLegacyUsedProductGroup(group) && isCompetitorGroup(group) && group.items.length > 0), [groups]);", "const competitorGroups = useMemo(() => groups.filter((group) => !isFieldGroup(group) && !isLegacyUsedProductGroup(group) && isCompetitorGroup(group) && group.items.length > 0), [groups]);\n  const usedProductGroups = useMemo(() => groups.filter((group) => isLegacyUsedProductGroup(group) && group.items.length > 0), [groups]);"],
  ["<div className=\"report-quick-group\"><strong>Thương hiệu/sản phẩm khách đang dùng</strong><div className=\"report-used-product-groups\">{USED_PRODUCT_GROUPS.map((group) => <div className=\"report-used-product-group\" key={group.title}><span>{group.title}</span><div className=\"report-chip-grid\">{group.items.map((label) => { const item = usedProductSelection(group.title, label); return <ReportChip active={selectedIds.has(item.id)} disabled={saving} key={item.id} label={label} onClick={() => applySelection(item)} />; })}</div></div>)}</div></div>", "<div className=\"report-quick-group\"><strong>Thương hiệu hoặc sản phẩm khách đang dùng</strong>{usedProductGroups.length ? <div className=\"report-used-product-groups\">{usedProductGroups.map((group) => <div className=\"report-used-product-group\" key={group.id}><span>{group.title}</span><div className=\"report-chip-grid\">{group.items.map((item) => { const selection = selectionFrom(group, item); return <ReportChip active={selectedIds.has(selection.id)} disabled={saving} key={selection.id} label={selection.label} onClick={() => applySelection(selection)} />; })}</div></div>)}</div> : <p className=\"page-subtitle\">Chưa có danh mục gợi ý. Có thể nhập thông tin ở phần ghi thêm quan sát.</p>}</div>"],
  ["BC phiên sẽ tự gom", "báo cáo phiên sẽ tự tổng hợp"],
  ["Ô trống không lưu. Dữ liệu này là đầu vào cho BC phiên, không tạo BC riêng theo từng khách.", "Chỉ nội dung đã nhập mới được lưu và tổng hợp vào báo cáo phiên."]
]);

replaceMany("src/features/mcp/McpSessionCompactViewFinal2.tsx", [
  ['import { BottomSheet } from "@/ui/overlay/BottomSheet";', 'import { BottomSheet } from "@/ui/overlay/BottomSheet";\nimport { userFacingError } from "@/lib/ui/user-facing-error";'],
  ["const TEST_PRODUCT_CHIPS = [\"Siro Carisa\", \"Sinh tố Berrino\", \"Trà Cozy\", \"Trà GTP\", \"Topping Bibi\", \"Topping Ok\", \"Bột sữa Frima\", \"Bột sữa HP\"];\n", ""],
  ["Đã test", "Đã thử"],
  ["Test lại", "Thử lại"],
  ["Mang mẫu test", "Mang mẫu thử"],
  ["source === \"planned\" ? \"Tuyến gốc\" : source === \"added\" ? \"Phát sinh\" : \"Đồng bộ\"", "source === \"planned\" ? \"Có sẵn trong tuyến\" : source === \"added\" ? \"Bổ sung trong phiên\" : \"Có sẵn trong tuyến\""],
  ["Ghi test sản phẩm", "Ghi kết quả thử sản phẩm"],
  ["Tạo việc follow-up", "Tạo việc cần theo dõi"],
  ["Lưu test", "Lưu kết quả thử"],
  ["Lưu follow-up", "Lưu việc theo dõi"],
  [">Ghi test<", ">Thử sản phẩm<"],
  [">Follow-up<", ">Theo dõi<"],
  ["Chưa brand", "Chưa có thương hiệu"],
  ["Tick vị / quy cách", "Chọn vị / quy cách"],
  ["Chưa có item trong đơn. Bấm + Chọn sản phẩm để thêm nhiều mã một lần.", "Chưa có sản phẩm trong đơn. Bấm + Chọn sản phẩm để thêm nhiều mã một lần."],
  ["<strong>Test nhanh</strong><small>Chọn sản phẩm, trạng thái test và ghi chú thực tế.</small>", "<strong>Kết quả thử sản phẩm</strong><small>Nhập sản phẩm, kết quả và phản hồi thực tế của điểm bán.</small>"],
  ["<div className=\"report-quick-group\"><strong>Sản phẩm thường test</strong><div className=\"report-chip-grid\">{TEST_PRODUCT_CHIPS.map((label) => <QuickChip key={label} active={draft.productName === label} disabled={saving} onClick={() => onChange(\"productName\", draft.productName === label ? \"\" : label)}>{label}</QuickChip>)}</div></div>", ""],
  ["Sản phẩm test khác", "Sản phẩm được thử"],
  ["Nhập nhanh nếu chưa có chip", "Nhập tên sản phẩm"],
  ["Kết quả test", "Kết quả"],
  ["Ghi chú test", "Ghi chú"],
  ["<strong>Follow-up</strong><small>Lưu đủ việc, ngày hẹn, người phụ trách, ưu tiên và loại công việc.</small>", "<strong>Việc cần theo dõi</strong><small>Ghi rõ nội dung, ngày hẹn, người phụ trách và mức ưu tiên.</small>"],
  ["Loại follow-up", "Loại công việc"],
  ["Sau test", "Sau khi thử sản phẩm"],
  ["VD: Hẹn chốt đơn siro", "Nhập nội dung cần theo dõi"],
  ["Tick lý do chính", "Chọn lý do chính"],
  ["Hành động checklist", "Thao tác tại điểm bán"],
  ["Cần chọn hoặc nhập sản phẩm test", "Cần nhập sản phẩm được thử"],
  ["Test nhanh từ checklist", "Kết quả thử sản phẩm trong phiên"],
  ["Cần tick hoặc nhập ít nhất 1 nội dung quan sát", "Cần chọn hoặc nhập ít nhất một nội dung ghi nhận"],
  ["Follow-up khách", "Theo dõi điểm bán"],
  ["setMessage(error instanceof Error ? error.message : \"Không lưu được hành động MCP\")", "setMessage(userFacingError(error, \"Không lưu được thông tin. Vui lòng thử lại.\"))"],
  ["error: error instanceof Error ? error.message : \"Không tìm được sản phẩm\"", "error: userFacingError(error, \"Không tìm được sản phẩm. Vui lòng thử lại.\")"],
  ["error: error instanceof Error ? error.message : \"Không tải được quy cách sản phẩm\"", "error: userFacingError(error, \"Không tải được quy cách sản phẩm. Vui lòng thử lại.\")"],
  ["Checklist phiên", "Phiên đi tuyến"],
  ["Tuyến gốc:", "Tuyến:"],
  ["Sale:", "Phụ trách:"],
  ["follow-up", "việc theo dõi"],
  ["Có follow-up", "Có việc theo dõi"]
]);

replaceMany("src/features/mcp/McpSessionReadonlyView.tsx", [
  ["Có test", "Có thử sản phẩm"],
  ["follow-up", "việc theo dõi"],
  ["Checklist phiên", "Phiên đi tuyến"],
  ["Tuyến gốc:", "Tuyến:"],
  ["Sale:", "Phụ trách:"],
  ["Checklist phiên chỉ xem", "Phiên chỉ xem"],
  ["Có follow-up", "Có việc theo dõi"],
  ["khách trong checklist", "điểm bán"]
]);

replaceMany("src/features/accounts/OutletsClientPage.tsx", [
  ["Tier ", "Hạng "],
  ["Các thao tác tạo đơn, ghi quan sát hoặc follow-up nên thực hiện trong phiên MCP để giữ đúng ngữ cảnh tuyến/ngày.", "Đơn hàng, ghi nhận thị trường và việc cần theo dõi nên được thực hiện trong phiên đi tuyến để lưu đúng ngày và tuyến."],
  ["quan sát MCP", "ghi nhận thị trường"],
  ["A/B/C", "A, B hoặc C"],
  ["Đang chăm sóc + Cần ghé lại", "Đang chăm sóc hoặc cần ghé lại"],
  ["Tệp điểm bán", "Danh sách điểm bán"],
  ["cập nhật quan sát trong phiên MCP", "cập nhật tình hình trong phiên đi tuyến"],
  ["Tier A", "Hạng A"],
  ["Ưu tiên ghé lại đúng tuyến và ghi nhận trong phiên MCP", "Ưu tiên ghé lại đúng tuyến và cập nhật kết quả"]
]);

replaceMany("src/features/orders/OrdersClientPage.tsx", [
  ["Quét nhanh đơn theo nguồn, điểm bán, tuyến, giá trị và trạng thái.", "Theo dõi đơn hàng theo điểm bán, tuyến, giá trị và tình trạng xử lý."],
  ["SKU", "Mã hàng"],
  ["Sale", "Nhân viên phụ trách"],
  ["Xuất file", "Xuất đơn hàng"]
]);

replaceMany("src/features/actions/ActionsClientPage.tsx", [
  ["Quan sát / test", "Ghi nhận / thử sản phẩm"],
  ["MCP-Plan", "Kế hoạch"],
  ["Đang mở", "Cần xử lý"],
  ["Nguồn phát sinh", "Phân loại công việc"]
]);

replaceMany("src/features/exports/ExportLinks.tsx", [
  ["Khách/tuyến + GPS", "Điểm bán và vị trí"],
  ["Danh sách khách tuyến, tọa độ, Google Maps", "Danh sách điểm bán, vị trí và liên kết bản đồ"],
  ["Phiên/checklist", "Phiên đi tuyến"],
  ["Snapshot khách trong phiên, trạng thái ghé", "Danh sách điểm bán và trạng thái ghé trong phiên"],
  ["Đơn hàng + item", "Đơn hàng và sản phẩm"],
  ["Header đơn và dòng sản phẩm", "Thông tin đơn hàng và chi tiết sản phẩm"],
  ["BC thị trường", "Báo cáo thị trường"],
  ["brand đang dùng", "thương hiệu đang dùng"],
  ["Follow-up", "Việc cần theo dõi"],
  ["owner", "người phụ trách"],
  ["Test", "Kết quả thử sản phẩm"],
  ["Hồ sơ test", "Thông tin thử sản phẩm"],
  ["Tải Excel nền hoặc mở bản in PDF vận hành.", "Tải dữ liệu Excel hoặc báo cáo PDF để lưu trữ và chia sẻ."]
]);

const packageJson = JSON.parse(read("package.json"));
packageJson.scripts = {
  ...packageJson.scripts,
  "audit:copy": "node scripts/audit-user-facing-copy.mjs"
};
write("package.json", `${JSON.stringify(packageJson, null, 2)}\n`);

write("scripts/audit-user-facing-copy.mjs", `import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "src");
const forbidden = [
  "Frontend sạch trước",
  "Backend/VPS",
  "API thật",
  "Dữ liệu mẫu",
  "master data",
  "RPC hard delete",
  "Xóa thật khỏi DB",
  "Admin phụ",
  "Session setup",
  "routeId + ngày + sessionId",
  "sessionId:",
  "Snapshot v2",
  "AI Prompt Context",
  "ADK Agent",
  "rebuild BC",
  "Đang rebuild",
  "MCP Setting",
  "Cai dat app",
  "Tai app",
  "Cap nhat ban moi"
];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

const failures = [];
for (const filename of walk(root)) {
  const content = fs.readFileSync(filename, "utf8");
  for (const phrase of forbidden) {
    if (content.includes(phrase)) failures.push(`${path.relative(process.cwd(), filename)}: ${phrase}`);
  }
}

if (failures.length) {
  console.error("Phát hiện nội dung kỹ thuật hoặc nội dung mẫu còn xuất hiện trong giao diện:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("User-facing copy audit passed.");
`);

console.log("Applied user-facing copy cleanup.");
