import { KpiCard } from "@/ui/cards/KpiCard";
import { FilterBar } from "@/ui/layout/FilterBar";
import { PageHeader } from "@/ui/layout/PageHeader";
import { AppShell } from "@/ui/shell/AppShell";
import { DataTable, type DataTableColumn } from "@/ui/table/DataTable";
import { routesMock } from "./routes.mock";
import type { RouteItem, RouteStatus } from "./routes.types";

function getStatusLabel(status: RouteStatus) {
  if (status === "active") return "Dang chay";
  if (status === "watch") return "Can theo doi";
  return "Tam dung";
}

function getCompletion(row: RouteItem) {
  if (row.plannedCustomers === 0) return "-";
  return `${Math.round((row.visitedCustomers / row.plannedCustomers) * 100)}%`;
}

const routeColumns: DataTableColumn<RouteItem>[] = [
  { key: "name", header: "Tuyen", render: (row) => row.name },
  { key: "area", header: "Khu vuc", render: (row) => row.area },
  { key: "salesOwner", header: "Phu trach", render: (row) => row.salesOwner },
  { key: "plannedCustomers", header: "Diem ban", render: (row) => row.plannedCustomers, align: "right" },
  { key: "visitedCustomers", header: "Da ghe", render: (row) => row.visitedCustomers, align: "right" },
  { key: "completion", header: "Hoan thanh", render: (row) => getCompletion(row), align: "right" },
  { key: "orderCount", header: "Don", render: (row) => row.orderCount, align: "right" },
  { key: "lastVisitDate", header: "Lan ghe cuoi", render: (row) => row.lastVisitDate },
  {
    key: "status",
    header: "Trang thai",
    render: (row) => <span className="badge">{getStatusLabel(row.status)}</span>
  }
];

export function RoutesPage() {
  return (
    <AppShell activeHref="/routes">
      <PageHeader
        eyebrow="Routes"
        title="Tuyen ban hang"
        subtitle="Man hinh quan ly tuyen bang mock data. Sau nay backend VPS chi can tra dung contract, UI khong can sua logic hien thi."
      >
        <span className="badge">Mock data</span>
      </PageHeader>

      <FilterBar
        filters={[
          { label: "Khu vuc", value: "Tat ca" },
          { label: "Phu trach", value: "Tat ca sale" },
          { label: "Trang thai", value: "Active + Can theo doi" }
        ]}
      />

      <section className="grid cards">
        {routesMock.kpis.map((item) => (
          <KpiCard key={item.label} label={item.label} value={item.value} hint={item.hint} />
        ))}
      </section>

      <section className="hero-panel" style={{ marginTop: 18 }}>
        <div className="card">
          <h2 className="panel-title">Danh sach tuyen</h2>
          <DataTable
            columns={routeColumns}
            rows={routesMock.routes}
            getRowKey={(row) => row.id}
            emptyMessage="Chua co tuyen ban hang"
          />
        </div>

        <div className="card">
          <h2 className="panel-title">Can xu ly</h2>
          <div className="grid">
            <div className="metric-row">
              <span>Tuyen can theo doi</span>
              <strong>2</strong>
            </div>
            <div className="metric-row">
              <span>Diem ban chua ghe</span>
              <strong>9</strong>
            </div>
            <div className="metric-row">
              <span>Tuyen chua co don</span>
              <strong>2</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="panel-title">Nguyen tac module Routes</h2>
        <div className="grid">
          <article className="action-card">
            <div>
              <span className="badge">Kien truc</span>
              <h3>Routes UI khong biet data den tu dau</h3>
              <p className="page-subtitle">
                Hien tai doc mock data. Sau nay co the thay bang API client goi backend VPS ma khong sua table/card/filter.
              </p>
            </div>
            <strong>Clean</strong>
          </article>
          <article className="action-card">
            <div>
              <span className="badge">San pham</span>
              <h3>Man hinh nay se la goc cho cham soc diem ban</h3>
              <p className="page-subtitle">
                Tu tuyen se mo tiep khach hang, visit, order va goi y hanh dong MCP-Plan.
              </p>
            </div>
            <strong>NPP</strong>
          </article>
        </div>
      </section>
    </AppShell>
  );
}
