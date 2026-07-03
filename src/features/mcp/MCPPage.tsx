"use client";

import { useMemo, useState } from "react";
import { KpiCard } from "@/ui/cards/KpiCard";
import { FilterBar } from "@/ui/layout/FilterBar";
import { PageHeader } from "@/ui/layout/PageHeader";
import { BottomSheet } from "@/ui/overlay/BottomSheet";
import { AppShell } from "@/ui/shell/AppShell";
import { DataTable, type DataTableColumn } from "@/ui/table/DataTable";
import type { DayLineSource, DayLineStatus, McpDayData, McpDayLine, McpDayResult } from "@/features/mcp-day/mcp-day.types";
import type { RouteCustomersData, RouteCustomerItem, RouteCustomerStatus } from "@/features/mcp/route-customers.types";
import { buildGoogleMapsUrl } from "@/features/mcp/route-customers.types";
import type { RoutesData, RouteItem, RouteStatus } from "@/features/routes/routes.types";
import { McpLineCard } from "./McpLineCard";
import { mcpCustomerActionDescription, mcpCustomerActionLabel, type McpCustomerAction } from "./mcp-customer-actions";
import { MCP_SESSION_SNAPSHOT_RULES } from "./mcp-session-contract";

function routeStatusLabel(status: RouteStatus) {
  if (status === "active") return "Dang chay";
  if (status === "watch") return "Can theo doi";
  return "Tam dung";
}

function routeCustomerStatusLabel(status: RouteCustomerStatus) {
  if (status === "active") return "Dang trong tuyen";
  if (status === "needs_gps") return "Can GPS";
  return "Dang an";
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

function gpsLabel(customer: RouteCustomerItem) {
  if (!customer.gps) return "Chua co GPS";
  return `${customer.gps.lat.toFixed(5)}, ${customer.gps.lng.toFixed(5)}`;
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

function RouteCustomerSheet({ customer, onClose }: { customer: RouteCustomerItem | null; onClose: () => void }) {
  const mapsUrl = customer ? buildGoogleMapsUrl(customer) : undefined;

  return (
    <BottomSheet
      open={Boolean(customer)}
      onClose={onClose}
      title={customer ? customer.accountName : "Khach trong tuyen"}
      description={customer ? `${customer.routeName} · STT ${customer.sortOrder}` : undefined}
      footer={
        <div className="sheet-action-grid">
          {mapsUrl ? <a className="button primary" href={mapsUrl} target="_blank" rel="noreferrer">Mo Google Maps</a> : null}
          <button className="button primary" type="button">Luu GPS hien tai</button>
          <button className="button" type="button">Doi thu tu ghe</button>
          <button className="button" type="button">Sua thong tin khach</button>
          <button className="button" type="button">An khoi tuyen</button>
          <button className="button" type="button" onClick={onClose}>Dong</button>
        </div>
      }
    >
      {customer ? (
        <div className="outlet-sheet-content">
          <div className="outlet-focus-card">
            <span>Route Customer Master</span>
            <strong>{routeCustomerStatusLabel(customer.status)}</strong>
            <small>{gpsLabel(customer)}</small>
          </div>
          <div className="grid">
            <div className="metric-row"><span>Lien he</span><strong>{customer.contactName}</strong></div>
            <div className="metric-row"><span>Khu vuc</span><strong>{customer.area}</strong></div>
            <div className="metric-row"><span>Thu tu ghe</span><strong>{customer.sortOrder}</strong></div>
            <div className="metric-row"><span>Cap nhat GPS</span><strong>{customer.gps?.updatedAt ?? "Chua co"}</strong></div>
          </div>
          <div className="sheet-note-card">
            <h3>Quy tac khach trong tuyen</h3>
            <p>Day la danh sach mac dinh cua tuyen. An khoi tuyen khong xoa du lieu goc. Khi mo phien ngay, danh sach nay duoc copy thanh session customer snapshot.</p>
          </div>
        </div>
      ) : null}
    </BottomSheet>
  );
}

function CustomerActionSheet({
  selection,
  onClose
}: {
  selection: { line: McpDayLine; action: McpCustomerAction } | null;
  onClose: () => void;
}) {
  return (
    <BottomSheet
      open={Boolean(selection)}
      onClose={onClose}
      title={selection ? mcpCustomerActionLabel(selection.action) : "Hanh dong MCP"}
      description={selection ? selection.line.accountName : undefined}
      footer={
        <div className="sheet-action-grid">
          <button className="button primary" type="button">Luu nhap</button>
          <button className="button" type="button">Chuyen sang form chi tiet</button>
          <button className="button" type="button" onClick={onClose}>Dong</button>
        </div>
      }
    >
      {selection ? (
        <div className="visit-sheet-content">
          <div className="visit-focus-card">
            <span>Gan voi Session Customer Snapshot</span>
            <strong>{mcpCustomerActionLabel(selection.action)}</strong>
            <small>{mcpCustomerActionDescription(selection.action)}</small>
          </div>
          <div className="grid">
            <div className="metric-row"><span>Diem ban</span><strong>{selection.line.accountName}</strong></div>
            <div className="metric-row"><span>Khu vuc</span><strong>{selection.line.area}</strong></div>
            <div className="metric-row"><span>Thu tu ghe</span><strong>{selection.line.sortOrder}</strong></div>
            <div className="metric-row"><span>Trang thai</span><strong>{lineStatusLabel(selection.line.status)}</strong></div>
          </div>
          <div className="sheet-note-card">
            <h3>Khong tach roi MCP</h3>
            <p>Don hang, test san pham, bao cao thi truong va viec can lam duoc tao tu customer card trong phien. Sau nay form chi tiet se ghi kem sessionCustomerId.</p>
          </div>
        </div>
      ) : null}
    </BottomSheet>
  );
}

function CustomerSheet({ line, onClose, onAction }: { line: McpDayLine | null; onClose: () => void; onAction: (line: McpDayLine, action: McpCustomerAction) => void }) {
  return (
    <BottomSheet
      open={Boolean(line)}
      onClose={onClose}
      title={line ? line.accountName : "Xu ly diem ban"}
      description={line ? `${line.area} · ${sourceLabel(line.source)}` : undefined}
      footer={line ? (
        <div className="sheet-action-grid">
          <button className="button primary" type="button">Check-in</button>
          <button className="button" type="button" onClick={() => onAction(line, "order")}>Co don</button>
          <button className="button" type="button" onClick={() => onAction(line, "test")}>Co test</button>
          <button className="button" type="button">Khong mua</button>
          <button className="button" type="button" onClick={() => onAction(line, "market_report")}>Bao cao</button>
          <button className="button" type="button" onClick={() => onAction(line, "follow_up")}>Tao viec</button>
          <button className="button" type="button" onClick={onClose}>Dong</button>
        </div>
      ) : undefined}
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

export function MCPPage({
  activeHref = "/visits",
  routesData,
  mcpDayData,
  routeCustomersData
}: {
  activeHref?: string;
  routesData: RoutesData;
  mcpDayData: McpDayData;
  routeCustomersData: RouteCustomersData;
}) {
  const [selectedRoute, setSelectedRoute] = useState<RouteItem | null>(null);
  const [selectedLine, setSelectedLine] = useState<McpDayLine | null>(null);
  const [selectedRouteCustomer, setSelectedRouteCustomer] = useState<RouteCustomerItem | null>(null);
  const [selectedAction, setSelectedAction] = useState<{ line: McpDayLine; action: McpCustomerAction } | null>(null);
  const [sessionStatus, setSessionStatus] = useState("opened");
  const run = mcpDayData.run;

  function openCustomerAction(line: McpDayLine, action: McpCustomerAction) {
    setSelectedAction({ line, action });
  }

  const routeColumns = useMemo<DataTableColumn<RouteItem>[]>(() => [
    { key: "name", header: "Tuyen", render: (row) => row.name },
    { key: "area", header: "Khu vuc", render: (row) => row.area },
    { key: "salesOwner", header: "Sale", render: (row) => row.salesOwner },
    { key: "plannedCustomers", header: "Diem ban", render: (row) => row.plannedCustomers, align: "right" },
    { key: "completion", header: "Tien do", render: (row) => routeCompletion(row), align: "right" },
    { key: "status", header: "Trang thai", render: (row) => <span className="badge">{routeStatusLabel(row.status)}</span> },
    { key: "open", header: "", render: (row) => <button className="button compact" type="button" onClick={() => setSelectedRoute(row)}>Mo phien</button> }
  ], []);

  const routeCustomerColumns = useMemo<DataTableColumn<RouteCustomerItem>[]>(() => [
    { key: "sortOrder", header: "STT", render: (row) => row.sortOrder, align: "right" },
    { key: "accountName", header: "Diem ban", render: (row) => row.accountName },
    { key: "routeName", header: "Tuyen", render: (row) => row.routeName },
    { key: "status", header: "Trang thai", render: (row) => <span className="badge">{routeCustomerStatusLabel(row.status)}</span> },
    { key: "gps", header: "GPS", render: (row) => gpsLabel(row) },
    {
      key: "map",
      header: "Ban do",
      render: (row) => {
        const mapsUrl = buildGoogleMapsUrl(row);
        return mapsUrl ? <a className="button compact" href={mapsUrl} target="_blank" rel="noreferrer">Maps</a> : "Can GPS";
      }
    },
    { key: "detail", header: "", render: (row) => <button className="button compact" type="button" onClick={() => setSelectedRouteCustomer(row)}>Sua</button> }
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
        {mcpDayData.kpis.map((item) => <KpiCard key={item.label} label={item.label} value={item.value} hint={item.hint} />)}
      </section>

      <section className="hero-panel" style={{ marginTop: 18 }}>
        <div className="card">
          <h2 className="panel-title">1. Chon tuyen de mo phien</h2>
          <DataTable columns={routeColumns} rows={routesData.routes} getRowKey={(row) => row.id} emptyMessage="Chua co tuyen" />
        </div>
        <div className="card">
          <h2 className="panel-title">GPS & route master</h2>
          <div className="grid">
            {routeCustomersData.kpis.map((item) => <KpiCard key={item.label} label={item.label} value={item.value} hint={item.hint} />)}
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="panel-title">2. Khach trong tuyen + GPS</h2>
        <DataTable columns={routeCustomerColumns} rows={routeCustomersData.customers} getRowKey={(row) => row.id} emptyMessage="Chua co khach trong tuyen" />
      </section>

      <section className="card">
        <h2 className="panel-title">3. MCPCustomerCard trong phien ngay</h2>
        <div className="grid">
          {mcpDayData.lines.map((line) => (
            <McpLineCard key={line.id} line={line} onOpen={setSelectedLine} onAction={openCustomerAction} />
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="panel-title">4. Bang snapshot khach trong phien</h2>
        <DataTable columns={customerColumns} rows={mcpDayData.lines} getRowKey={(row) => row.id} />
      </section>

      <section className="card">
        <h2 className="panel-title">5. Ket qua da ghe</h2>
        <DataTable columns={resultColumns} rows={mcpDayData.results} getRowKey={(row) => row.id} />
      </section>

      <section className="card">
        <h2 className="panel-title">6. Session snapshot contract</h2>
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
      <RouteCustomerSheet customer={selectedRouteCustomer} onClose={() => setSelectedRouteCustomer(null)} />
      <CustomerSheet line={selectedLine} onClose={() => setSelectedLine(null)} onAction={openCustomerAction} />
      <CustomerActionSheet selection={selectedAction} onClose={() => setSelectedAction(null)} />
    </AppShell>
  );
}
