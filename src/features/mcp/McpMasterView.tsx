"use client";

import { useMemo, useState } from "react";
import { OperationalListCard } from "@/ui/cards/OperationalListCard";
import { FilterBar } from "@/ui/layout/FilterBar";
import { PageHeader } from "@/ui/layout/PageHeader";
import { BottomSheet } from "@/ui/overlay/BottomSheet";
import { AppShell } from "@/ui/shell/AppShell";
import type { RouteCustomersData, RouteCustomerItem, RouteCustomerStatus } from "@/features/mcp/route-customers.types";
import { buildGoogleMapsUrl } from "@/features/mcp/route-customers.types";
import type { RoutesData, RouteItem, RouteStatus } from "@/features/routes/routes.types";

type MasterTab = "routes" | "customers" | "gps" | "open";

function routeStatusLabel(status: RouteStatus) {
  if (status === "active") return "Đang chạy";
  if (status === "watch") return "Theo dõi";
  return "Tạm dừng";
}

function routeStatusClass(status: RouteStatus) {
  if (status === "active") return "dashboard-status status-good";
  if (status === "watch") return "dashboard-status status-watch";
  return "dashboard-status status-risk";
}

function routeCustomerStatusLabel(status: RouteCustomerStatus) {
  if (status === "active") return "Đang trong tuyến";
  if (status === "needs_gps") return "Cần GPS";
  return "Đang ẩn";
}

function routeCustomerStatusClass(status: RouteCustomerStatus) {
  if (status === "active") return "dashboard-status status-good";
  if (status === "needs_gps") return "dashboard-status status-watch";
  return "dashboard-status status-risk";
}

function routeCompletion(route: RouteItem) {
  if (route.plannedCustomers === 0) return "-";
  return `${Math.round((route.visitedCustomers / route.plannedCustomers) * 100)}%`;
}

function gpsLabel(customer: RouteCustomerItem) {
  if (!customer.gps) return "Chưa có GPS";
  return `${customer.gps.lat.toFixed(5)}, ${customer.gps.lng.toFixed(5)}`;
}

function EmptyPanel({ title, hint }: { title: string; hint: string }) {
  return <div className="empty-inline"><strong>{title}</strong><p className="page-subtitle">{hint}</p></div>;
}

function RouteInfoSheet({ route, onClose, onShowCustomers }: { route: RouteItem | null; onClose: () => void; onShowCustomers: () => void }) {
  return (
    <BottomSheet
      open={Boolean(route)}
      onClose={onClose}
      title={route ? route.name : "Tuyến MCP"}
      description={route ? `${route.area} · ${route.salesOwner}` : undefined}
      footer={
        <div className="sheet-action-grid">
          <button className="button primary" type="button" onClick={onShowCustomers}>Xem khách tuyến</button>
          <button className="button" type="button" onClick={onClose}>Đóng</button>
        </div>
      }
    >
      {route ? (
        <div className="route-sheet-content">
          <div className="route-focus-card">
            <span>Tiến độ ghé</span>
            <strong>{routeCompletion(route)}</strong>
            <small>{route.visitedCustomers}/{route.plannedCustomers} điểm đã ghé · {route.orderCount} đơn</small>
          </div>
          <div className="grid">
            <div className="metric-row"><span>Trạng thái tuyến</span><strong>{routeStatusLabel(route.status)}</strong></div>
            <div className="metric-row"><span>Lần ghé cuối</span><strong>{route.lastVisitDate}</strong></div>
            <div className="metric-row"><span>Sale phụ trách</span><strong>{route.salesOwner}</strong></div>
          </div>
          <div className="sheet-note-card">
            <h3>Chuẩn bị phiên</h3>
            <p>Chọn tuyến này để xem khách tuyến trước khi mở phiên đi tuyến.</p>
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
      title={customer ? customer.accountName : "Khách tuyến"}
      description={customer ? `${customer.routeName} · STT ${customer.sortOrder}` : undefined}
      footer={<div className="sheet-action-grid">{mapsUrl ? <a className="button primary" href={mapsUrl} target="_blank" rel="noreferrer">Mở Google Maps</a> : null}<button className="button" type="button" onClick={onClose}>Đóng</button></div>}
    >
      {customer ? (
        <div className="outlet-sheet-content">
          <div className="outlet-focus-card">
            <span>Trạng thái khách</span>
            <strong>{routeCustomerStatusLabel(customer.status)}</strong>
            <small>{gpsLabel(customer)}</small>
          </div>
          <div className="grid">
            <div className="metric-row"><span>Người liên hệ</span><strong>{customer.contactName}</strong></div>
            <div className="metric-row"><span>Khu vực</span><strong>{customer.area}</strong></div>
            <div className="metric-row"><span>Thứ tự ghé</span><strong>{customer.sortOrder}</strong></div>
            <div className="metric-row"><span>Cập nhật GPS</span><strong>{customer.gps?.updatedAt ?? "Chưa có"}</strong></div>
          </div>
        </div>
      ) : null}
    </BottomSheet>
  );
}

function RouteCard({ route, onSelect, actionLabel = "Chọn tuyến" }: { route: RouteItem; onSelect: (route: RouteItem) => void; actionLabel?: string }) {
  return <OperationalListCard leading={<span>{routeCompletion(route)}</span>} eyebrow={`${route.area} · ${route.salesOwner}`} title={route.name} description={`${route.plannedCustomers} điểm bán · ${route.orderCount} đơn`} badge={<span className={routeStatusClass(route.status)}>{routeStatusLabel(route.status)}</span>} meta={[`Đã ghé ${route.visitedCustomers}/${route.plannedCustomers}`, `Lần cuối ${route.lastVisitDate}`]} actions={[{ label: actionLabel, tone: "primary", onClick: () => onSelect(route) }]} />;
}

function RouteCustomerCard({ customer, onSelect }: { customer: RouteCustomerItem; onSelect: (customer: RouteCustomerItem) => void }) {
  return <OperationalListCard leading={<span>#{customer.sortOrder}</span>} eyebrow={`${customer.area} · ${customer.contactName}`} title={customer.accountName} description={customer.note || gpsLabel(customer)} badge={<span className={routeCustomerStatusClass(customer.status)}>{routeCustomerStatusLabel(customer.status)}</span>} meta={[gpsLabel(customer)]} actions={[{ label: "Xem khách", tone: "primary", onClick: () => onSelect(customer) }]} />;
}

export function McpMasterView({ activeHref, routesData, routeCustomersData }: { activeHref: string; routesData: RoutesData; routeCustomersData: RouteCustomersData }) {
  const [tab, setTab] = useState<MasterTab>("routes");
  const [selectedRoute, setSelectedRoute] = useState<RouteItem | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<RouteCustomerItem | null>(null);

  const selectedRouteCustomers = useMemo(() => {
    if (!selectedRoute) return [];
    return routeCustomersData.customers.filter((customer) => customer.routeId === selectedRoute.id);
  }, [routeCustomersData.customers, selectedRoute]);

  const needsGpsCustomers = useMemo(() => selectedRouteCustomers.filter((customer) => customer.status === "needs_gps" || !customer.gps), [selectedRouteCustomers]);
  const activeRoutes = routesData.routes.filter((route) => route.status === "active" || route.status === "watch");

  function selectRoute(route: RouteItem) {
    setSelectedRoute(route);
    setSelectedCustomer(null);
  }

  function showSelectedRouteCustomers() {
    setTab("customers");
  }

  return (
    <AppShell activeHref={activeHref}>
      <PageHeader eyebrow="Tuyến MCP" title="Tuyến MCP" subtitle="Xem tuyến gốc, khách tuyến và chuẩn bị phiên đi tuyến.">
        <span className="badge">{routesData.routes.length} tuyến</span>
      </PageHeader>

      <FilterBar filters={[{ label: "Tuyến", value: String(routesData.routes.length) }, { label: "Khách tuyến", value: selectedRoute ? String(selectedRouteCustomers.length) : "Chưa chọn" }, { label: "Cần GPS", value: selectedRoute ? String(needsGpsCustomers.length) : "-" }, { label: "Có thể đi", value: String(activeRoutes.length) }]} />

      <section className="dashboard-section">
        <div className="dashboard-section-head"><h2>Tuyến MCP</h2><span>{selectedRoute ? `Đã chọn: ${selectedRoute.name}` : "Chọn tuyến để xem khách"}</span></div>
        <div className="mcp-status-chips" role="tablist" aria-label="Tuyến MCP">
          <button className={tab === "routes" ? "active" : ""} type="button" onClick={() => setTab("routes")}>Tuyến <b>{routesData.routes.length}</b></button>
          <button className={tab === "customers" ? "active" : ""} type="button" onClick={() => setTab("customers")}>Khách tuyến <b>{selectedRoute ? selectedRouteCustomers.length : 0}</b></button>
          <button className={tab === "gps" ? "active" : ""} type="button" onClick={() => setTab("gps")}>Cần GPS <b>{selectedRoute ? needsGpsCustomers.length : 0}</b></button>
          <button className={tab === "open" ? "active" : ""} type="button" onClick={() => setTab("open")}>Chuẩn bị phiên <b>{activeRoutes.length}</b></button>
        </div>
      </section>

      {tab === "routes" ? routesData.routes.length > 0 ? <div className="mcp-line-list">{routesData.routes.map((route) => <RouteCard key={route.id} route={route} onSelect={selectRoute} />)}</div> : <EmptyPanel title="Chưa có tuyến" hint="Chưa có dữ liệu tuyến MCP." /> : null}
      {tab === "customers" ? !selectedRoute ? <EmptyPanel title="Chọn một tuyến" hint="Anh chọn tuyến MCP trước, rồi hệ thống mới hiện khách thuộc tuyến đó." /> : selectedRouteCustomers.length > 0 ? <div className="mcp-line-list">{selectedRouteCustomers.map((customer) => <RouteCustomerCard key={customer.id} customer={customer} onSelect={setSelectedCustomer} />)}</div> : <EmptyPanel title="Tuyến chưa có khách" hint="Tuyến đang chọn chưa có khách đang hoạt động." /> : null}
      {tab === "gps" ? !selectedRoute ? <EmptyPanel title="Chọn một tuyến" hint="Anh chọn tuyến trước để xem khách cần GPS." /> : needsGpsCustomers.length > 0 ? <div className="mcp-line-list">{needsGpsCustomers.map((customer) => <RouteCustomerCard key={customer.id} customer={customer} onSelect={setSelectedCustomer} />)}</div> : <EmptyPanel title="GPS đã ổn" hint="Tuyến đang chọn không có khách cần bổ sung GPS." /> : null}
      {tab === "open" ? activeRoutes.length > 0 ? <div className="mcp-line-list">{activeRoutes.map((route) => <RouteCard key={route.id} route={route} onSelect={selectRoute} actionLabel="Chuẩn bị" />)}</div> : <EmptyPanel title="Không có tuyến đang chạy" hint="Chỉ tuyến đang chạy hoặc cần theo dõi mới dùng để chuẩn bị phiên." /> : null}

      <RouteInfoSheet route={selectedRoute} onClose={() => setSelectedRoute(null)} onShowCustomers={showSelectedRouteCustomers} />
      <RouteCustomerSheet customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
    </AppShell>
  );
}
