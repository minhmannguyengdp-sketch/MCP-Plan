"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { OperationalListCard } from "@/ui/cards/OperationalListCard";
import { FilterBar } from "@/ui/layout/FilterBar";
import { PageHeader } from "@/ui/layout/PageHeader";
import { BottomSheet } from "@/ui/overlay/BottomSheet";
import { AppShell } from "@/ui/shell/AppShell";
import type { RouteCustomersData, RouteCustomerItem, RouteCustomerStatus } from "@/features/mcp/route-customers.types";
import { buildGoogleMapsUrl } from "@/features/mcp/route-customers.types";
import type { RoutesData, RouteItem, RouteStatus } from "@/features/routes/routes.types";

type MasterTab = "routes" | "customers" | "gps" | "open";

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

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

function CustomerSheet({ customer, onClose }: { customer: RouteCustomerItem | null; onClose: () => void }) {
  const mapsUrl = customer ? buildGoogleMapsUrl(customer) : undefined;
  return (
    <BottomSheet open={Boolean(customer)} onClose={onClose} title={customer ? customer.accountName : "Khách tuyến"} description={customer ? `${customer.routeName} · STT ${customer.sortOrder}` : undefined} footer={<div className="sheet-action-grid">{mapsUrl ? <a className="button primary" href={mapsUrl} target="_blank" rel="noreferrer">Mở Google Maps</a> : null}<button className="button" type="button" onClick={onClose}>Đóng</button></div>}>
      {customer ? <div className="outlet-sheet-content"><div className="outlet-focus-card"><span>Trạng thái khách</span><strong>{routeCustomerStatusLabel(customer.status)}</strong><small>{gpsLabel(customer)}</small></div><div className="grid"><div className="metric-row"><span>Liên hệ</span><strong>{customer.contactName}</strong></div><div className="metric-row"><span>Khu vực</span><strong>{customer.area}</strong></div><div className="metric-row"><span>Thứ tự ghé</span><strong>{customer.sortOrder}</strong></div><div className="metric-row"><span>Cập nhật GPS</span><strong>{customer.gps?.updatedAt ?? "Chưa có"}</strong></div></div></div> : null}
    </BottomSheet>
  );
}

function RouteCard({ route, selected, saving, onSelect, onOpenSession }: { route: RouteItem; selected: boolean; saving: boolean; onSelect: (route: RouteItem) => void; onOpenSession: (route: RouteItem) => void }) {
  return <OperationalListCard leading={<span>{routeCompletion(route)}</span>} eyebrow={`${route.area} · ${route.salesOwner}`} title={route.name} description={`${route.plannedCustomers} điểm bán · ${route.orderCount} đơn`} badge={<span className={routeStatusClass(route.status)}>{selected ? "Đã chọn" : routeStatusLabel(route.status)}</span>} meta={[`Đã ghé ${route.visitedCustomers}/${route.plannedCustomers}`, `Lần cuối ${route.lastVisitDate}`]} actions={[{ label: selected ? "Xem khách" : "Chọn tuyến", tone: "primary", onClick: () => onSelect(route) }, { label: saving && selected ? "Đang mở..." : "Mở phiên hôm nay", tone: "primary", onClick: () => onOpenSession(route) }]} />;
}

function CustomerCard({ customer, onSelect }: { customer: RouteCustomerItem; onSelect: (customer: RouteCustomerItem) => void }) {
  return <OperationalListCard leading={<span>#{customer.sortOrder}</span>} eyebrow={`${customer.area} · ${customer.contactName}`} title={customer.accountName} description={customer.note || gpsLabel(customer)} badge={<span className={routeCustomerStatusClass(customer.status)}>{routeCustomerStatusLabel(customer.status)}</span>} meta={[gpsLabel(customer)]} actions={[{ label: "Xem khách", tone: "primary", onClick: () => onSelect(customer) }]} />;
}

export function McpMasterView({ activeHref, routesData, routeCustomersData }: { activeHref: string; routesData: RoutesData; routeCustomersData: RouteCustomersData }) {
  const router = useRouter();
  const [tab, setTab] = useState<MasterTab>("routes");
  const [selectedRoute, setSelectedRoute] = useState<RouteItem | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<RouteCustomerItem | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const selectedCustomers = useMemo(() => {
    if (!selectedRoute) return [];
    return routeCustomersData.customers.filter((customer) => customer.routeId === selectedRoute.id);
  }, [routeCustomersData.customers, selectedRoute]);

  const gpsCustomers = useMemo(() => selectedCustomers.filter((customer) => customer.status === "needs_gps" || !customer.gps), [selectedCustomers]);
  const openRoutes = routesData.routes.filter((route) => route.status === "active" || route.status === "watch");

  function chooseRoute(route: RouteItem) {
    setSelectedRoute(route);
    setSelectedCustomer(null);
    setMessage(null);
    setTab("customers");
  }

  function openSession(route: RouteItem) {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");
    const sessionDate = todayDateOnly();
    setSelectedRoute(route);
    setMessage(null);
    if (!baseUrl) {
      setMessage("Thiếu NEXT_PUBLIC_API_BASE_URL nên chưa mở được phiên thật.");
      return;
    }
    startSaving(async () => {
      try {
        const response = await fetch(`${baseUrl}/api/mcp-day/open-session`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ routeId: route.id, sessionDate, owner: route.salesOwner || "Sale" }) });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Không mở được phiên MCP");
        router.push(`/visits/${encodeURIComponent(route.id)}?date=${encodeURIComponent(sessionDate)}`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Không mở được phiên MCP");
      }
    });
  }

  return (
    <AppShell activeHref={activeHref}>
      <PageHeader eyebrow="Tuyến MCP" title="Tuyến MCP" subtitle="Chọn tuyến, xem khách rồi mở phiên hôm nay."><span className="badge">{routesData.routes.length} tuyến</span></PageHeader>
      <FilterBar filters={[{ label: "Tuyến", value: String(routesData.routes.length) }, { label: "Đang chọn", value: selectedRoute?.name ?? "Chưa chọn" }, { label: "Khách tuyến", value: selectedRoute ? String(selectedCustomers.length) : "-" }, { label: "Cần GPS", value: selectedRoute ? String(gpsCustomers.length) : "-" }]} />
      {message ? <section className="empty-inline"><strong>{message}</strong></section> : null}
      <section className="dashboard-section"><div className="dashboard-section-head"><h2>Tuyến MCP</h2><span>{selectedRoute ? `Đã chọn: ${selectedRoute.name}` : "Chưa chọn tuyến"}</span></div><div className="mcp-status-chips" role="tablist" aria-label="Tuyến MCP"><button className={tab === "routes" ? "active" : ""} type="button" onClick={() => setTab("routes")}>Tuyến <b>{routesData.routes.length}</b></button><button className={tab === "customers" ? "active" : ""} type="button" onClick={() => setTab("customers")}>Khách tuyến <b>{selectedRoute ? selectedCustomers.length : 0}</b></button><button className={tab === "gps" ? "active" : ""} type="button" onClick={() => setTab("gps")}>Cần GPS <b>{selectedRoute ? gpsCustomers.length : 0}</b></button><button className={tab === "open" ? "active" : ""} type="button" onClick={() => setTab("open")}>Chuẩn bị phiên <b>{openRoutes.length}</b></button></div></section>
      {tab === "routes" ? routesData.routes.length > 0 ? <div className="mcp-line-list">{routesData.routes.map((route) => <RouteCard key={route.id} route={route} selected={selectedRoute?.id === route.id} saving={saving} onSelect={chooseRoute} onOpenSession={openSession} />)}</div> : <EmptyPanel title="Chưa có tuyến" hint="Chưa có dữ liệu tuyến MCP." /> : null}
      {tab === "customers" ? !selectedRoute ? <EmptyPanel title="Chọn một tuyến" hint="Anh chọn tuyến MCP trước, rồi hệ thống mới hiện khách thuộc tuyến đó." /> : selectedCustomers.length > 0 ? <div className="mcp-line-list">{selectedCustomers.map((customer) => <CustomerCard key={customer.id} customer={customer} onSelect={setSelectedCustomer} />)}<button className="button primary" type="button" disabled={saving} onClick={() => openSession(selectedRoute)}>{saving ? "Đang mở phiên..." : "Mở phiên hôm nay"}</button></div> : <EmptyPanel title="Tuyến chưa có khách" hint="Tuyến đang chọn chưa có khách đang hoạt động." /> : null}
      {tab === "gps" ? !selectedRoute ? <EmptyPanel title="Chọn một tuyến" hint="Anh chọn tuyến trước để xem khách cần GPS." /> : gpsCustomers.length > 0 ? <div className="mcp-line-list">{gpsCustomers.map((customer) => <CustomerCard key={customer.id} customer={customer} onSelect={setSelectedCustomer} />)}</div> : <EmptyPanel title="GPS đã ổn" hint="Tuyến đang chọn không có khách cần bổ sung GPS." /> : null}
      {tab === "open" ? openRoutes.length > 0 ? <div className="mcp-line-list">{openRoutes.map((route) => <RouteCard key={route.id} route={route} selected={selectedRoute?.id === route.id} saving={saving} onSelect={chooseRoute} onOpenSession={openSession} />)}</div> : <EmptyPanel title="Không có tuyến đang chạy" hint="Chỉ tuyến đang chạy hoặc cần theo dõi mới dùng để chuẩn bị phiên." /> : null}
      <CustomerSheet customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
    </AppShell>
  );
}
