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
type RouteEditorMode = "create" | "edit" | "delete";
type CustomerEditorMode = "create" | "edit" | "delete";
type RouteDraft = { routeName: string; area: string; weekday: string; note: string; active: boolean };
type CustomerDraft = { customerName: string; phone: string; area: string; address: string; sortOrder: string; note: string; active: boolean; geoLat: string; geoLng: string };

function todayDateOnly() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function emptyRouteDraft(): RouteDraft {
  return { routeName: "", area: "", weekday: "", note: "", active: true };
}

function emptyCustomerDraft(route?: RouteItem | null): CustomerDraft {
  return { customerName: "", phone: "", area: route?.area === "-" ? "" : route?.area || "", address: "", sortOrder: "0", note: "", active: true, geoLat: "", geoLng: "" };
}

function routeToDraft(route: RouteItem): RouteDraft {
  return { routeName: route.name, area: route.area === "-" ? "" : route.area, weekday: "", note: "", active: route.status !== "paused" };
}

function customerToDraft(customer: RouteCustomerItem): CustomerDraft {
  return {
    customerName: customer.accountName,
    phone: customer.contactName === "Chưa có SĐT" ? "" : customer.contactName,
    area: customer.area === "-" ? "" : customer.area,
    address: "",
    sortOrder: String(customer.sortOrder || 0),
    note: customer.note || "",
    active: customer.status !== "hidden",
    geoLat: customer.gps ? String(customer.gps.lat) : "",
    geoLng: customer.gps ? String(customer.gps.lng) : ""
  };
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
    <BottomSheet open={Boolean(customer)} onClose={onClose} title={customer ? customer.accountName : "Khách tuyến"} description={customer ? `${customer.routeName} - STT ${customer.sortOrder}` : undefined} footer={<div className="sheet-action-grid">{mapsUrl ? <a className="button primary" href={mapsUrl} target="_blank" rel="noreferrer">Mở Google Maps</a> : null}<button className="button" type="button" onClick={onClose}>Đóng</button></div>}>
      {customer ? <div className="outlet-sheet-content"><div className="outlet-focus-card"><span>Trạng thái khách</span><strong>{routeCustomerStatusLabel(customer.status)}</strong><small>{gpsLabel(customer)}</small></div><div className="grid"><div className="metric-row"><span>Liên hệ</span><strong>{customer.contactName}</strong></div><div className="metric-row"><span>Khu vực</span><strong>{customer.area}</strong></div><div className="metric-row"><span>Thứ tự ghé</span><strong>{customer.sortOrder}</strong></div><div className="metric-row"><span>Cập nhật GPS</span><strong>{customer.gps?.updatedAt ?? "Chưa có"}</strong></div></div></div> : null}
    </BottomSheet>
  );
}

function RouteEditSheet({ mode, route, draft, saving, message, onDraftChange, onClose, onSubmit }: { mode: RouteEditorMode | null; route: RouteItem | null; draft: RouteDraft; saving: boolean; message: string | null; onDraftChange: (field: keyof RouteDraft, value: string | boolean) => void; onClose: () => void; onSubmit: () => void }) {
  const open = Boolean(mode);
  const isDelete = mode === "delete";
  const title = mode === "create" ? "Tạo tuyến gốc" : mode === "edit" ? "Sửa tuyến gốc" : "Xóa dứt điểm tuyến";
  const submitLabel = saving ? "Đang lưu..." : isDelete ? "Xóa dứt điểm" : mode === "create" ? "Tạo tuyến" : "Lưu tuyến";

  return (
    <BottomSheet open={open} onClose={onClose} title={title} description={isDelete && route ? `${route.name} · xóa thật, không archive` : "Tuyến gốc là master data để mở phiên theo ngày."} footer={<div className="sheet-action-grid"><button className="button primary" type="button" onClick={onSubmit} disabled={saving}>{submitLabel}</button><button className="button" type="button" onClick={onClose} disabled={saving}>Đóng</button></div>}>
      {isDelete ? (
        <div className="visit-sheet-content"><div className="visit-focus-card"><span>Cảnh báo</span><strong>Xóa thật khỏi DB</strong><small>Tuyến, khách tuyến, phiên, checklist, visits, follow-up và mẫu route-bound của tuyến này sẽ bị xóa theo RPC hard delete.</small></div><div className="metric-row"><span>Tuyến</span><strong>{route?.name}</strong></div><div className="metric-row"><span>Khu vực</span><strong>{route?.area}</strong></div>{message ? <p className="page-subtitle">{message}</p> : null}</div>
      ) : (
        <div className="visit-sheet-content"><label className="form-field"><small>Tên tuyến</small><input value={draft.routeName} onChange={(event) => onDraftChange("routeName", event.target.value)} placeholder="VD: Tuyến Quận 5" /></label><label className="form-field"><small>Khu vực</small><input value={draft.area} onChange={(event) => onDraftChange("area", event.target.value)} placeholder="VD: Quận 5" /></label><label className="form-field"><small>Thứ trong tuần</small><select value={draft.weekday} onChange={(event) => onDraftChange("weekday", event.target.value)}><option value="">Chưa chọn</option><option value="1">Thứ 2</option><option value="2">Thứ 3</option><option value="3">Thứ 4</option><option value="4">Thứ 5</option><option value="5">Thứ 6</option><option value="6">Thứ 7</option><option value="0">Chủ nhật</option></select></label>{mode === "edit" ? <label className="form-field"><small>Trạng thái</small><select value={draft.active ? "active" : "paused"} onChange={(event) => onDraftChange("active", event.target.value === "active")}><option value="active">Đang chạy</option><option value="paused">Tạm dừng</option></select></label> : null}<label className="form-field"><small>Ghi chú</small><textarea value={draft.note} onChange={(event) => onDraftChange("note", event.target.value)} placeholder="Ghi chú tuyến" /></label>{message ? <p className="page-subtitle">{message}</p> : null}</div>
      )}
    </BottomSheet>
  );
}

function CustomerEditSheet({ mode, customer, route, draft, saving, message, onDraftChange, onClose, onSubmit }: { mode: CustomerEditorMode | null; customer: RouteCustomerItem | null; route: RouteItem | null; draft: CustomerDraft; saving: boolean; message: string | null; onDraftChange: (field: keyof CustomerDraft, value: string | boolean) => void; onClose: () => void; onSubmit: () => void }) {
  const open = Boolean(mode);
  const isDelete = mode === "delete";
  const title = mode === "create" ? "Thêm khách vào tuyến" : mode === "edit" ? "Sửa khách tuyến" : "Xóa dứt điểm khách tuyến";
  const submitLabel = saving ? "Đang lưu..." : isDelete ? "Xóa dứt điểm" : mode === "create" ? "Thêm khách" : "Lưu khách";
  const routeName = route?.name || customer?.routeName || "Tuyến gốc";

  return (
    <BottomSheet open={open} onClose={onClose} title={title} description={isDelete ? `${customer?.accountName || "Khách"} · xóa thật khỏi tuyến gốc` : `Tuyến: ${routeName}`} footer={<div className="sheet-action-grid"><button className="button primary" type="button" onClick={onSubmit} disabled={saving}>{submitLabel}</button><button className="button" type="button" onClick={onClose} disabled={saving}>Đóng</button></div>}>
      {isDelete ? (
        <div className="visit-sheet-content"><div className="visit-focus-card"><span>Cảnh báo</span><strong>Xóa thật khỏi DB</strong><small>Khách gốc, snapshot của khách trong phiên, visits và follow-up liên quan sẽ bị xóa dứt điểm.</small></div><div className="metric-row"><span>Khách</span><strong>{customer?.accountName}</strong></div><div className="metric-row"><span>Tuyến</span><strong>{customer?.routeName}</strong></div>{message ? <p className="page-subtitle">{message}</p> : null}</div>
      ) : (
        <div className="visit-sheet-content"><label className="form-field"><small>Tên khách</small><input value={draft.customerName} onChange={(event) => onDraftChange("customerName", event.target.value)} placeholder="VD: Say Me" /></label><label className="form-field"><small>Số điện thoại</small><input value={draft.phone} onChange={(event) => onDraftChange("phone", event.target.value)} placeholder="SĐT khách" /></label><label className="form-field"><small>Khu vực</small><input value={draft.area} onChange={(event) => onDraftChange("area", event.target.value)} placeholder="Khu vực" /></label><label className="form-field"><small>Địa chỉ</small><input value={draft.address} onChange={(event) => onDraftChange("address", event.target.value)} placeholder="Địa chỉ" /></label><label className="form-field"><small>Thứ tự ghé</small><input inputMode="numeric" value={draft.sortOrder} onChange={(event) => onDraftChange("sortOrder", event.target.value)} /></label>{mode === "edit" ? <label className="form-field"><small>Trạng thái</small><select value={draft.active ? "active" : "hidden"} onChange={(event) => onDraftChange("active", event.target.value === "active")}><option value="active">Đang trong tuyến</option><option value="hidden">Ẩn khỏi tuyến</option></select></label> : null}<label className="form-field"><small>GPS Lat</small><input inputMode="decimal" value={draft.geoLat} onChange={(event) => onDraftChange("geoLat", event.target.value)} placeholder="10.762622" /></label><label className="form-field"><small>GPS Lng</small><input inputMode="decimal" value={draft.geoLng} onChange={(event) => onDraftChange("geoLng", event.target.value)} placeholder="106.660172" /></label><label className="form-field"><small>Ghi chú</small><textarea value={draft.note} onChange={(event) => onDraftChange("note", event.target.value)} placeholder="Ghi chú khách tuyến" /></label>{message ? <p className="page-subtitle">{message}</p> : null}</div>
      )}
    </BottomSheet>
  );
}

function RouteCard({ route, selected, saving, onSelect, onOpenSession, onEdit, onDelete }: { route: RouteItem; selected: boolean; saving: boolean; onSelect: (route: RouteItem) => void; onOpenSession: (route: RouteItem) => void; onEdit: (route: RouteItem) => void; onDelete: (route: RouteItem) => void }) {
  return <OperationalListCard leading={<span>{routeCompletion(route)}</span>} eyebrow={`${route.area} - ${route.salesOwner}`} title={route.name} description={`${route.plannedCustomers} điểm bán - ${route.orderCount} đơn`} badge={<span className={routeStatusClass(route.status)}>{selected ? "Đã chọn" : routeStatusLabel(route.status)}</span>} meta={[`Đã ghé ${route.visitedCustomers}/${route.plannedCustomers}`, `Lần cuối ${route.lastVisitDate}`]} actions={[{ label: selected ? "Xem khách" : "Chọn tuyến", tone: "primary", onClick: () => onSelect(route) }, { label: saving && selected ? "Đang mở..." : "Mở phiên hôm nay", tone: "primary", onClick: () => onOpenSession(route) }, { label: "Sửa", onClick: () => onEdit(route) }, { label: "Xóa dứt điểm", onClick: () => onDelete(route) }]} />;
}

function CustomerCard({ customer, onSelect, onEdit, onDelete }: { customer: RouteCustomerItem; onSelect: (customer: RouteCustomerItem) => void; onEdit: (customer: RouteCustomerItem) => void; onDelete: (customer: RouteCustomerItem) => void }) {
  return <OperationalListCard leading={<span>#{customer.sortOrder}</span>} eyebrow={`${customer.area} - ${customer.contactName}`} title={customer.accountName} description={customer.note || gpsLabel(customer)} badge={<span className={routeCustomerStatusClass(customer.status)}>{routeCustomerStatusLabel(customer.status)}</span>} meta={[gpsLabel(customer)]} actions={[{ label: "Xem khách", tone: "primary", onClick: () => onSelect(customer) }, { label: "Sửa", onClick: () => onEdit(customer) }, { label: "Xóa dứt điểm", onClick: () => onDelete(customer) }]} />;
}

export function McpMasterView({ activeHref, routesData, routeCustomersData }: { activeHref: string; routesData: RoutesData; routeCustomersData: RouteCustomersData }) {
  const router = useRouter();
  const [tab, setTab] = useState<MasterTab>("routes");
  const [selectedRoute, setSelectedRoute] = useState<RouteItem | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<RouteCustomerItem | null>(null);
  const [routeEditorMode, setRouteEditorMode] = useState<RouteEditorMode | null>(null);
  const [routeEditorRoute, setRouteEditorRoute] = useState<RouteItem | null>(null);
  const [routeDraft, setRouteDraft] = useState<RouteDraft>(emptyRouteDraft());
  const [customerEditorMode, setCustomerEditorMode] = useState<CustomerEditorMode | null>(null);
  const [customerEditorCustomer, setCustomerEditorCustomer] = useState<RouteCustomerItem | null>(null);
  const [customerDraft, setCustomerDraft] = useState<CustomerDraft>(emptyCustomerDraft());
  const [message, setMessage] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const selectedCustomers = useMemo(() => selectedRoute ? routeCustomersData.customers.filter((customer) => customer.routeId === selectedRoute.id) : [], [routeCustomersData.customers, selectedRoute]);
  const gpsCustomers = useMemo(() => selectedCustomers.filter((customer) => customer.status === "needs_gps" || !customer.gps), [selectedCustomers]);
  const openRoutes = routesData.routes.filter((route) => route.status === "active" || route.status === "watch");

  function chooseRoute(route: RouteItem) {
    setSelectedRoute(route);
    setSelectedCustomer(null);
    setMessage(null);
    setTab("customers");
  }

  function openRouteCreate() { setRouteEditorMode("create"); setRouteEditorRoute(null); setRouteDraft(emptyRouteDraft()); setMessage(null); }
  function openRouteEdit(route: RouteItem) { setRouteEditorMode("edit"); setRouteEditorRoute(route); setRouteDraft(routeToDraft(route)); setMessage(null); }
  function openRouteDelete(route: RouteItem) { setRouteEditorMode("delete"); setRouteEditorRoute(route); setRouteDraft(routeToDraft(route)); setMessage(null); }
  function closeRouteEditor() { if (saving) return; setRouteEditorMode(null); setRouteEditorRoute(null); setMessage(null); }
  function updateRouteDraft(field: keyof RouteDraft, value: string | boolean) { setRouteDraft((current) => ({ ...current, [field]: value })); }

  function openCustomerCreate() {
    if (!selectedRoute) { setMessage("Cần chọn tuyến gốc trước khi thêm khách"); return; }
    setCustomerEditorMode("create"); setCustomerEditorCustomer(null); setCustomerDraft(emptyCustomerDraft(selectedRoute)); setSelectedCustomer(null); setMessage(null);
  }
  function openCustomerEdit(customer: RouteCustomerItem) { setCustomerEditorMode("edit"); setCustomerEditorCustomer(customer); setCustomerDraft(customerToDraft(customer)); setSelectedCustomer(null); setMessage(null); }
  function openCustomerDelete(customer: RouteCustomerItem) { setCustomerEditorMode("delete"); setCustomerEditorCustomer(customer); setCustomerDraft(customerToDraft(customer)); setSelectedCustomer(null); setMessage(null); }
  function closeCustomerEditor() { if (saving) return; setCustomerEditorMode(null); setCustomerEditorCustomer(null); setMessage(null); }
  function updateCustomerDraft(field: keyof CustomerDraft, value: string | boolean) { setCustomerDraft((current) => ({ ...current, [field]: value })); }

  function submitRouteEditor() {
    if (!routeEditorMode) return;
    startSaving(async () => {
      try {
        setMessage(null);
        if (routeEditorMode === "create") {
          if (!routeDraft.routeName.trim()) throw new Error("Cần nhập tên tuyến");
          const response = await fetch("/api/routes", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(routeDraft) });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload.error || "Không tạo được tuyến");
        } else if (routeEditorMode === "edit" && routeEditorRoute) {
          if (!routeDraft.routeName.trim()) throw new Error("Cần nhập tên tuyến");
          const response = await fetch(`/api/routes/${encodeURIComponent(routeEditorRoute.id)}`, { method: "PATCH", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(routeDraft) });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload.error || "Không sửa được tuyến");
        } else if (routeEditorMode === "delete" && routeEditorRoute) {
          const response = await fetch(`/api/routes/${encodeURIComponent(routeEditorRoute.id)}/archive`, { method: "POST", headers: { Accept: "application/json" } });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload.error || "Không xóa được tuyến");
          if (selectedRoute?.id === routeEditorRoute.id) setSelectedRoute(null);
        }
        setRouteEditorMode(null); setRouteEditorRoute(null); router.refresh();
      } catch (error) { setMessage(error instanceof Error ? error.message : "Không lưu được tuyến"); }
    });
  }

  function submitCustomerEditor() {
    if (!customerEditorMode) return;
    startSaving(async () => {
      try {
        setMessage(null);
        if (customerEditorMode === "create") {
          if (!selectedRoute) throw new Error("Cần chọn tuyến gốc");
          if (!customerDraft.customerName.trim()) throw new Error("Cần nhập tên khách");
          const response = await fetch("/api/route-customers", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ ...customerDraft, routeId: selectedRoute.id }) });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload.error || "Không thêm được khách tuyến");
        } else if (customerEditorMode === "edit" && customerEditorCustomer) {
          if (!customerDraft.customerName.trim()) throw new Error("Cần nhập tên khách");
          const response = await fetch(`/api/route-customers/${encodeURIComponent(customerEditorCustomer.id)}`, { method: "PATCH", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(customerDraft) });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload.error || "Không sửa được khách tuyến");
        } else if (customerEditorMode === "delete" && customerEditorCustomer) {
          const response = await fetch(`/api/route-customers/${encodeURIComponent(customerEditorCustomer.id)}/archive`, { method: "POST", headers: { Accept: "application/json" } });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload.error || "Không xóa được khách tuyến");
          if (selectedCustomer?.id === customerEditorCustomer.id) setSelectedCustomer(null);
        }
        setCustomerEditorMode(null); setCustomerEditorCustomer(null); router.refresh();
      } catch (error) { setMessage(error instanceof Error ? error.message : "Không lưu được khách tuyến"); }
    });
  }

  function openSession(route: RouteItem) {
    const sessionDate = todayDateOnly();
    setSelectedRoute(route);
    setMessage(null);
    startSaving(async () => {
      try {
        const response = await fetch("/api/backend/mcp-day/open-session", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ routeId: route.id, sessionDate, owner: route.salesOwner || "Sale" }) });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Không mở được phiên MCP");
        router.push(`/visits?routeId=${encodeURIComponent(route.id)}&date=${encodeURIComponent(sessionDate)}`);
      } catch (error) { setMessage(error instanceof Error ? error.message : "Không mở được phiên MCP"); }
    });
  }

  return (
    <AppShell activeHref={activeHref}>
      <PageHeader eyebrow="Tuyến gốc" title="Tuyến gốc" subtitle="Quản lý master tuyến: tạo, sửa, xóa dứt điểm, quản lý khách rồi mở phiên theo ngày."><button className="button primary" type="button" onClick={openRouteCreate}>Tạo tuyến</button></PageHeader>
      <FilterBar filters={[{ label: "Tuyến", value: String(routesData.routes.length) }, { label: "Đang chọn", value: selectedRoute?.name ?? "Chưa chọn" }, { label: "Khách tuyến", value: selectedRoute ? String(selectedCustomers.length) : "-" }, { label: "Cần GPS", value: selectedRoute ? String(gpsCustomers.length) : "-" }]} />
      {message && !routeEditorMode && !customerEditorMode ? <section className="empty-inline"><strong>{message}</strong></section> : null}
      <section className="dashboard-section"><div className="dashboard-section-head"><h2>Tuyến gốc</h2><span>{selectedRoute ? `Đã chọn: ${selectedRoute.name}` : "Chưa chọn tuyến"}</span></div><div className="mcp-status-chips" role="tablist" aria-label="Tuyến gốc"><button className={tab === "routes" ? "active" : ""} type="button" onClick={() => setTab("routes")}>Tuyến <b>{routesData.routes.length}</b></button><button className={tab === "customers" ? "active" : ""} type="button" onClick={() => setTab("customers")}>Khách tuyến <b>{selectedRoute ? selectedCustomers.length : 0}</b></button><button className={tab === "gps" ? "active" : ""} type="button" onClick={() => setTab("gps")}>Cần GPS <b>{selectedRoute ? gpsCustomers.length : 0}</b></button><button className={tab === "open" ? "active" : ""} type="button" onClick={() => setTab("open")}>Chuẩn bị phiên <b>{openRoutes.length}</b></button></div></section>
      {tab === "routes" ? routesData.routes.length > 0 ? <div className="mcp-line-list">{routesData.routes.map((route) => <RouteCard key={route.id} route={route} selected={selectedRoute?.id === route.id} saving={saving} onSelect={chooseRoute} onOpenSession={openSession} onEdit={openRouteEdit} onDelete={openRouteDelete} />)}</div> : <EmptyPanel title="Chưa có tuyến" hint="Bấm Tạo tuyến để thêm tuyến gốc mới." /> : null}
      {tab === "customers" ? !selectedRoute ? <EmptyPanel title="Chọn một tuyến" hint="Anh chọn tuyến gốc trước, rồi hệ thống mới hiện khách thuộc tuyến đó." /> : <div className="mcp-line-list"><button className="button primary" type="button" onClick={openCustomerCreate} disabled={saving}>Thêm khách vào tuyến</button>{selectedCustomers.length > 0 ? selectedCustomers.map((customer) => <CustomerCard key={customer.id} customer={customer} onSelect={setSelectedCustomer} onEdit={openCustomerEdit} onDelete={openCustomerDelete} />) : <EmptyPanel title="Tuyến chưa có khách" hint="Bấm Thêm khách vào tuyến để tạo khách gốc." />}<button className="button primary" type="button" disabled={saving} onClick={() => openSession(selectedRoute)}>{saving ? "Đang mở phiên..." : "Mở phiên hôm nay"}</button></div> : null}
      {tab === "gps" ? !selectedRoute ? <EmptyPanel title="Chọn một tuyến" hint="Anh chọn tuyến trước để xem khách cần GPS." /> : gpsCustomers.length > 0 ? <div className="mcp-line-list">{gpsCustomers.map((customer) => <CustomerCard key={customer.id} customer={customer} onSelect={setSelectedCustomer} onEdit={openCustomerEdit} onDelete={openCustomerDelete} />)}</div> : <EmptyPanel title="GPS đã ổn" hint="Tuyến đang chọn không có khách cần bổ sung GPS." /> : null}
      {tab === "open" ? openRoutes.length > 0 ? <div className="mcp-line-list">{openRoutes.map((route) => <RouteCard key={route.id} route={route} selected={selectedRoute?.id === route.id} saving={saving} onSelect={chooseRoute} onOpenSession={openSession} onEdit={openRouteEdit} onDelete={openRouteDelete} />)}</div> : <EmptyPanel title="Không có tuyến đang chạy" hint="Chỉ tuyến đang chạy hoặc cần theo dõi mới dùng để chuẩn bị phiên." /> : null}
      <CustomerSheet customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
      <RouteEditSheet mode={routeEditorMode} route={routeEditorRoute} draft={routeDraft} saving={saving} message={message} onDraftChange={updateRouteDraft} onClose={closeRouteEditor} onSubmit={submitRouteEditor} />
      <CustomerEditSheet mode={customerEditorMode} customer={customerEditorCustomer} route={selectedRoute} draft={customerDraft} saving={saving} message={message} onDraftChange={updateCustomerDraft} onClose={closeCustomerEditor} onSubmit={submitCustomerEditor} />
    </AppShell>
  );
}
