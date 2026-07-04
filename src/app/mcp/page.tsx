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
    title: "Tuyến",
    description: "Chọn tuyến gốc, xem khách tuyến và GPS trước khi mở phiên.",
    cta: "Chọn tuyến"
  },
  {
    href: "/routes",
    tone: "session",
    icon: "◇",
    title: "MCP hôm nay",
    description: "Mở hoặc tiếp tục phiên từ tuyến đã chọn, không tự lấy phiên gần nhất.",
    cta: "Mở từ tuyến"
  },
  {
    href: "/mcp/settings",
    tone: "settings",
    icon: "⚙",
    title: "Cài đặt MCP",
    description: "Luật thêm khách, trạng thái, GPS và mẫu ghi nhận.",
    cta: "Cài đặt"
  }
] as const;

function renderModuleCard(item: (typeof MCP_MODULES)[number]) {
  return (
    <Link className={`${styles.card} ${styles[item.tone]}`} href={item.href} key={item.href} prefetch>
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
        subtitle="Trung tâm điều phối tuyến, phiên hôm nay và luật xử lý MCP. Bắt đầu từ tuyến để tránh mở nhầm phiên."
      >
        <SourceBadge source={routesResult.source} />
      </PageHeader>

      <TodaySummaryCard
        eyebrow="Quy trình MCP"
        value="Chọn tuyến trước"
        description={`${activeRoutes} tuyến có thể đi · ${plannedCustomers} khách trong tuyến gốc`}
        pills={[
          { label: "tuyến", value: routes.length },
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
          { label: "Tuyến", value: String(routes.length) },
          { label: "Có thể đi", value: String(activeRoutes) },
          { label: "Tạm dừng", value: String(pausedRoutes) },
          { label: "Khách tuyến", value: String(plannedCustomers) }
        ]}
      />

      <CompactKpiStrip
        items={[
          { label: "Tuyến MCP", value: routes.length, hint: "Tuyến gốc đang quản lý" },
          { label: "Có thể đi", value: activeRoutes, hint: "Đang chạy hoặc theo dõi" },
          { label: "Khách tuyến", value: plannedCustomers, hint: "Tổng khách trong tuyến" },
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
              <p>Xem tuyến, khách tuyến và GPS trước khi mở phiên.</p>
            </div>
            <Link href="/routes" prefetch>Vào Tuyến</Link>
          </article>
          <article className="action-card dashboard-action-card">
            <div>
              <span className="dashboard-priority priority-medium">Bước 2</span>
              <h3>Mở phiên hôm nay</h3>
              <p>Mở phiên từ tuyến đã chọn để hệ thống truyền đúng routeId và ngày.</p>
            </div>
            <Link href="/routes" prefetch>Chọn tuyến</Link>
          </article>
          <article className="action-card dashboard-action-card">
            <div>
              <span className="dashboard-priority priority-low">Bước 3</span>
              <h3>Chốt luật MCP</h3>
              <p>Cài luật thêm khách vào tuyến gốc, phiên hôm nay hoặc cả hai.</p>
            </div>
            <Link href="/mcp/settings" prefetch>Cài đặt</Link>
          </article>
        </div>
      </section>
    </AppShell>
  );
}
