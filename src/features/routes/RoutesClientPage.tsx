"use client";

import { useMemo, useState } from "react";
import { KpiCard } from "@/ui/cards/KpiCard";
import { FilterBar } from "@/ui/layout/FilterBar";
import { PageHeader } from "@/ui/layout/PageHeader";
import { BottomSheet } from "@/ui/overlay/BottomSheet";
import { AppShell } from "@/ui/shell/AppShell";
import { DataTable, type DataTableColumn } from "@/ui/table/DataTable";
import type { RouteItem, RouteKpi, RouteStatus } from "./routes.types";

function getStatusLabel(status: RouteStatus) {
  if (status === "active") return "Dang chay";
  if (status === "watch") return "Can theo doi";
  return "Tam dung";
}

function getCompletion(row: RouteItem) {
  if (row.plannedCustomers === 0) return "-";
  return `${Math.round((row.visitedCustomers / row.plannedCustomers) * 100)}%`;
}

function buildColumns(onSelect: (route: RouteItem) => void): DataTableColumn<RouteItem>[] {
  return [
    { key: "name", header: "Tuyen", render: (row) => row.name },
    { key: "area", header: "Khu vuc", render: (row) => row.area },
    { key: "salesOwner", header: "Phu trach", render: (row) => row.salesOwner },
    { key: "plannedCustomers", header: "Diem ban", render: (row) => row.plannedCustomers, align: "right" },
    { key: "visitedCustomers", header: "Da ghe", render: (row) => row.visitedCustomers, align: "right" },
    { key: "completion", header: "Hoan thanh", render: (row) => getCompletion(row), align: "right" },
    { key: "orderCount", header: "Don", render: (row) => row.orderCount, align: "right" },
    { key: "status", header: "Trang thai", render: (row) => <span className="badge">{getStatusLabel(row.status)}</span> },
    { key: "detail", header: "", render: (row) => <button className="button compact" type="button" onClick={() => onSelect(row)}>Mo</button> }
  ];
}

function RouteSheet({ route, onClose }: { route: RouteItem | null; onClose: () => void }) {
  return (
    <BottomSheet
      open={Boolean(route)}
      onClose={onClose}
      title={route ? route.name : "Chi tiet tuyen"}
      description={route ? `${route.area} · ${route.salesOwner}` : undefined}
      footer={
        <div className="sheet-action-grid">
          <button className="button primary" type="button">Mo phien MCP ngay</button>
          <button className="button" type="button">Xem diem ban trong tuyen</button>
          <button className="button" type="button">Tao viec theo doi</button>
          <button className="button" type="button" onClick={onClose}>Dong</button>
        </div>
      }
    >
      {route ? (
        <div className="route-sheet-content">
          <div className="route-focus-card">
            <span>Tien do hom nay</span>
            <strong>{getCompletion(route)}</strong>
            <small>{route.visitedCustomers}/{route.plannedCustomers} diem ban · {route.orderCount} don</small>
          </div>

          <div className="grid">
            <div className="metric-row"><span>Trang thai</span><strong>{getStatusLabel(route.status)}</strong></div>
            <div className="metric-row"><span>Lan ghe cuoi</span><strong>{route.lastVisitDate}</strong></div>
            <div className="metric-row"><span>Diem ban</span><strong>{route.plannedCustomers}</strong></div>
            <div className="metric-row"><span>Don hang</span><strong>{route.orderCount}</strong></div>
          </div>

          <div className="sheet-note-card">
            <h3>Mo phien MCP</h3>
            <p>Khi noi backend that, nut mo phien se tao Daily Session va snapshot danh sach khach trong tuyen. Sau khi mo phien, thay doi tuyen goc khong tu dong lam doi snapshot.</p>
          </div>
        </div>
      ) : null}
    </BottomSheet>
  );
}

export function RoutesClientPage({ kpis, routes }: { kpis: RouteKpi[]; routes: RouteItem[] }) {
  const [selectedRoute, setSelectedRoute] = useState<RouteItem | null>(null);
  const columns = useMemo(() => buildColumns(setSelectedRoute), []);

  return (
    <AppShell activeHref="/routes">
      <PageHeader
        eyebrow="Routes"
        title="Tuyen ban hang"
        subtitle="Quan ly tuyen va mo phien MCP ngay bang popup mobile-first."
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
        {kpis.map((item) => (
          <KpiCard key={item.label} label={item.label} value={item.value} hint={item.hint} />
        ))}
      </section>

      <section className="hero-panel" style={{ marginTop: 18 }}>
        <div className="card">
          <h2 className="panel-title">Danh sach tuyen</h2>
          <DataTable columns={columns} rows={routes} getRowKey={(row) => row.id} emptyMessage="Chua co tuyen ban hang" />
        </div>

        <div className="card">
          <h2 className="panel-title">Can xu ly</h2>
          <div className="grid">
            <div className="metric-row"><span>Tuyen can theo doi</span><strong>2</strong></div>
            <div className="metric-row"><span>Diem ban chua ghe</span><strong>9</strong></div>
            <div className="metric-row"><span>Tuyen chua co don</span><strong>2</strong></div>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="panel-title">Nguyen tac module Routes</h2>
        <div className="grid">
          <article className="action-card">
            <div>
              <span className="badge">MCP logic</span>
              <h3>Tuyen goc khac phien ngay</h3>
              <p className="page-subtitle">Tu route master chi mo snapshot cho ngay. Khi phien da mo, sua route master khong duoc lam doi du lieu ngay da mo.</p>
            </div>
            <strong>Clean</strong>
          </article>
        </div>
      </section>

      <RouteSheet route={selectedRoute} onClose={() => setSelectedRoute(null)} />
    </AppShell>
  );
}
