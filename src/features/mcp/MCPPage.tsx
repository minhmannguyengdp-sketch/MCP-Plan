"use client";

import { useMemo, useState } from "react";
import { KpiCard } from "@/ui/cards/KpiCard";
import { FilterBar } from "@/ui/layout/FilterBar";
import { PageHeader } from "@/ui/layout/PageHeader";
import { BottomSheet } from "@/ui/overlay/BottomSheet";
import { AppShell } from "@/ui/shell/AppShell";
import { DataTable, type DataTableColumn } from "@/ui/table/DataTable";
import { mcpDayMock } from "@/features/mcp-day/mcp-day.mock";
import type { DayLineSource, DayLineStatus, McpDayLine, McpDayResult } from "@/features/mcp-day/mcp-day.types";
import { routesMock } from "@/features/routes/routes.mock";
import type { RouteItem, RouteStatus } from "@/features/routes/routes.types";
import { MCP_SESSION_SNAPSHOT_RULES } from "./mcp-session-contract";

function routeStatusLabel(status: RouteStatus) {
  if (status === "active") return "Dang chay";
  if (status === "watch") return "Can theo doi";
  return "Tam dung";
}

function sourceLabel(source: DayLineSource) {
  if (source === "planned") return "Ke hoach";
  if (source === "added") return "Phat sinh";
  return "Dong bo";
}

function lineStatusLabel(status: DayLineStatus) {
  if (status === "pending") return "Cho ghe";
  if (status === "visited") return "Da ghe";
  if (status === "skipped") return "Bo qua";
  return "Huy";
}

function routeCompletion(route: RouteItem) {
  if (route.plannedCustomers === 0) return "-";
  return `${Math.round((route.visitedCustomers / route.plannedCustomers) * 100)}%`;
}

const resultColumns: DataTableColumn<McpDayResult>[] = [
  { key: "accountName", header: "Diem ban", render: (row) => row.accountName },
  { key: "startTime", header: "Bat dau", render: (row) => row.startTime },
  { key: "endTime", header: "Ket thuc", render: (row) => row.endTime },
  { key: "result", header: "Ket qua", render: (row) => row.result },
  { key: "hasOrder", header: "Don", render: (row) => (row.hasOrder ? "Co" : "Khong"), align: "center" },
  { key: "nextAction", header: "Viec tiep", render: (row) => row.nextAction }
];

function StartSessionSheet({ route, onClose, onStart }: { route: RouteItem | null; onClose: () => void; onStart: () => void }) {
  return (
    <BottomSheet
      open={Boolean(route)}
      onClose={onClose}
      title={route ? `Mo phien MCP: ${route.name}` : "Mo phien MCP"}
      description={route ? `${route.area} · ${route.salesOwner}` : undefined}
      footer={
        <div className="sheet-action-grid">
          <button className="button primary" type="button" onClick={onStart}>Mo phien ngay</button>
          <button className="button" type="button">Xem diem ban trong tuyen</button>
          <button className="button" type="button" onClick={onClose}>Dong</button>
        </div>
      }
    >
      {route ? (
        <div className="route-sheet-content">
          <div className="route-focus-card">
            <span>Route Master</span>
            <strong>{routeCompletion(route)}</strong>
            <small>{route.visitedCustomers}/{route.plannedCustomers} diem ban · {route.orderCount} don</small>
          </div>
          <div className="grid">
            <div className="metric-row"><span>Trang thai</span><strong>{routeStatusLabel(route.status)}</strong></div>
            <div className="metric-row"><span>Lan ghe cuoi</span><strong>{route.lastVisitDate}</strong></div>
            <div className="metric-row"><span>Sale</span><strong>{route.salesOwner}</strong></div>
          </div>
          <div className="sheet-note-card">
            <h3>Tao snapshot ngay</h3>
            <p>Mo phien MCP se tao Daily Session va snapshot khach. Sua tuyen goc sau do khong tu dong sua snapshot da mo.</p>
          </div>
        </div>
      ) : null}
    </BottomSheet>
  );
}

function CustomerSheet({ line, onClose }: { line: McpDayLine | null; onClose: () => void }) {
  return (
    <BottomSheet
      open={Boolean(line)}
      onClose={onClose}
      title={line ? line.accountName : "Xu ly diem ban"}
      description={line ? `${line.area} · ${sourceLabel(line.source)}` : undefined}
      footer={
        <div className="sheet-action-grid">
          <button className="button primary" type="button">Check-in</button>
          <button className="button" type="button">Co don</button>
          <button className="button" type="button">Co test</button>
          <button className="button" type="button">Khong mua</button>
          <button className="button" type="button">Bao cao</button>
          <button className="button" type="button" onClick={onClose}>Dong</button>
        </div>
      }
    >
      {line ? (
        <div className="visit-sheet-content">
          <div className="visit-focus-card">
            <span>Session Customer Snapshot</span>
            <strong>{lineStatusLabel(line.status)}</strong>
            <small>{line.hasOrder ? "Da co don" : "Chua co don"}</small>
          </div>
          <div className="grid">
            <div className="metric-row"><span>Thu tu ghe</span><strong>{line.sortOrder}</strong></div>
            <div className="metric-row"><span>Nguon</span><strong>{sourceLabel(line.source)}</strong></div>
            <div className="metric-row"><span>Ket qua</span><strong>{line.result ?? "Chua ghi"}</strong></div>
            <div className="metric-row"><span>Ghi chu</span><strong>{line.note}</strong></div>
          </div>
          <div className="sheet-note-card">
            <h3>Logic MCP</h3>
            <p>Thao tac o day ghi vao phien ngay: visit result, order, test, bao cao hoac follow-up. Khong hard delete khach khoi phien.</p>
          </div>
        </div>
      ) : null}
    </BottomSheet>
  );
}

export function MCPPage({ activeHref = "/visits" }: { activeHref?: string }) {
  const [selectedRoute, setSelectedRoute] = useState<RouteItem | null>(null);
  const [selectedLine, setSelectedLine] = useState<McpDayLine | null>(null);
  const [sessionStatus, setSessionStatus] = useState("opened");
  const run = mcpDayMock.run;

  const routeColumns = useMemo<DataTableColumn<RouteItem>[]>(() => [
    { key: "name", header: "Tuyen", render: (row) => row.name },
    { key: "area", header: "Khu vuc", render: (row) => row.area },
    { key: "salesOwner", header: "Sale", render: (row) => row.salesOwner },
    { key: "plannedCustomers", header: "Diem ban", render: (row) => row.plannedCustomers, align: "right" },
    { key: "completion", header: "Tien do", render: (row) => routeCompletion(row), align: "right" },
    { key: "status", header: "Trang thai", render: (row) => <span className="badge">{routeStatusLabel(row.status)}</span> },
    { key: "open", header: "", render: (row) => <button className="button compact" type="button" onClick={() => setSelectedRoute(row)}>Mo phien</button> }
  ], []);

  const customerColumns = useMemo<DataTableColumn<McpDayLine>[]>(() => [
    { key: "sortOrder", header: "STT", render: (row) => row.sortOrder, align: "right" },
    { key: "accountName", header: "Diem ban", render: (row) => row.accountName },
    { key: "area", header: "Khu vuc", render: (row) => row.area },
    { key: "source", header: "Nguon", render: (row) => <span className="badge">{sourceLabel(row.source)}</span> },
    { key: "status", header: "Trang thai", render: (row) => <span className="badge">{lineStatusLabel(row.status)}</span> },
    { key: "hasOrder", header: "Don", render: (row) => (row.hasOrder ? "Co" : "Khong"), align: "center" },
    { key: "handle", header: "", render: (row) => <button className="button compact" type="button" onClick={() => setSelectedLine(row)}>Xu ly</button> }
  ], []);

  return (
    <AppShell activeHref={activeHref}>
      <PageHeader
        eyebrow="MCP Route Flow"
        title="MCP tuyen ban hang"
        subtitle="Chon ngay, chon tuyen, mo phien, xu ly diem ban va tong ket tuyen."
      >
        <span className="badge">{sessionStatus}</span>
      </PageHeader>

      <FilterBar
        filters={[
          { label: "Ngay", value: run.date },
          { label: "Tuyen dang mo", value: run.routeName },
          { label: "Sale", value: run.owner },
          { label: "Mo luc", value: run.openedAt }
        ]}
      />

      <section className="grid cards">
        {mcpDayMock.kpis.map((item) => <KpiCard key={item.label} label={item.label} value={item.value} hint={item.hint} />)}
      </section>

      <section className="hero-panel" style={{ marginTop: 18 }}>
        <div className="card">
          <h2 className="panel-title">1. Chon tuyen de mo phien</h2>
          <DataTable columns={routeColumns} rows={routesMock.routes} getRowKey={(row) => row.id} emptyMessage="Chua co tuyen" />
        </div>
        <div className="card">
          <h2 className="panel-title">Flow MCP chuan</h2>
          <div className="grid">
            <div className="metric-row"><span>1</span><strong>Chon ngay</strong></div>
            <div className="metric-row"><span>2</span><strong>Chon tuyen</strong></div>
            <div className="metric-row"><span>3</span><strong>Tao snapshot</strong></div>
            <div className="metric-row"><span>4</span><strong>Xu ly khach</strong></div>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="panel-title">2. Khach trong phien MCP ngay</h2>
        <DataTable columns={customerColumns} rows={mcpDayMock.lines} getRowKey={(row) => row.id} />
      </section>

      <section className="card">
        <h2 className="panel-title">3. Ket qua da ghe</h2>
        <DataTable columns={resultColumns} rows={mcpDayMock.results} getRowKey={(row) => row.id} />
      </section>

      <section className="card">
        <h2 className="panel-title">4. Session snapshot contract</h2>
        <div className="grid">
          {MCP_SESSION_SNAPSHOT_RULES.map((rule) => (
            <article className="action-card" key={rule}>
              <div>
                <span className="badge">MCP rule</span>
                <p className="page-subtitle">{rule}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <StartSessionSheet
        route={selectedRoute}
        onClose={() => setSelectedRoute(null)}
        onStart={() => {
          setSessionStatus("opened");
          setSelectedRoute(null);
        }}
      />
      <CustomerSheet line={selectedLine} onClose={() => setSelectedLine(null)} />
    </AppShell>
  );
}
