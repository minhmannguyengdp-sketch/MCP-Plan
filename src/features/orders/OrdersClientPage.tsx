"use client";

import { useMemo, useState } from "react";
import type { ApiResult, OrderDto } from "@/lib/api/api.types";
import { CompactKpiStrip } from "@/ui/cards/CompactKpiStrip";
import { OperationalListCard } from "@/ui/cards/OperationalListCard";
import { FilterBar } from "@/ui/layout/FilterBar";
import { PageHeader } from "@/ui/layout/PageHeader";
import { BottomSheet } from "@/ui/overlay/BottomSheet";
import { AppShell } from "@/ui/shell/AppShell";
import { SourceBadge } from "@/ui/status/SourceBadge";
import styles from "./OrdersClientPage.module.css";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

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
        { label: "Xuất file", href: orderExportHref(order) },
        { label: "Việc" }
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
      footer={<div className="sheet-action-grid"><button className="button primary" type="button">Tạo việc</button>{order ? <a className="button" href={orderExportHref(order)}>Xuất file</a> : null}<button className="button" type="button" onClick={onClose}>Đóng</button></div>}
    >
      {order ? (
        <div className="order-sheet-content">
          <div className="order-total-card"><span>Giá trị đơn</span><strong>{money.format(order.totalAmount)}</strong><small>{getStatusLabel(order.status)} · {order.source}</small></div>
          <div className="grid">
            <div className="metric-row"><span>Ngày</span><strong>{order.date}</strong></div>
            <div className="metric-row"><span>Sale</span><strong>{order.owner}</strong></div>
            <div className="metric-row"><span>SKU</span><strong>{order.skuCount}</strong></div>
            <div className="metric-row"><span>Số lượng</span><strong>{order.quantity}</strong></div>
          </div>
        </div>
      ) : null}
    </BottomSheet>
  );
}

export function OrdersClientPage({ ordersResult }: { ordersResult: ApiResult<OrderDto[]> }) {
  const [selectedOrder, setSelectedOrder] = useState<OrderDto | null>(null);
  const kpis = useMemo(() => buildOrderKpis(ordersResult.data), [ordersResult.data]);
  const openOrders = ordersResult.data.filter((order) => order.status !== "delivered" && order.status !== "cancelled").length;

  return (
    <AppShell activeHref="/orders">
      <PageHeader eyebrow="Orders" title="Đơn hàng" subtitle="Quét nhanh đơn theo nguồn, điểm bán, tuyến, giá trị và trạng thái."><SourceBadge source={ordersResult.source} /></PageHeader>
      <FilterBar filters={[{ label: "Ngày", value: "Gần nhất" }, { label: "Tuyến", value: "Tất cả" }, { label: "Trạng thái", value: "Tất cả" }]} />
      <CompactKpiStrip items={kpis} />
      <section className={styles.section}>
        <div className="dashboard-section-head"><h2>Danh sách đơn</h2><span>{openOrders} cần xử lý</span></div>
        <div className={styles.list}>{ordersResult.data.map((order) => <OrderCard key={order.id} order={order} onSelect={setSelectedOrder} />)}</div>
      </section>
      <section className={`card ${styles.nextCard}`}><h2 className="panel-title">Cần xử lý</h2><div className="grid"><div className="metric-row"><span>Đơn mới</span><strong>Cần chốt</strong></div><div className="metric-row"><span>Giao hàng</span><strong>Theo dõi</strong></div><div className="metric-row"><span>Sau bán</span><strong>Chăm sóc</strong></div></div></section>
      <OrderDetailSheet order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </AppShell>
  );
}
