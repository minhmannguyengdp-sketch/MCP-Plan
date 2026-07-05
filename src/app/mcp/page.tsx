import Link from "next/link";
import { createApiClient } from "@/lib/api/api-client";
import { CompactKpiStrip } from "@/ui/cards/CompactKpiStrip";
import { TodaySummaryCard } from "@/ui/cards/TodaySummaryCard";
import { FilterBar } from "@/ui/layout/FilterBar";
import { PageHeader } from "@/ui/layout/PageHeader";
import { AppShell } from "@/ui/shell/AppShell";
import { SourceBadge } from "@/ui/status/SourceBadge";
import styles from "./McpHome.module.css";

const MCP_MODULES = [
  {
    href: "/routes",
    tone: "routes",
    icon: "◎",
    title: "Tuyến gốc",
    description: "Quản lý tuyến gốc: khách tuyến, GPS và dữ liệu nền trước khi mở phiên MCP.",
    cta: "Xem tuyến gốc"
  },
  {
    href: "/routes",
    tone: "session",
    icon: "◇",
    title: "Phiên MCP hôm nay",
    description: "Mở hoặc tiếp tục phiên làm việc từ tuyến gốc đã chọn; đây không phải tuyến mới.",
    cta: "Mở phiên"
  },
  {
    href: "/mcp/sessions",
    tone: "session",
    icon: "▤",
    title: "Phiên",
    description: "Xem lại lịch sử chạy tuyến theo ngày, tuần hoặc tháng.",
    cta: "Xem lịch sử"
  },
  {
    href: "/mcp-setting",
    tone: "settings",
    icon: "⚙",
    title: "MCP Setting",
    description: "Quản lý mẫu báo cáo global dùng chung, không gắn theo tuyến hay phiên cố định.",
    cta: "Cài đặt mẫu"
  }
] as const;

function renderModuleCard(item: (typeof MCP_MODULES)[number]) {
  return (
    <Link className={`${styles.card} ${styles[item.tone]}`} href={item.href} key={`${item.href}-${item.title}`} prefetch>
      <span className={styles.icon} aria-hidden="true">{item.icon}</span>
      <span className={styles.content}>
        <strong>{item.title}</strong>
        <small>{item.description}</small>
      </span>
      <span className={styles.cta}>{item.cta}</span>
    </Link>
  );
}

export default async function McpPage() {
  const api = createApiClient();
  const routesResult = await api.getRoutesData();

  const routes = routesResult.data.routes;
  const activeRoutes = routes.filter((route) => route.status === "active" || route.status === "watch").length;
  const pausedRoutes = routes.filter((route) => route.status === "paused").length;
  const plannedCustomers = routes.reduce((sum, route) => sum + Number(route.plannedCustomers || 0), 0);
  const visitedCustomers = routes.reduce((sum, route) => sum + Number(route.visitedCustomers || 0), 0);

  return (
    <AppShell activeHref="/mcp">
      <PageHeader
        eyebrow="MCP"
        title="MCP"
        subtitle="Tuyến gốc là dữ liệu nền; Phiên MCP hôm nay là phiên làm việc được mở từ tuyến gốc đã chọn."
      >
        <SourceBadge source={routesResult.source} />
      </PageHeader>

      <TodaySummaryCard
        eyebrow="Quy trình MCP"
        value="Chọn tuyến gốc trước"
        description={`${activeRoutes} tuyến gốc có thể đi · ${plannedCustomers} khách trong tuyến gốc`}
        pills={[
          { label: "tuyến gốc", value: routes.length },
          { label: "có thể đi", value: activeRoutes },
          { label: "đã ghé", value: visitedCustomers }
        ]}
      />

      <section className={styles.grid} aria-label="MCP nhanh">
        {MCP_MODULES.map(renderModuleCard)}
      </section>

      <FilterBar
        title="Tóm tắt vận hành"
        filters={[
          { label: "Tuyến gốc", value: String(routes.length) },
          { label: "Có thể đi", value: String(activeRoutes) },
          { label: "Tạm dừng", value: String(pausedRoutes) },
          { label: "Khách tuyến", value: String(plannedCustomers) }
        ]}
      />

      <CompactKpiStrip
        items={[
          { label: "Tuyến gốc", value: routes.length, hint: "Tuyến nền đang quản lý" },
          { label: "Có thể đi", value: activeRoutes, hint: "Đang chạy hoặc theo dõi" },
          { label: "Khách tuyến", value: plannedCustomers, hint: "Tổng khách trong tuyến gốc" },
          { label: "Đã ghé", value: visitedCustomers, hint: "Theo dữ liệu route hiện có" }
        ]}
      />

      <section className="dashboard-section dashboard-actions-section">
        <div className="dashboard-section-head">
          <h2>Việc nên làm</h2>
          <span>3 bước</span>
        </div>
        <div className="dashboard-action-list">
          <article className="action-card dashboard-action-card">
            <div>
              <span className="dashboard-priority priority-high">Bước 1</span>
              <h3>Chọn tuyến gốc</h3>
              <p>Xem khách tuyến và GPS trước khi mở phiên MCP hôm nay.</p>
            </div>
            <Link href="/routes" prefetch>Vào tuyến gốc</Link>
          </article>
          <article className="action-card dashboard-action-card">
            <div>
              <span className="dashboard-priority priority-medium">Bước 2</span>
              <h3>Mở phiên MCP hôm nay</h3>
              <p>Mở phiên làm việc từ tuyến gốc đã chọn để truyền đúng routeId và ngày.</p>
            </div>
            <Link href="/routes" prefetch>Mở từ tuyến gốc</Link>
          </article>
          <article className="action-card dashboard-action-card">
            <div>
              <span className="dashboard-priority priority-low">Bước 3</span>
              <h3>Xem lại phiên</h3>
              <p>Mở lịch sử phiên để xem hôm qua, tuần trước hoặc tháng trước.</p>
            </div>
            <Link href="/mcp/sessions" prefetch>Vào Phiên</Link>
          </article>
        </div>
      </section>
    </AppShell>
  );
}
