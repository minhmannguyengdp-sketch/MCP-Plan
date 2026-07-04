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
import { McpLineCard } from "./McpLineCard";
import { mcpCustomerActionDescription, mcpCustomerActionLabel, type McpCustomerAction } from "./mcp-customer-actions";
import { MCP_SESSION_SNAPSHOT_RULES } from "./mcp-session-contract";
import { createApiClient } from "@/lib/api/api-client";

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

function StartSessionSheet({ route, onClose, onStart }: { route: RouteItem | null; onClose: () => void; onStart: () => void }) {
  return (
    <BottomSheet
      open={Boolean(route)}
      onClose={onClose}
      title={route ? `Mở phiên MCP: ${route.name}` : "Mở phiên MCP"}
      description={route ? `${route.area} · ${route.salesOwner}` : undefined}
      footer={
        <div className="sheet-action-grid">
          <button className="button primary" type="button" onClick={onStart}>Mở phiên ngay</button>
          <button className="button" type="button">Xem điểm bán trong tuyến</button>
          <button className="button" type="button" onClick={onClose}>Đóng</button>
        </div>
      }
    >
      {route ? (
        <div className="route-sheet-content">
          <div className="route-focus-card">
            <span>Route Master</span>
            <strong>{routeCompletion(route)}</strong>
            <small>{route.visitedCustomers}/{route.plannedCustomers} điểm bán · {route.orderCount} đơn</small>
          </div>
          <div className="grid">
            <div className="metric-row"><span>Trạng thái</span><strong>{routeStatusLabel(route.status)}</strong></div>
            <div className="metric-row"><span>Lần ghé cuối</span><strong>{route.lastVisitDate}</strong></div>
            <div className="metric-row"><span>Sale</span><strong>{route.salesOwner}</strong></div>
          </div>
          <div className="sheet-note-card">
            <h3>Tạo snapshot ngày</h3>
            <p>Mở phiên MCP sẽ tạo Daily Session và snapshot khách. Sửa tuyến gốc sau đó không tự động sửa snapshot đã mở.</p>
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
      footer={
        <div className="sheet-action-grid">
          {mapsUrl ? <a className="button primary" href={mapsUrl} target="_blank" rel="noreferrer">Mở Google Maps</a> : null}
          <button className="button primary" type="button">Lưu GPS hiện tại</button>
          <button className="button" type="button">Đổi thứ tự ghé</button>
          <button className="button" type="button">Sửa thông tin khách</button>
          <button className="button" type="button">Ẩn khỏi tuyến</button>
          <button className="button" type="button" onClick={onClose}>Đóng</button>
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
            <div className="metric-row"><span>Liên hệ</span><strong>{customer.contactName}</strong></div>
            <div className="metric-row"><span>Khu vực</span><strong>{customer.area}</strong></div>
            <div className="metric-row"><span>Thứ tự ghé</span><strong>{customer.sortOrder}</strong></div>
            <div className="metric-row"><span>Cập nhật GPS</span><strong>{customer.gps?.updatedAt ?? "Chưa có"}</strong></div>
          </div>
          <div className="sheet-note-card">
            <h3>Quy tắc khách trong tuyến</h3>
            <p>Đây là danh sách mặc định của tuyến. Ẩn khỏi tuyến không xóa dữ liệu gốc. Khi mở phiên ngày, danh sách này được copy thành session customer snapshot.</p>
          </div>
        </div>
      ) : null}
    </BottomSheet>
  );
}

function CustomerActionSheet({
  selection,
  saving,
  message,
  onClose,
  onSubmit
}: {
  selection: { line: McpDayLine; action: McpCustomerAction } | null;
  saving: boolean;
  message: string | null;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <BottomSheet
      open={Boolean(selection)}
      onClose={onClose}
      title={selection ? mcpCustomerActionLabel(selection.action) : "Hành động MCP"}
      description={selection ? selection.line.accountName : undefined}
      footer={
        <div className="sheet-action-grid">
          <button className="button primary" type="button" onClick={onSubmit} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu kết quả"}
          </button>
          <button className="button" type="button" disabled={saving}>Chuyển sang form chi tiết</button>
          <button className="button" type="button" onClick={onClose} disabled={saving}>Đóng</button>
        </div>
      }
    >
      {selection ? (
        <div className="visit-sheet-content">
          <div className="visit-focus-card">
            <span>Gắn với Session Customer Snapshot</span>
            <strong>{mcpCustomerActionLabel(selection.action)}</strong>
            <small>{mcpCustomerActionDescription(selection.action)}</small>
          </div>
          <div className="grid">
            <div className="metric-row"><span>Điểm bán</span><strong>{selection.line.accountName}</strong></div>
            <div className="metric-row"><span>Khu vực</span><strong>{selection.line.area}</strong></div>
            <div className="metric-row"><span>Thứ tự ghé</span><strong>{selection.line.sortOrder}</strong></div>
            <div className="metric-row"><span>Trạng thái</span><strong>{lineStatusLabel(selection.line.status)}</strong></div>
          </div>
          <div className="sheet-note-card">
            <h3>Không tách rời MCP</h3>
            <p>Đơn hàng, test sản phẩm, báo cáo thị trường và việc cần làm được tạo từ customer card trong phiên. Sau này form chi tiết sẽ ghi kèm sessionCustomerId.</p>
            {message ? <p className="page-subtitle">{message}</p> : null}
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
      title={line ? line.accountName : "Xử lý điểm bán"}
      description={line ? `${line.area} · ${sourceLabel(line.source)}` : undefined}
      footer={line ? (
        <div className="sheet-action-grid">
          <button className="button primary" type="button">Check-in</button>
          <button className="button" type="button" onClick={() => onAction(line, "order")}>Có đơn</button>
          <button className="button" type="button" onClick={() => onAction(line, "test")}>Có test</button>
          <button className="button" type="button">Không mua</button>
          <button className="button" type="button" onClick={() => onAction(line, "market_report")}>Báo cáo</button>
          <button className="button" type="button" onClick={() => onAction(line, "follow_up")}>Tạo việc</button>
          <button className="button" type="button" onClick={onClose}>Đóng</button>
        </div>
      ) : undefined}
    >
      {line ? (
        <div className="visit-sheet-content">
          <div className="visit-focus-card">
            <span>Session Customer Snapshot</span>
            <strong>{lineStatusLabel(line.status)}</strong>
            <small>{line.hasOrder ? "Đã có đơn" : "Chưa có đơn"}</small>
          </div>
          <div className="grid">
            <div className="metric-row"><span>Thứ tự ghé</span><strong>{line.sortOrder}</strong></div>
            <div className="metric-row"><span>Nguồn</span><strong>{sourceLabel(line.source)}</strong></div>
            <div className="metric-row"><span>Kết quả</span><strong>{line.result ?? "Chưa ghi"}</strong></div>
            <div className="metric-row"><span>Ghi chú</span><strong>{line.note}</strong></div>
          </div>
          <div className="sheet-note-card">
            <h3>Logic MCP</h3>
            <p>Thao tác ở đây ghi vào phiên ngày: visit result, order, test, báo cáo hoặc follow-up. Không hard delete khách khỏi phiên.</p>
          </div>
        </div>
      ) : null}
    </BottomSheet>
  );
}

function RouteCard({ route, onSelect }: { route: RouteItem; onSelect: (route: RouteItem) => void }) {
  return (
    <OperationalListCard
      leading={<span>{routeCompletion(route)}</span>}
      eyebrow={`${route.area} · ${route.salesOwner}`}
      title={route.name}
      description={`${route.visitedCustomers}/${route.plannedCustomers} điểm đã ghé · ${route.orderCount} đơn`}
      badge={<span className={routeStatusClass(route.status)}>{routeStatusLabel(route.status)}</span>}
      meta={[`Lần ghé cuối ${route.lastVisitDate}`, `${route.plannedCustomers} điểm bán`]}
      actions={[{ label: "Mở", tone: "primary", onClick: () => onSelect(route) }]}
    />
  );
}

function RouteCustomerCard({ customer, onSelect }: { customer: RouteCustomerItem; onSelect: (customer: RouteCustomerItem) => void }) {
  return (
    <OperationalListCard
      leading={<span>#{customer.sortOrder}</span>}
      eyebrow={`${customer.area} · ${customer.contactName}`}
      title={customer.accountName}
      description={customer.routeName}
      badge={<span className={routeCustomerStatusClass(customer.status)}>{routeCustomerStatusLabel(customer.status)}</span>}
      meta={[gpsLabel(customer), customer.note]}
      actions={[{ label: "Sửa", tone: "primary", onClick: () => onSelect(customer) }]}
    />
  );
}

function ResultCard({ result }: { result: McpDayResult }) {
  return (
    <OperationalListCard
      leading={<span>{result.startTime}</span>}
      eyebrow={`${result.startTime} · ${result.endTime}`}
      title={result.accountName}
      description={result.result}
      badge={<span className={result.hasOrder ? "dashboard-status status-good" : "dashboard-status status-watch"}>{result.hasOrder ? "Có đơn" : "Không đơn"}</span>}
      meta={[result.nextAction]}
    />
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
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSavingAction, startSavingAction] = useTransition();
  const router = useRouter();
  const run = mcpDayData.run;

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
          await api.createMcpDayFollowup({
            sessionCustomerId,
            title: `Theo dõi ${selectedAction.line.accountName}`,
            followupType: "general",
            priority: "medium",
            owner: run.owner,
            note: `Tạo việc từ MCP Day cho ${selectedAction.line.accountName}`
          });
        } else {
          const resultType = selectedAction.action === "market_report" ? "report" : selectedAction.action;

          await api.createMcpDayResult({
            sessionCustomerId,
            resultType,
            note: mcpCustomerActionDescription(selectedAction.action),
            hasOrder: resultType === "order" ? true : undefined,
            hasTest: resultType === "test" ? true : undefined,
            hasReport: resultType === "report" ? true : undefined
          });
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
      <PageHeader
        eyebrow="MCP Route Flow"
        title="MCP tuyến bán hàng"
        subtitle="Chọn ngày, chọn tuyến, mở phiên, xử lý điểm bán và tổng kết tuyến."
      >
        <span className="badge">{sessionStatus}</span>
      </PageHeader>

      <FilterBar
        filters={[
          { label: "Ngày", value: run.date },
          { label: "Tuyến đang mở", value: run.routeName },
          { label: "Sale", value: run.owner },
          { label: "Mở lúc", value: run.openedAt }
        ]}
      />

      <CompactKpiStrip items={mcpDayData.kpis} />

      <section className="dashboard-section">
        <div className="dashboard-section-head"><h2>1. Chọn tuyến</h2><span>{routesData.routes.length} tuyến</span></div>
        <div className="mcp-line-list">
          {routesData.routes.map((route) => <RouteCard key={route.id} route={route} onSelect={setSelectedRoute} />)}
        </div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section-head"><h2>2. Khách trong tuyến + GPS</h2><span>{routeCustomersData.customers.length} khách</span></div>
        <div className="mcp-line-list">
          {routeCustomersData.customers.map((customer) => <RouteCustomerCard key={customer.id} customer={customer} onSelect={setSelectedRouteCustomer} />)}
        </div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section-head"><h2>3. Khách trong phiên ngày</h2><span>{mcpDayData.lines.length} điểm bán</span></div>
        <div className="mcp-line-list">
          {mcpDayData.lines.map((line) => (
            <McpLineCard key={line.id} line={line} onOpen={setSelectedLine} onAction={openCustomerAction} />
          ))}
        </div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section-head"><h2>4. Kết quả đã ghé</h2><span>{mcpDayData.results.length} kết quả</span></div>
        <div className="mcp-line-list">
          {mcpDayData.results.map((result) => <ResultCard key={result.id} result={result} />)}
        </div>
      </section>

      <section className="card">
        <h2 className="panel-title">5. Session snapshot contract</h2>
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
      <CustomerActionSheet
        selection={selectedAction}
        saving={isSavingAction}
        message={actionMessage}
        onClose={() => {
          if (!isSavingAction) {
            setActionMessage(null);
            setSelectedAction(null);
          }
        }}
        onSubmit={submitCustomerAction}
      />
    </AppShell>
  );
}
