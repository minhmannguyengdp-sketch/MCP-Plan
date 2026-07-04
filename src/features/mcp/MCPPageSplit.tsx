"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CompactKpiStrip } from "@/ui/cards/CompactKpiStrip";
import { OperationalListCard } from "@/ui/cards/OperationalListCard";
import { FilterBar } from "@/ui/layout/FilterBar";
import { PageHeader } from "@/ui/layout/PageHeader";
import { BottomSheet } from "@/ui/overlay/BottomSheet";
import { AppShell } from "@/ui/shell/AppShell";
import type { DayLineSource, DayLineStatus, McpDayData, McpDayLine, McpDayResult } from "@/features/mcp-day/mcp-day.types";
import type { RouteCustomersData, RouteCustomerItem, RouteCustomerStatus } from "@/features/mcp/route-customers.types";
import { buildGoogleMapsUrl } from "@/features/mcp/route-customers.types";
import type { RoutesData, RouteItem, RouteStatus } from "@/features/routes/routes.types";
import { createApiClient } from "@/lib/api/api-client";
import { McpLineCard } from "./McpLineCard";
import { mcpCustomerActionDescription, mcpCustomerActionLabel, type McpCustomerAction } from "./mcp-customer-actions";

type SessionTab = "customers" | "results" | "added" | "followups";

function routeStatusLabel(status: RouteStatus) {
  if (status === "active") return "Đang chạy";
  if (status === "watch") return "Cần theo dõi";
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

function sourceLabel(source: DayLineSource) {
  if (source === "planned") return "Kế hoạch";
  if (source === "added") return "Phát sinh";
  return "Đồng bộ";
}

function lineStatusLabel(status: DayLineStatus) {
  if (status === "pending") return "Chờ ghé";
  if (status === "visited") return "Đã ghé";
  if (status === "skipped") return "Bỏ qua";
  return "Hủy";
}

function routeCompletion(route: RouteItem) {
  if (route.plannedCustomers === 0) return "-";
  return `${Math.round((route.visitedCustomers / route.plannedCustomers) * 100)}%`;
}

function gpsLabel(customer: RouteCustomerItem) {
  if (!customer.gps) return "Chưa có GPS";
  return `${customer.gps.lat.toFixed(5)}, ${customer.gps.lng.toFixed(5)}`;
}

function hasLineResult(line: McpDayLine) {
  return Boolean(line.visitId || line.result || line.hasOrder || line.hasTest || line.hasReport || Number(line.followupCount || 0) > 0 || line.status === "visited");
}

function EmptyPanel({ title, hint }: { title: string; hint: string }) {
  return <div className="empty-inline"><strong>{title}</strong><p className="page-subtitle">{hint}</p></div>;
}

function StartSessionSheet({ route, onClose, onStart }: { route: RouteItem | null; onClose: () => void; onStart: () => void }) {
  return (
    <BottomSheet open={Boolean(route)} onClose={onClose} title={route ? `Mở phiên MCP: ${route.name}` : "Mở phiên MCP"} description={route ? `${route.area} · ${route.salesOwner}` : undefined} footer={<div className="sheet-action-grid"><button className="button primary" type="button" onClick={onStart}>Mở phiên ngày</button><button className="button" type="button" onClick={onClose}>Đóng</button></div>}>
      {route ? <div className="route-sheet-content"><div className="route-focus-card"><span>Route Master</span><strong>{routeCompletion(route)}</strong><small>{route.visitedCustomers}/{route.plannedCustomers} điểm bán · {route.orderCount} đơn</small></div><div className="grid"><div className="metric-row"><span>Trạng thái</span><strong>{routeStatusLabel(route.status)}</strong></div><div className="metric-row"><span>Lần ghé cuối</span><strong>{route.lastVisitDate}</strong></div><div className="metric-row"><span>Sale</span><strong>{route.salesOwner}</strong></div></div><div className="sheet-note-card"><h3>Tạo snapshot ngày</h3><p>Mở phiên MCP sẽ tạo Daily Session và snapshot khách. Sửa tuyến gốc sau đó không tự động sửa snapshot đã mở.</p></div></div> : null}
    </BottomSheet>
  );
}

function RouteCustomerSheet({ customer, onClose }: { customer: RouteCustomerItem | null; onClose: () => void }) {
  const mapsUrl = customer ? buildGoogleMapsUrl(customer) : undefined;
  return (
    <BottomSheet open={Boolean(customer)} onClose={onClose} title={customer ? customer.accountName : "Khách trong tuyến"} description={customer ? `${customer.routeName} · STT ${customer.sortOrder}` : undefined} footer={<div className="sheet-action-grid">{mapsUrl ? <a className="button primary" href={mapsUrl} target="_blank" rel="noreferrer">Mở Google Maps</a> : null}<button className="button" type="button" onClick={onClose}>Đóng</button></div>}>
      {customer ? <div className="outlet-sheet-content"><div className="outlet-focus-card"><span>Route Customer Master</span><strong>{routeCustomerStatusLabel(customer.status)}</strong><small>{gpsLabel(customer)}</small></div><div className="grid"><div className="metric-row"><span>Liên hệ</span><strong>{customer.contactName}</strong></div><div className="metric-row"><span>Khu vực</span><strong>{customer.area}</strong></div><div className="metric-row"><span>Thứ tự ghé</span><strong>{customer.sortOrder}</strong></div><div className="metric-row"><span>Cập nhật GPS</span><strong>{customer.gps?.updatedAt ?? "Chưa có"}</strong></div></div><div className="sheet-note-card"><h3>Quy tắc khách trong tuyến</h3><p>Đây là danh sách mặc định của tuyến. Khi mở phiên ngày, danh sách này được copy thành session customer snapshot.</p></div></div> : null}
    </BottomSheet>
  );
}

function CustomerActionSheet({ selection, saving, message, onClose, onSubmit }: { selection: { line: McpDayLine; action: McpCustomerAction } | null; saving: boolean; message: string | null; onClose: () => void; onSubmit: () => void }) {
  return (
    <BottomSheet open={Boolean(selection)} onClose={onClose} title={selection ? mcpCustomerActionLabel(selection.action) : "Hành động MCP"} description={selection ? selection.line.accountName : undefined} footer={<div className="sheet-action-grid"><button className="button primary" type="button" onClick={onSubmit} disabled={saving}>{saving ? "Đang lưu..." : "Ghi vào phiên"}</button><button className="button" type="button" onClick={onClose} disabled={saving}>Đóng</button></div>}>
      {selection ? <div className="visit-sheet-content"><div className="visit-focus-card"><span>Session Customer Snapshot</span><strong>{mcpCustomerActionLabel(selection.action)}</strong><small>{mcpCustomerActionDescription(selection.action)}</small></div><div className="grid"><div className="metric-row"><span>Điểm bán</span><strong>{selection.line.accountName}</strong></div><div className="metric-row"><span>Khu vực</span><strong>{selection.line.area}</strong></div><div className="metric-row"><span>Session customer</span><strong>{selection.line.sessionCustomerId || selection.line.id}</strong></div><div className="metric-row"><span>Trạng thái</span><strong>{lineStatusLabel(selection.line.status)}</strong></div></div><div className="sheet-note-card"><h3>Xác nhận ghi dữ liệu</h3><p>Thao tác này ghi vào phiên MCP ngày hiện tại, không sửa tuyến master.</p>{message ? <p className="page-subtitle">{message}</p> : null}</div></div> : null}
    </BottomSheet>
  );
}

function CustomerSheet({ line, onClose, onAction }: { line: McpDayLine | null; onClose: () => void; onAction: (line: McpDayLine, action: McpCustomerAction) => void }) {
  return (
    <BottomSheet open={Boolean(line)} onClose={onClose} title={line ? line.accountName : "Xử lý điểm bán"} description={line ? `${line.area} · ${sourceLabel(line.source)}` : undefined} footer={line ? <div className="sheet-action-grid"><button className="button primary" type="button" onClick={() => onAction(line, "order")}>Ghi có đơn</button><button className="button" type="button" onClick={() => onAction(line, "test")}>Ghi có test</button><button className="button" type="button" onClick={() => onAction(line, "market_report")}>Ghi báo cáo</button><button className="button" type="button" onClick={() => onAction(line, "follow_up")}>Tạo follow-up</button><button className="button" type="button" onClick={onClose}>Đóng</button></div> : undefined}>
      {line ? <div className="visit-sheet-content"><div className="visit-focus-card"><span>Session Customer Snapshot</span><strong>{lineStatusLabel(line.status)}</strong><small>{line.sessionCustomerId || line.id}</small></div><div className="grid"><div className="metric-row"><span>Thứ tự ghé</span><strong>{line.sortOrder}</strong></div><div className="metric-row"><span>Nguồn</span><strong>{sourceLabel(line.source)}</strong></div><div className="metric-row"><span>Đơn</span><strong>{line.hasOrder ? "Đã có" : "Chưa có"}</strong></div><div className="metric-row"><span>Test</span><strong>{line.hasTest ? "Đã có" : "Chưa có"}</strong></div><div className="metric-row"><span>Báo cáo</span><strong>{line.hasReport ? "Đã có" : "Chưa có"}</strong></div><div className="metric-row"><span>Follow-up</span><strong>{Number(line.followupCount || 0)}</strong></div><div className="metric-row"><span>Kết quả</span><strong>{line.result ?? "Chưa ghi"}</strong></div></div><div className="sheet-note-card"><h3>Logic MCP</h3><p>Thao tác ở đây ghi vào phiên ngày. Không sửa dữ liệu tuyến master.</p></div></div> : null}
    </BottomSheet>
  );
}

function RouteCard({ route, onSelect }: { route: RouteItem; onSelect: (route: RouteItem) => void }) {
  return <OperationalListCard leading={<span>{routeCompletion(route)}</span>} eyebrow={`${route.area} · ${route.salesOwner}`} title={route.name} description={`${route.visitedCustomers}/${route.plannedCustomers} điểm đã ghé · ${route.orderCount} đơn`} badge={<span className={routeStatusClass(route.status)}>{routeStatusLabel(route.status)}</span>} meta={[`Lần ghé cuối ${route.lastVisitDate}`, `${route.plannedCustomers} điểm bán`]} actions={[{ label: "Mở phiên", tone: "primary", onClick: () => onSelect(route) }]} />;
}

function RouteCustomerCard({ customer, onSelect }: { customer: RouteCustomerItem; onSelect: (customer: RouteCustomerItem) => void }) {
  return <OperationalListCard leading={<span>#{customer.sortOrder}</span>} eyebrow={`${customer.area} · ${customer.contactName}`} title={customer.accountName} description={customer.routeName} badge={<span className={routeCustomerStatusClass(customer.status)}>{routeCustomerStatusLabel(customer.status)}</span>} meta={[gpsLabel(customer), customer.note]} actions={[{ label: "Chi tiết", tone: "primary", onClick: () => onSelect(customer) }]} />;
}

function ResultCard({ result }: { result: McpDayResult }) {
  return <OperationalListCard leading={<span>{result.startTime}</span>} eyebrow={`${result.startTime} · ${result.endTime}`} title={result.accountName} description={result.result} badge={<span className={result.hasOrder ? "dashboard-status status-good" : "dashboard-status status-watch"}>{result.hasOrder ? "Có đơn" : result.nextAction}</span>} meta={[result.hasTest ? "Có test" : "Chưa test", result.hasReport ? "Có báo cáo" : "Chưa báo cáo", `Follow-up ${Number(result.followupCount || 0)}`]} />;
}

function SessionLineList({ lines, onOpen, onAction }: { lines: McpDayLine[]; onOpen: (line: McpDayLine) => void; onAction: (line: McpDayLine, action: McpCustomerAction) => void }) {
  if (lines.length === 0) return <EmptyPanel title="Chưa có khách phù hợp" hint="Tab này sẽ có dữ liệu khi phiên ngày phát sinh đúng trạng thái." />;
  return <div className="mcp-line-list">{lines.map((line) => <McpLineCard key={line.id} line={line} onOpen={onOpen} onAction={onAction} />)}</div>;
}

export function MCPPage({ activeHref = "/visits", routesData, mcpDayData, routeCustomersData }: { activeHref?: string; routesData: RoutesData; mcpDayData: McpDayData; routeCustomersData: RouteCustomersData }) {
  const [selectedRoute, setSelectedRoute] = useState<RouteItem | null>(null);
  const [selectedLine, setSelectedLine] = useState<McpDayLine | null>(null);
  const [selectedRouteCustomer, setSelectedRouteCustomer] = useState<RouteCustomerItem | null>(null);
  const [selectedAction, setSelectedAction] = useState<{ line: McpDayLine; action: McpCustomerAction } | null>(null);
  const [sessionStatus, setSessionStatus] = useState(mcpDayData.run.status);
  const [sessionTab, setSessionTab] = useState<SessionTab>("customers");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSavingAction, startSavingAction] = useTransition();
  const router = useRouter();
  const run = mcpDayData.run;
  const isVisits = activeHref === "/visits";
  const resultLines = mcpDayData.lines.filter(hasLineResult);
  const addedLines = mcpDayData.lines.filter((line) => line.source === "added");
  const followupLines = mcpDayData.lines.filter((line) => Number(line.followupCount || 0) > 0);

  function openCustomerAction(line: McpDayLine, action: McpCustomerAction) {
    setSelectedAction({ line, action });
  }

  function submitCustomerAction() {
    if (!selectedAction) return;
    const sessionCustomerId = selectedAction.line.sessionCustomerId || selectedAction.line.id;
    const api = createApiClient();
    startSavingAction(async () => {
      try {
        setActionMessage(null);
        if (selectedAction.action === "follow_up") {
          await api.createMcpDayFollowup({ sessionCustomerId, title: `Theo dõi ${selectedAction.line.accountName}`, followupType: "general", priority: "medium", owner: run.owner, note: `Tạo việc từ MCP Day cho ${selectedAction.line.accountName}` });
        } else {
          const resultType = selectedAction.action === "market_report" ? "report" : selectedAction.action;
          await api.createMcpDayResult({ sessionCustomerId, resultType, note: mcpCustomerActionDescription(selectedAction.action), hasOrder: resultType === "order" ? true : undefined, hasTest: resultType === "test" ? true : undefined, hasReport: resultType === "report" ? true : undefined });
        }
        setSelectedAction(null);
        setSelectedLine(null);
        router.refresh();
      } catch (error) {
        setActionMessage(error instanceof Error ? error.message : "Không lưu được hành động MCP");
      }
    });
  }

  return (
    <AppShell activeHref={activeHref}>
      <PageHeader eyebrow={isVisits ? "MCP Session" : "MCP Master"} title={isVisits ? "Phiên MCP ngày" : "MCP tuyến master"} subtitle={isVisits ? "Xử lý khách trong phiên ngày, ghi đơn/test/báo cáo/follow-up theo session snapshot." : "Quản lý tuyến gốc, khách tuyến và GPS trước khi mở phiên ngày."}>
        <span className="badge">{isVisits ? sessionStatus : `${routesData.routes.length} tuyến`}</span>
      </PageHeader>

      {isVisits ? <>
        <FilterBar filters={[{ label: "Ngày", value: run.date }, { label: "Tuyến", value: run.routeName }, { label: "Sale", value: run.owner }, { label: "Mở lúc", value: run.openedAt }]} />
        <section className="mcp-session-hero"><div><span>Phiên đang mở</span><h2>{run.routeName} · {run.date}</h2><p>{run.owner} · {mcpDayData.lines.length} khách trong phiên</p></div><strong>{sessionStatus}</strong></section>
        <CompactKpiStrip items={mcpDayData.kpis} />
        <section className="dashboard-section"><div className="dashboard-section-head"><h2>Khách trong phiên ngày</h2><span>{mcpDayData.lines.length} điểm bán</span></div><div className="mcp-status-chips" role="tablist" aria-label="Lọc phiên MCP ngày"><button className={sessionTab === "customers" ? "active" : ""} type="button" onClick={() => setSessionTab("customers")}>Khách phiên <b>{mcpDayData.lines.length}</b></button><button className={sessionTab === "results" ? "active" : ""} type="button" onClick={() => setSessionTab("results")}>Kết quả <b>{mcpDayData.results.length || resultLines.length}</b></button><button className={sessionTab === "added" ? "active" : ""} type="button" onClick={() => setSessionTab("added")}>Phát sinh <b>{addedLines.length}</b></button><button className={sessionTab === "followups" ? "active" : ""} type="button" onClick={() => setSessionTab("followups")}>Follow-up <b>{followupLines.length}</b></button></div></section>
        {sessionTab === "customers" ? <SessionLineList lines={mcpDayData.lines} onOpen={setSelectedLine} onAction={openCustomerAction} /> : null}
        {sessionTab === "results" ? (mcpDayData.results.length > 0 ? <div className="mcp-line-list">{mcpDayData.results.map((result) => <ResultCard key={result.id} result={result} />)}</div> : <SessionLineList lines={resultLines} onOpen={setSelectedLine} onAction={openCustomerAction} />) : null}
        {sessionTab === "added" ? <SessionLineList lines={addedLines} onOpen={setSelectedLine} onAction={openCustomerAction} /> : null}
        {sessionTab === "followups" ? <SessionLineList lines={followupLines} onOpen={setSelectedLine} onAction={openCustomerAction} /> : null}
      </> : <>
        <section className="dashboard-section"><div className="dashboard-section-head"><h2>Tuyến master</h2><span>{routesData.routes.length} tuyến</span></div><div className="mcp-line-list">{routesData.routes.map((route) => <RouteCard key={route.id} route={route} onSelect={setSelectedRoute} />)}</div></section>
        <section className="dashboard-section"><div className="dashboard-section-head"><h2>Khách tuyến + GPS</h2><span>{routeCustomersData.customers.length} khách</span></div><div className="mcp-line-list">{routeCustomersData.customers.map((customer) => <RouteCustomerCard key={customer.id} customer={customer} onSelect={setSelectedRouteCustomer} />)}</div></section>
      </>}

      <StartSessionSheet route={selectedRoute} onClose={() => setSelectedRoute(null)} onStart={() => { setSessionStatus("opened"); setSelectedRoute(null); }} />
      <RouteCustomerSheet customer={selectedRouteCustomer} onClose={() => setSelectedRouteCustomer(null)} />
      <CustomerSheet line={selectedLine} onClose={() => setSelectedLine(null)} onAction={openCustomerAction} />
      <CustomerActionSheet selection={selectedAction} saving={isSavingAction} message={actionMessage} onClose={() => { if (!isSavingAction) { setActionMessage(null); setSelectedAction(null); } }} onSubmit={submitCustomerAction} />
    </AppShell>
  );
}
