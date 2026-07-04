import { createApiClient } from "@/lib/api/api-client";
import type { DashboardActionDto, DashboardRouteHealthDto } from "@/lib/api/api.types";
import { CompactKpiStrip } from "@/ui/cards/CompactKpiStrip";
import { TodaySummaryCard } from "@/ui/cards/TodaySummaryCard";
import { FilterBar } from "@/ui/layout/FilterBar";
import { PageHeader } from "@/ui/layout/PageHeader";
import { AppShell } from "@/ui/shell/AppShell";
import { SourceBadge } from "@/ui/status/SourceBadge";

const MODULE_CARDS = [
  { href: "/routes", icon: "â—‡", title: "Tuyáº¿n MCP", description: "Chá»n tuyáº¿n vÃ  khÃ¡ch tuyáº¿n", cta: "Chá»n tuyáº¿n" },
  { href: "/orders", icon: "+", title: "ÄÆ¡n", description: "ÄÆ¡n hÃ ng vÃ  giao", cta: "Xem Ä‘Æ¡n" },
  { href: "/field-checks", icon: "â—Œ", title: "Test", description: "Nháº­p káº¿t quáº£ test", cta: "Nháº­p" },
  { href: "/reports", icon: "â–¡", title: "BÃ¡o cÃ¡o", description: "GiÃ¡, Ä‘á»‘i thá»§, tá»“n kho", cta: "Ghi nháº­n" }
];

function getStatusLabel(status: "good" | "watch" | "risk") {
  if (status === "good") return "á»”n";
  if (status === "watch") return "Theo dÃµi";
  return "Rá»§i ro";
}

function getPriorityLabel(priority: "high" | "medium" | "low") {
  if (priority === "high") return "Cao";
  if (priority === "medium") return "Vá»«a";
  return "Tháº¥p";
}

function getStatusClass(status: "good" | "watch" | "risk") {
  if (status === "good") return "status-good";
  if (status === "watch") return "status-watch";
  return "status-risk";
}

function renderModuleCard(item: (typeof MODULE_CARDS)[number]) {
  return (
    <a className="dashboard-module-card" href={item.href} key={item.href}>
      <span className="dashboard-module-icon" aria-hidden="true">{item.icon}</span>
      <div>
        <h3>{item.title}</h3>
        <p>{item.description}</p>
      </div>
      <strong>{item.cta}</strong>
    </a>
  );
}

function renderRouteCard(route: DashboardRouteHealthDto) {
  const visitRate = route.planned > 0 ? Math.round((route.visited / route.planned) * 100) : 0;

  return (
    <article className="dashboard-route-card" key={route.routeName}>
      <div className="dashboard-route-head">
        <div>
          <h3>{route.routeName}</h3>
          <small>{route.area}</small>
        </div>
        <span className={`dashboard-status ${getStatusClass(route.status)}`}>{getStatusLabel(route.status)}</span>
      </div>
      <div className="dashboard-route-progress" aria-label={`Tiáº¿n Ä‘á»™ ghÃ© ${visitRate}%`}>
        <span style={{ width: `${Math.min(visitRate, 100)}%` }} />
      </div>
      <div className="dashboard-route-metrics">
        <span>
          <b>{route.visited}/{route.planned}</b>
          <small>ÄÃ£ ghÃ©</small>
        </span>
        <span>
          <b>{visitRate}%</b>
          <small>Tiáº¿n Ä‘á»™</small>
        </span>
        <span>
          <b>{route.orders}</b>
          <small>ÄÆ¡n</small>
        </span>
      </div>
    </article>
  );
}

function renderAction(action: DashboardActionDto) {
  return (
    <article className="action-card dashboard-action-card" key={action.title}>
      <div>
        <span className={`dashboard-priority priority-${action.priority}`}>Æ¯u tiÃªn {getPriorityLabel(action.priority)}</span>
        <h3>{action.title}</h3>
        <p>{action.description}</p>
      </div>
      <strong>{action.owner}</strong>
    </article>
  );
}

export async function DashboardPage() {
  const api = createApiClient();
  const dashboardResult = await api.getDashboardOverview();
  const dashboard = dashboardResult.data;
  const primaryKpi = dashboard.kpis[0];
  const totalRoutes = dashboard.routeHealth.length;
  const riskRoutes = dashboard.routeHealth.filter((route) => route.status === "risk").length;
  const watchRoutes = dashboard.routeHealth.filter((route) => route.status === "watch").length;
  const totalOrders = dashboard.routeHealth.reduce((sum, route) => sum + route.orders, 0);

  return (
    <AppShell activeHref="/">
      <PageHeader
        eyebrow="Dashboard"
        title="HÃ´m nay"
        subtitle="VÃ o nhanh MCP, Ä‘Æ¡n hÃ ng, test sáº£n pháº©m vÃ  bÃ¡o cÃ¡o thá»‹ trÆ°á»ng."
      >
        <SourceBadge source={dashboardResult.source} />
      </PageHeader>

      <TodaySummaryCard
        eyebrow="Tá»•ng quan nhanh"
        value={primaryKpi?.value ?? "-"}
        description={primaryKpi ? `${primaryKpi.label} Â· ${primaryKpi.hint}` : "Äang chá» dá»¯ liá»‡u"}
        pills={[
          { label: "tuyáº¿n", value: totalRoutes },
          { label: "Ä‘Æ¡n", value: totalOrders },
          { label: "cáº§n xem", value: riskRoutes + watchRoutes }
        ]}
      />

      <section className="dashboard-module-grid" aria-label="Nghiá»‡p vá»¥ nhanh">
        {MODULE_CARDS.map(renderModuleCard)}
      </section>

      <FilterBar
        title="Lá»c nhanh"
        filters={[
          { label: "Ká»³", value: "HÃ´m nay" },
          { label: "Tuyáº¿n", value: "Táº¥t cáº£" },
          { label: "Tráº¡ng thÃ¡i", value: "Äang theo dÃµi" }
        ]}
      />

      <CompactKpiStrip items={dashboard.kpis.map((item) => ({ label: item.label, value: item.value, hint: item.trend }))} />

      <section className="dashboard-section dashboard-actions-section">
        <div className="dashboard-section-head">
          <h2>Cáº§n xá»­ lÃ½</h2>
          <span>{dashboard.actions.length} viá»‡c</span>
        </div>
        <div className="dashboard-action-list">{dashboard.actions.map(renderAction)}</div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section-head">
          <h2>Sá»©c khá»e tuyáº¿n</h2>
          <span>{riskRoutes} rá»§i ro Â· {watchRoutes} theo dÃµi</span>
        </div>
        <div className="dashboard-route-list">{dashboard.routeHealth.map(renderRouteCard)}</div>
      </section>

      <section className="dashboard-insight-strip" aria-label="Chá»‰ sá»‘ phá»¥">
        {dashboard.insights.map((item) => (
          <div className="metric-row" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
