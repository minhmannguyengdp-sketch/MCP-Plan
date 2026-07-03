import { KpiCard } from "@/ui/cards/KpiCard";
import { FilterBar } from "@/ui/layout/FilterBar";
import { PageHeader } from "@/ui/layout/PageHeader";
import { AppShell } from "@/ui/shell/AppShell";
import { DataTable, type DataTableColumn } from "@/ui/table/DataTable";
import { dashboardMock } from "./dashboard.mock";
import type { DashboardRouteHealth } from "./dashboard.types";

function getStatusLabel(status: "good" | "watch" | "risk") {
  if (status === "good") return "Tot";
  if (status === "watch") return "Can theo doi";
  return "Rui ro";
}

function getPriorityLabel(priority: "high" | "medium" | "low") {
  if (priority === "high") return "Cao";
  if (priority === "medium") return "Vua";
  return "Thap";
}

const routeColumns: DataTableColumn<DashboardRouteHealth>[] = [
  { key: "routeName", header: "Tuyen", render: (row) => row.routeName },
  { key: "area", header: "Khu vuc", render: (row) => row.area },
  { key: "planned", header: "Ke hoach", render: (row) => row.planned, align: "right" },
  { key: "visited", header: "Da ghe", render: (row) => row.visited, align: "right" },
  { key: "orders", header: "Don", render: (row) => row.orders, align: "right" },
  {
    key: "status",
    header: "Trang thai",
    render: (row) => <span className="badge">{getStatusLabel(row.status)}</span>
  }
];

export function DashboardPage() {
  return (
    <AppShell activeHref="/">
      <PageHeader
        eyebrow="Dashboard"
        title="Tong quan NPP"
        subtitle="Ban dashboard mock data de chot UI report moi truoc khi noi backend/VPS va Supabase that."
      >
        <span className="badge">Mock data mode</span>
      </PageHeader>

      <FilterBar
        filters={[
          { label: "Nguon du lieu", value: "Mock" },
          { label: "Ky bao cao", value: "Hom nay" },
          { label: "Backend", value: "VPS-ready contract" }
        ]}
      />

      <section className="grid cards">
        {dashboardMock.kpis.map((item) => (
          <KpiCard key={item.label} label={item.label} value={item.value} hint={`${item.hint} · ${item.trend}`} />
        ))}
      </section>

      <section className="hero-panel" style={{ marginTop: 18 }}>
        <div className="card">
          <h2 className="panel-title">Suc khoe tuyen ban hang</h2>
          <DataTable
            columns={routeColumns}
            rows={dashboardMock.routeHealth}
            getRowKey={(row) => row.routeName}
            emptyMessage="Chua co du lieu tuyen"
          />
        </div>

        <div className="card">
          <h2 className="panel-title">Chi so nhanh</h2>
          <div className="grid">
            {dashboardMock.insights.map((item) => (
              <div className="metric-row" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="panel-title">Goi y hanh dong</h2>
        <div className="grid">
          {dashboardMock.actions.map((action) => (
            <article className="action-card" key={action.title}>
              <div>
                <span className="badge">Uu tien {getPriorityLabel(action.priority)}</span>
                <h3>{action.title}</h3>
                <p className="page-subtitle">{action.description}</p>
              </div>
              <strong>{action.owner}</strong>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
