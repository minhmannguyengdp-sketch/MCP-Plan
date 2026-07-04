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
      title={route ? route.name : "Tuyến master"}
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
            <span>Tuyến master</span>
            <strong>{routeCompletion(route)}</strong>
            <small>{route.visitedCustomers}/{route.plannedCustomers} điểm đã ghé · {route.orderCount} đơn</small>
          </div>
          <div className="grid">
            <div className="metric-row"><span>Trạng thái tuyến</span><strong>{routeStatusLabel(route.status)}</strong></div>
            <div className="metric-row"><span>Lần ghé cuối</span><strong>{route.lastVisitDate}</strong></div>
            <div className="metric-row"><span>Nhân viên phụ trách</span><strong>{route.salesOwner}</strong></div>
          </div>
          <div className="sheet-note-card">
            <h3>Đúng phạm vi Gate C1</h3>
            <p>Màn này chỉ xem tuyến gốc, khách tuyến và GPS. Phiên MCP ngày nằm riêng ở /visits.</p>
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
      title={customer ? customer.accountName : "Khách trong tuyến"}
      description={customer ? `${customer.routeName} · STT ${customer.sortOrder}` : undefined}
      footer={<div className="sheet-action-grid">{mapsUrl ? <a className="button primary" href={mapsUrl} target="_blank" rel="noreferrer">Mở Google Maps</a> : null}<button className="button" type="button" onClick={onClose}>Đóng</button></div>}
    >
      {customer ? (
        <div className="outlet-sheet-content">
          <div className="outlet-focus-card">
            <span>Khách tuyến master</span>
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

function RouteCard({ route, onSelect, actionLabel = "Xem tuyến" }: { route: RouteItem; onSelect: (route: RouteItem) => void; actionLabel?: string }) {
  return <OperationalListCard leading={<span>{routeCompletion(route)}</span>} eyebrow={`${route.area} · ${route.salesOwner}`} title={route.name} description={`${route.plannedCustomers} điểm bán · ${route.orderCount} đơn`} badge={<span className={routeStatusClass(route.status)}>{routeStatusLabel(route.status)}</span>} meta={[`Đã ghé ${route.visitedCustomers}/${route.plannedCustomers}`, `Lần cuối ${route.lastVisitDate}`]} actions={[{ label: actionLabel, tone: "primary", onClick: () => onSelect(route) }]} />;
}

function RouteCustomerCard({ customer, onSelect }: { customer: RouteCustomerItem; onSelect: (customer: RouteCustomerItem) => void }) {
  return <OperationalListCard leading={<span>#{customer.sortOrder}</span>} eyebrow={`${customer.area} · ${customer.contactName}`} title={customer.accountName} description={customer.routeName} badge={<span className={routeCustomerStatusClass(customer.status)}>{routeCustomerStatusLabel(customer.status)}</span>} meta={[gpsLabel(customer), customer.note]} actions={[{ label: "Xem khách", tone: "primary", onClick: () => onSelect(customer) }]} />;
}

export function McpMasterView({ activeHref, routesData, routeCustomersData }: { activeHref: string; routesData: RoutesData; routeCustomersData: RouteCustomersData }) {
  const [tab, setTab] = useState<MasterTab>("routes");
  const [selectedRoute, setSelectedRoute] = useState<RouteItem | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<RouteCustomerItem | null>(null);
  const needsGpsCustomers = useMemo(() => routeCustomersData.customers.filter((customer) => customer.status === "needs_gps" || !customer.gps), [routeCustomersData.customers]);
  const activeRoutes = routesData.routes.filter((route) => route.status === "active");

  return (
    <AppShell activeHref={activeHref}>
      <PageHeader eyebrow="Gate C1" title="MCP tuyến master" subtitle="Nguồn tuyến gốc: tuyến, khách tuyến, GPS và danh sách tuyến có thể chuẩn bị phiên. Không trộn phiên MCP ngày.">
        <span className="badge">{routesData.routes.length} tuyến</span>
      </PageHeader>

      <section className="mcp-gate-banner">
        <strong>ĐANG TEST C1 · /routes tuyến master</strong>
        <span>Chỉ kiểm tra tuyến gốc, khách tuyến, GPS. Không test phiên ngày ở màn này.</span>
      </section>

      <FilterBar filters={[{ label: "Tuyến", value: String(routesData.routes.length) }, { label: "Khách tuyến", value: String(routeCustomersData.customers.length) }, { label: "Cần GPS", value: String(needsGpsCustomers.length) }, { label: "Đang chạy", value: String(activeRoutes.length) }]} />

      <section className="dashboard-section">
        <div className="dashboard-section-head"><h2>Tuyến master</h2><span>Chỉ dữ liệu gốc, chưa tạo/sửa ở gate này</span></div>
        <div className="mcp-status-chips" role="tablist" aria-label="MCP tuyến master">
          <button className={tab === "routes" ? "active" : ""} type="button" onClick={() => setTab("routes")}>Tuyến <b>{routesData.routes.length}</b></button>
          <button className={tab === "customers" ? "active" : ""} type="button" onClick={() => setTab("customers")}>Khách tuyến <b>{routeCustomersData.customers.length}</b></button>
          <button className={tab === "gps" ? "active" : ""} type="button" onClick={() => setTab("gps")}>GPS <b>{needsGpsCustomers.length}</b></button>
          <button className={tab === "open" ? "active" : ""} type="button" onClick={() => setTab("open")}>Chuẩn bị phiên <b>{activeRoutes.length}</b></button>
        </div>
      </section>

      {tab === "routes" ? routesData.routes.length > 0 ? <div className="mcp-line-list">{routesData.routes.map((route) => <RouteCard key={route.id} route={route} onSelect={setSelectedRoute} />)}</div> : <EmptyPanel title="Chưa có tuyến" hint="API /api/routes/data chưa trả tuyến master." /> : null}
      {tab === "customers" ? routeCustomersData.customers.length > 0 ? <div className="mcp-line-list">{routeCustomersData.customers.map((customer) => <RouteCustomerCard key={customer.id} customer={customer} onSelect={setSelectedCustomer} />)}</div> : <EmptyPanel title="Chưa có khách tuyến" hint="API /api/routes/customers/data chưa trả khách tuyến master." /> : null}
      {tab === "gps" ? needsGpsCustomers.length > 0 ? <div className="mcp-line-list">{needsGpsCustomers.map((customer) => <RouteCustomerCard key={customer.id} customer={customer} onSelect={setSelectedCustomer} />)}</div> : <EmptyPanel title="GPS đã ổn" hint="Không có khách tuyến cần bổ sung GPS trong dữ liệu hiện tại." /> : null}
      {tab === "open" ? activeRoutes.length > 0 ? <div className="mcp-line-list">{activeRoutes.map((route) => <RouteCard key={route.id} route={route} onSelect={setSelectedRoute} actionLabel="Xem trước" />)}</div> : <EmptyPanel title="Không có tuyến đang chạy" hint="Chỉ tuyến active mới được dùng để chuẩn bị phiên MCP ngày." /> : null}

      <RouteInfoSheet route={selectedRoute} onClose={() => setSelectedRoute(null)} onShowCustomers={() => { setSelectedRoute(null); setTab("customers"); }} />
      <RouteCustomerSheet customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
    </AppShell>
  );
}
