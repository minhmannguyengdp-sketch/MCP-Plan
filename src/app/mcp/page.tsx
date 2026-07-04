import Link from "next/link";
import { createApiClient } from "@/lib/api/api-client";
import { CompactKpiStrip } from "@/ui/cards/CompactKpiStrip";
import { TodaySummaryCard } from "@/ui/cards/TodaySummaryCard";
import { FilterBar } from "@/ui/layout/FilterBar";
import { PageHeader } from "@/ui/layout/PageHeader";
import { AppShell } from "@/ui/shell/AppShell";
import { SourceBadge } from "@/ui/status/SourceBadge";

const MCP_MODULES = [
  {
    href: "/routes",
    icon: "◎",
    title: "Tuyến",
    description: "Tuyến gốc, khách tuyến, GPS và chuẩn bị phiên.",
    cta: "Chọn tuyến"
  },
  {
    href: "/visits",
    icon: "◇",
    title: "MCP hôm nay",
    description: "Xử lý khách trong phiên đang đi và ghi kết quả.",
    cta: "Đi tuyến"
  },
  {
    href: "/mcp/settings",
    icon: "⚙",
    title: "Cài đặt MCP",
    description: "Luật thêm khách, trạng thái, GPS và mẫu ghi nhận.",
    cta: "Cài đặt"
  }
];

function renderModuleCard(item: (typeof MCP_MODULES)[number]) {
  return (
    <Link className="dashboard-module-card" href={item.href} key={item.href} prefetch>
      <span className="dashboard-module-icon" aria-hidden="true">{item.icon}</span>
      <div>
        <h3>{item.title}</h3>
        <p>{item.description}</p>
      </div>
      <strong>{item.cta}</strong>
    </Link>
  );
}

export default async function McpPage() {
  const api = createApiClient();
  const [routesResult, dayResult] = await Promise.all([
    api.getRoutesData(),
    api.getMcpDayData()
  ]);

  const routes = routesResult.data.routes;
  const day = dayResult.data;
  const run = day.run;
  const activeRoutes = routes.filter((route) => route.status === "active" || route.status === "watch").length;
  const pendingLines = day.lines.filter((line) => line.status === "pending").length;
  const resultCount = day.results.length;
  const followupCount = day.lines.reduce((sum, line) => sum + Number(line.followupCount || 0), 0);

  return (
    <AppShell activeHref="/mcp">
      <PageHeader
        eyebrow="MCP"
        title="MCP"
        subtitle="Trung tâm điều phối tuyến, phiên hôm nay và luật xử lý MCP."
      >
        <SourceBadge source={routesResult.source} />
      </PageHeader>

      <TodaySummaryCard
        eyebrow="Phiên đang chạy"
        value={run.routeName}
        description={`${run.date} · ${run.owner} · ${day.lines.length} khách trong phiên`}
        pills={[
          { label: "chờ xử lý", value: pendingLines },
          { label: "kết quả", value: resultCount },
          { label: "follow-up", value: followupCount }
        ]}
      />

      <section className="dashboard-module-grid" aria-label="MCP nhanh">
        {MCP_MODULES.map(renderModuleCard)}
      </section>

      <FilterBar
        title="Tóm tắt vận hành"
        filters={[
          { label: "Tuyến", value: String(routes.length) },
          { label: "Có thể đi", value: String(activeRoutes) },
          { label: "Phiên", value: run.routeName },
          { label: "Ngày", value: run.date }
        ]}
      />

      <CompactKpiStrip
        items={[
          { label: "Khách phiên", value: day.lines.length, hint: "Cần xử lý trong ngày" },
          { label: "Chờ xử lý", value: pendingLines, hint: "Chưa ghé hoặc chưa ghi nhận" },
          { label: "Kết quả", value: resultCount, hint: "Đã có kết quả" },
          { label: "Tuyến có thể đi", value: activeRoutes, hint: "Đang chạy hoặc theo dõi" }
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
              <h3>Đi tuyến hôm nay</h3>
              <p>Xử lý khách trong phiên {run.routeName}, ghi đơn, test, báo cáo và follow-up.</p>
            </div>
            <Link href="/visits" prefetch>Đi tuyến</Link>
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
