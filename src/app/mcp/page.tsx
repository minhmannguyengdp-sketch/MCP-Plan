import Link from "next/link";
import { createApiClient } from "@/lib/api/api-client";
import { FilterBar } from "@/ui/layout/FilterBar";
import { PageHeader } from "@/ui/layout/PageHeader";
import { AppShell } from "@/ui/shell/AppShell";
import { SourceBadge } from "@/ui/status/SourceBadge";

const MCP_CARDS = [
  {
    href: "/routes",
    icon: "◎",
    title: "Tuyến",
    description: "Xem tuyến gốc, khách tuyến và chuẩn bị phiên.",
    cta: "Chọn tuyến"
  },
  {
    href: "/visits",
    icon: "◇",
    title: "MCP hôm nay",
    description: "Đi tuyến, xử lý khách trong phiên ngày.",
    cta: "Đi tuyến"
  },
  {
    href: "/mcp/settings",
    icon: "⚙",
    title: "Cài đặt MCP",
    description: "Luật thêm khách, GPS, trạng thái và mẫu ghi nhận.",
    cta: "Cài đặt"
  }
];

function renderMcpCard(item: (typeof MCP_CARDS)[number]) {
  return (
    <Link className="dashboard-module-card" href={item.href} key={item.href}>
      <span className="dashboard-module-icon" aria-hidden="true">{item.icon}</span>
      <div>
        <h3>{item.title}</h3>
        <p>{item.description}</p>
      </div>
      <strong>{item.cta}</strong>
    </Link>
  );
}

export default async function McpHomePage() {
  const api = createApiClient();
  const [routesResult, dayResult] = await Promise.all([
    api.getRoutesData(),
    api.getMcpDayData()
  ]);

  const routes = routesResult.data.routes;
  const activeRoutes = routes.filter((route) => route.status === "active" || route.status === "watch").length;
  const currentRun = dayResult.data.run;

  return (
    <AppShell activeHref="/mcp">
      <PageHeader
        eyebrow="MCP"
        title="MCP"
        subtitle="Chọn tuyến, đi tuyến hôm nay hoặc chỉnh cài đặt MCP."
      >
        <SourceBadge source={routesResult.source} />
      </PageHeader>

      <section className="dashboard-module-grid" aria-label="MCP modules">
        {MCP_CARDS.map(renderMcpCard)}
      </section>

      <FilterBar
        title="Tóm tắt MCP"
        filters={[
          { label: "Tuyến", value: String(routes.length) },
          { label: "Có thể đi", value: String(activeRoutes) },
          { label: "Phiên hiện tại", value: currentRun.routeName },
          { label: "Ngày", value: currentRun.date }
        ]}
      />

      <section className="mcp-gate-banner">
        <strong>Luồng chuẩn</strong>
        <span>Vào Tuyến để chọn tuyến gốc. Vào MCP hôm nay để xử lý phiên đang đi.</span>
      </section>
    </AppShell>
  );
}
