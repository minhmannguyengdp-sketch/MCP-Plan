import { createApiClient } from "@/lib/api/api-client";
import type { DashboardActionDto, DashboardRouteHealthDto } from "@/lib/api/api.types";
import { CompactKpiStrip } from "@/ui/cards/CompactKpiStrip";
import { TodaySummaryCard } from "@/ui/cards/TodaySummaryCard";
import { FilterBar } from "@/ui/layout/FilterBar";
import { PageHeader } from "@/ui/layout/PageHeader";
import { AppShell } from "@/ui/shell/AppShell";
import { SourceBadge } from "@/ui/status/SourceBadge";

function getStatusLabel(status: "good" | "watch" | "risk") {
  if (status === "good") return "On";
  if (status === "watch") return "Theo doi";
  return "Rui ro";
}

function getPriorityLabel(priority: "high" | "medium" | "low") {
  if (priority === "high") return "Cao";
  if (priority === "medium") return "Vua";
  return "Thap";
}

function getStatusClass(status: "good" | "watch" | "risk") {
  if (status === "good") return "status-good";
  if (status === "watch") return "status-watch";
  return "status-risk";
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
      <div className="dashboard-route-progress" aria-label={`Tien do ghe ${visitRate}%`}>
        <span style={{ width: `${Math.min(visitRate, 100)}%` }} />
      </div>
      <div className="dashboard-route-metrics">
        <span>
          <b>{route.visited}/{route.planned}</b>
          <small>Da ghe</small>
        </span>
        <span>
          <b>{visitRate}%</b>
          <small>Tien do</small>
        </span>
        <span>
          <b>{route.orders}</b>
          <small>Don</small>
        </span>
      </div>
    </article>
  );
}

function renderAction(action: DashboardActionDto) {
  return (
    <article className="action-card dashboard-action-card" key={action.title}>
      <div>
        <span className={`dashboard-priority priority-${action.priority}`}>Uu tien {getPriorityLabel(action.priority)}</span>
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
        title="Hom nay"
        subtitle="Tuyen, don, diem can xu ly va tinh trang van hanh trong ngay."
      >
        <SourceBadge source={dashboardResult.source} />
      </PageHeader>

      <TodaySummaryCard
        eyebrow="Tong quan nhanh"
        value={primaryKpi?.value ?? "-"}
        description={primaryKpi ? `${primaryKpi.label} · ${primaryKpi.hint}` : "Dang cho du lieu"}
        pills={[
          { label: "tuyen", value: totalRoutes },
          { label: "don", value: totalOrders },
          { label: "can xem", value: riskRoutes + watchRoutes }
        ]}
      />

      <FilterBar
        title="Loc nhanh"
        filters={[
          { label: "Ky", value: "Hom nay" },
          { label: "Tuyen", value: "Tat ca" },
          { label: "Trang thai", value: "Dang theo doi" }
        ]}
      />

      <CompactKpiStrip items={dashboard.kpis.map((item) => ({ label: item.label, value: item.value, hint: item.trend }))} />

      <section className="dashboard-section dashboard-actions-section">
        <div className="dashboard-section-head">
          <h2>Can xu ly</h2>
          <span>{dashboard.actions.length} viec</span>
        </div>
        <div className="dashboard-action-list">{dashboard.actions.map(renderAction)}</div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section-head">
          <h2>Suc khoe tuyen</h2>
          <span>{riskRoutes} rui ro · {watchRoutes} theo doi</span>
        </div>
        <div className="dashboard-route-list">{dashboard.routeHealth.map(renderRouteCard)}</div>
      </section>

      <section className="dashboard-insight-strip" aria-label="Chi so phu">
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
