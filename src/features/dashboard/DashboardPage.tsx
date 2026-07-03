import { KpiCard } from "@/ui/cards/KpiCard";
import { PageHeader } from "@/ui/layout/PageHeader";
import { AppShell } from "@/ui/shell/AppShell";
import { dashboardMock } from "./dashboard.mock";

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

      <section className="grid cards">
        {dashboardMock.kpis.map((item) => (
          <KpiCard key={item.label} label={item.label} value={item.value} hint={`${item.hint} · ${item.trend}`} />
        ))}
      </section>

      <section className="hero-panel" style={{ marginTop: 18 }}>
        <div className="card">
          <h2 className="panel-title">Suc khoe tuyen ban hang</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tuyen</th>
                  <th>Khu vuc</th>
                  <th>Ke hoach</th>
                  <th>Da ghe</th>
                  <th>Don</th>
                  <th>Trang thai</th>
                </tr>
              </thead>
              <tbody>
                {dashboardMock.routeHealth.map((route) => (
                  <tr key={route.routeName}>
                    <td>{route.routeName}</td>
                    <td>{route.area}</td>
                    <td>{route.planned}</td>
                    <td>{route.visited}</td>
                    <td>{route.orders}</td>
                    <td><span className="badge">{getStatusLabel(route.status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
