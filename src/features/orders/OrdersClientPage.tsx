"use client";

import { useMemo, useState } from "react";
import type { RouteCustomerItem } from "@/features/mcp/route-customers.types";
import type { ApiResult, OrderDto } from "@/lib/api/api.types";
import { CompactKpiStrip } from "@/ui/cards/CompactKpiStrip";
import { OperationalListCard } from "@/ui/cards/OperationalListCard";
import { FilterBar } from "@/ui/layout/FilterBar";
import { PageHeader } from "@/ui/layout/PageHeader";
import { BottomSheet } from "@/ui/overlay/BottomSheet";
import { AppShell } from "@/ui/shell/AppShell";
import { SourceBadge } from "@/ui/status/SourceBadge";
import { OrderCreateSheet } from "./OrderCreateSheet";
import type { OrderSessionOption } from "./order-create.types";
import styles from "./OrdersClientPage.module.css";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

type SessionStatusRow = {
  id?: unknown;
  routeId?: unknown;
  routeName?: unknown;
  sessionDate?: unknown;
  status?: unknown;
  plannedCustomers?: unknown;
  visitedCustomers?: unknown;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function count(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizeSession(row: SessionStatusRow): OrderSessionOption | null {
  const id = text(row.id);
  const routeId = text(row.routeId);
  const routeName = text(row.routeName) || routeId;
  const sessionDate = text(row.sessionDate).slice(0, 10);
  const rawStatus = text(row.status).toLowerCase();
  const status = rawStatus === "active" ? "active" : rawStatus === "done" || rawStatus === "completed" ? "done" : null;
  if (!id || !routeId || !sessionDate || !status) return null;
  return {
    id,
    routeId,
    routeName,
    sessionDate,
    status,
    plannedCustomers: count(row.plannedCustomers),
    visitedCustomers: count(row.visitedCustomers)
  };
}

async function loadOrderSessions(customers: RouteCustomerItem[]): Promise<OrderSessionOption[]> {
  const routeIds = Array.from(new Set(customers.map((customer) => customer.routeId).filter(Boolean)));
  const responses = await Promise.all(routeIds.map(async (routeId) => {
    const query = new URLSearchParams({ routeId });
    const response = await fetch(`/api/backend/mcp-settings/session-status?${query.toString()}`, {
      cache: "no-store",
      headers: { Accept: "application/json" }
    });
    const payload = await response.json().catch(() => ({})) as {
      data?: { sessions?: SessionStatusRow[] };
      error?: string | { message?: string };
      detail?: string;
    };
    if (!response.ok) {
      const error = typeof payload.error === "string" ? payload.error : payload.error?.message;
      throw new Error(error || payload.detail || `Không tải được phiên của tuyến ${routeId}`);
    }
    return Array.isArray(payload.data?.sessions) ? payload.data.sessions : [];
  }));

  const sessions = new Map<string, OrderSessionOption>();
  responses.flat().forEach((row) => {
    const session = normalizeSession(row);
    if (session) sessions.set(session.id, session);
  });
  return Array.from(sessions.values()).sort((left, right) => {
    if (left.status !== right.status) return left.status === "active" ? -1 : 1;
    return `${right.sessionDate}-${right.routeName}`.localeCompare(`${left.sessionDate}-${left.routeName}`, "vi");
  });
}

function getStatusLabel(status: string) {
  if (status === "draft") return "Nháp";
  if (status === "confirmed") return "Đã chốt";
  if (status === "delivered") return "Đã giao";
  if (status === "cancelled") return "Hủy";
  return status;
}

function getStatusClass(status: string) {
  if (status === "delivered") return `${styles.status} ${styles.delivered}`;
  if (status === "confirmed") return `${styles.status} ${styles.confirmed}`;
  if (status === "draft") return `${styles.status} ${styles.draft}`;
  return `${styles.status} ${styles.cancelled}`;
}

function orderExportHref(order: OrderDto) {
  return `/api/backend/exports/orders.csv?orderId=${encodeURIComponent(order.id)}`;
}

function buildOrderKpis(orders: OrderDto[]) {
  const totalAmount = orders.reduce((sum, order) => sum + order.totalAmount, 0);
  const skuCount = orders.reduce((sum, order) => sum + order.skuCount, 0);
  const openOrders = orders.filter((order) => order.status !== "delivered" && order.status !== "cancelled").length;
  return [
    { label: "Đơn hàng", value: orders.length, hint: "Trong kỳ" },
    { label: "Doanh số", value: money.format(totalAmount), hint: "Tổng giá trị" },
    { label: "SKU", value: skuCount, hint: "Mặt hàng" },
    { label: "Chờ xử lý", value: openOrders, hint: "Chưa xong" }
  ];
}

function orderStatusSummary(orders: OrderDto[]) {
  return {
    draft: orders.filter((order) => order.status === "draft").length,
    confirmed: orders.filter((order) => order.status === "confirmed").length,
    delivered: orders.filter((order) => order.status === "delivered").length,
    cancelled: orders.filter((order) => order.status === "cancelled").length
  };
}

function OrderCard({ order, onSelect }: { order: OrderDto; onSelect: (order: OrderDto) => void }) {
  return (
    <OperationalListCard
      leading={<span>{order.skuCount}</span>}
      eyebrow={`${order.source} · ${order.date}`}
      title={`${order.code} · ${money.format(order.totalAmount)}`}
      description={order.accountName}
      badge={<strong className={getStatusClass(order.status)}>{getStatusLabel(order.status)}</strong>}
      meta={[`${order.routeName} · ${order.owner}`, `${order.quantity} sản phẩm`]}
      actions={[
        { label: "Xem", tone: "primary", onClick: () => onSelect(order) },
        { label: "Xuất đơn hàng", href: orderExportHref(order) }
      ]}
    />
  );
}

function OrderDetailSheet({ order, onClose }: { order: OrderDto | null; onClose: () => void }) {
  return (
    <BottomSheet
      open={Boolean(order)}
      onClose={onClose}
      title={order ? order.code : "Chi tiết đơn"}
      description={order ? `${order.accountName} · ${order.routeName}` : undefined}
      footer={<div className="sheet-action-grid">{order ? <a className="button primary" href={orderExportHref(order)}>Xuất đơn hàng</a> : null}<button className="button" type="button" onClick={onClose}>Đóng</button></div>}
    >
      {order ? (
        <div className="order-sheet-content">
          <div className="order-total-card"><span>Giá trị đơn</span><strong>{money.format(order.totalAmount)}</strong><small>{getStatusLabel(order.status)} · {order.source}</small></div>
          <div className="grid">
            <div className="metric-row"><span>Ngày</span><strong>{order.date}</strong></div>
            <div className="metric-row"><span>Nhân viên phụ trách</span><strong>{order.owner}</strong></div>
            <div className="metric-row"><span>SKU</span><strong>{order.skuCount}</strong></div>
            <div className="metric-row"><span>Số lượng</span><strong>{order.quantity}</strong></div>
          </div>
        </div>
      ) : null}
    </BottomSheet>
  );
}

export function OrdersClientPage({
  ordersResult,
  customers
}: {
  ordersResult: ApiResult<OrderDto[]>;
  customers: RouteCustomerItem[];
}) {
  const [selectedOrder, setSelectedOrder] = useState<OrderDto | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [sessions, setSessions] = useState<OrderSessionOption[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeDetail, setNoticeDetail] = useState<string | null>(null);
  const kpis = useMemo(() => buildOrderKpis(ordersResult.data), [ordersResult.data]);
  const openOrders = ordersResult.data.filter((order) => order.status !== "delivered" && order.status !== "cancelled").length;
  const statusSummary = useMemo(() => orderStatusSummary(ordersResult.data), [ordersResult.data]);

  async function openCreateOrder() {
    if (createLoading) return;
    setCreateLoading(true);
    setNotice(null);
    setNoticeDetail(null);
    try {
      const nextSessions = await loadOrderSessions(customers);
      setSessions(nextSessions);
      setCreateOpen(true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không tải được danh sách phiên.");
      setNoticeDetail("Form chưa được mở để tránh hiển thị sai khách hoặc trộn khách giữa các tuyến.");
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <AppShell activeHref="/orders">
      <PageHeader eyebrow="Đơn hàng" title="Đơn hàng" subtitle="Quét nhanh đơn theo nguồn, điểm bán, tuyến, giá trị và trạng thái.">
        <SourceBadge source={ordersResult.source} />
        <button className="button primary" type="button" onClick={() => void openCreateOrder()} disabled={createLoading}>
          {createLoading ? "Đang tải phiên..." : "+ Tạo đơn"}
        </button>
      </PageHeader>
      {notice ? <section className={`card ${styles.notice}`}><strong>{notice}</strong><span>{noticeDetail || "Danh sách đang được làm mới từ dữ liệu live."}</span></section> : null}
      <FilterBar filters={[{ label: "Ngày", value: "Gần nhất" }, { label: "Tuyến", value: "Tất cả" }, { label: "Trạng thái", value: "Tất cả" }]} />
      <CompactKpiStrip items={kpis} />
      <section className={styles.section}>
        <div className="dashboard-section-head"><h2>Danh sách đơn</h2><span>{openOrders} cần xử lý</span></div>
        <div className={styles.list}>{ordersResult.data.map((order) => <OrderCard key={order.id} order={order} onSelect={setSelectedOrder} />)}</div>
      </section>
      <section className={`card ${styles.nextCard}`}><h2 className="panel-title">Tình trạng đơn</h2><div className="grid"><div className="metric-row"><span>Nháp</span><strong>{statusSummary.draft}</strong></div><div className="metric-row"><span>Đã chốt</span><strong>{statusSummary.confirmed}</strong></div><div className="metric-row"><span>Đã giao</span><strong>{statusSummary.delivered}</strong></div><div className="metric-row"><span>Hủy</span><strong>{statusSummary.cancelled}</strong></div></div></section>
      <OrderDetailSheet order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      <OrderCreateSheet
        open={createOpen}
        customers={customers}
        sessions={sessions}
        onClose={() => setCreateOpen(false)}
        onCreated={(orderCode) => {
          setCreateOpen(false);
          setNotice(`Đã tạo ${orderCode}.`);
          setNoticeDetail("Danh sách đang được làm mới từ dữ liệu live.");
        }}
      />
    </AppShell>
  );
}
