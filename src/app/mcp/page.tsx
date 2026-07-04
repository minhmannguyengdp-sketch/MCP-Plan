import Link from "next/link";
import { createApiClient } from "@/lib/api/api-client";
import { FilterBar } from "@/ui/layout/FilterBar";
import { PageHeader } from "@/ui/layout/PageHeader";
import { AppShell } from "@/ui/shell/AppShell";
import { SourceBadge } from "@/ui/status/SourceBadge";

const MCP_TABS = [
  { href: "/routes", label: "Tuyến", hint: "Tuyến gốc và khách tuyến" },
  { href: "/visits", label: "MCP hôm nay", hint: "Phiên đang đi" },
  { href: "/mcp/settings", label: "Cài đặt MCP", hint: "Luật thêm khách, GPS, trạng thái" }
];

export default async function McpPage() {
  const api = createApiClient();
  const [routesResult, dayResult] = await Promise.all([
    api.getRoutesData(),
    api.getMcpDayData()
  ]);

  const routes = routesResult.data.routes;
  const run = dayResult.data.run;
  const activeRoutes = routes.filter((route) => route.status === "active" || route.status === "watch").length;

  return (
    <AppShell activeHref="/mcp">
      <PageHeader
        eyebrow="MCP"
        title="MCP"
        subtitle="Tuyến, phiên hôm nay và cài đặt nằm chung một chỗ."
      >
        <SourceBadge source={routesResult.source} />
      </PageHeader>

      <section className="dashboard-section">
        <div className="mcp-status-chips" role="tablist" aria-label="MCP">
          {MCP_TABS.map((item) => (
            <Link className="button" href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      <FilterBar
        title="Tóm tắt"
        filters={[
          { label: "Tuyến", value: String(routes.length) },
          { label: "Có thể đi", value: String(activeRoutes) },
          { label: "Phiên", value: run.routeName },
          { label: "Ngày", value: run.date }
        ]}
      />

      <section className="card">
        <h2 className="panel-title">Luồng MCP</h2>
        <p className="page-subtitle">
          Vào Tuyến để quản lý tuyến gốc. Vào MCP hôm nay để xử lý phiên đang chạy.
        </p>
      </section>
    </AppShell>
  );
}
