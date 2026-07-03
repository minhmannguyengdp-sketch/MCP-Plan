"use client";

import { useMemo, useState } from "react";
import type { ApiResult, OrderDto } from "@/lib/api/api.types";
import { CompactKpiStrip } from "@/ui/cards/CompactKpiStrip";
import { FilterBar } from "@/ui/layout/FilterBar";
import { PageHeader } from "@/ui/layout/PageHeader";
import { BottomSheet } from "@/ui/overlay/BottomSheet";
import { AppShell } from "@/ui/shell/AppShell";
import { SourceBadge } from "@/ui/status/SourceBadge";
import styles from "./OrdersClientPage.module.css";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

function getStatusLabel(status: string) {
  if (status === "draft") return "Nhap";
  if (status === "confirmed") return "Da chot";
  if (status === "delivered") return "Da giao";
  if (status === "cancelled") return "Huy";
  return status;
}

function getStatusClass(status: string) {
  if (status === "delivered") return `${styles.status} ${styles.delivered}`;
  if (status === "confirmed") return `${styles.status} ${styles.confirmed}`;
  if (status === "draft") return `${styles.status} ${styles.draft}`;
  return `${styles.status} ${styles.cancelled}`;
}

function buildOrderKpis(orders: OrderDto[]) {
  const totalAmount = orders.reduce((sum, order) => sum + order.totalAmount, 0);
  const skuCount = orders.reduce((sum, order) => sum + order.skuCount, 0);
  const openOrders = orders.filter((order) => order.status !== "delivered" && order.status !== "cancelled").length;
  return [
    { label: "Don hang", value: orders.length, hint: "Trong ky" },
    { label: "Doanh so", value: money.format(totalAmount), hint: "Tong gia tri" },
    { label: "SKU", value: skuCount, hint: "Mat hang" },
    { label: "Cho xu ly", value: openOrders, hint: "Chua xong" }
  ];
}

function OrderCard({ order, onSelect }: { order: OrderDto; onSelect: (order: OrderDto) => void }) {
  return (
    <article className={styles.card}>
      <div className={styles.head}>
        <div>
          <span>{order.source}</span>
          <h3>{order.code}</h3>
        </div>
        <strong className={getStatusClass(order.status)}>{getStatusLabel(order.status)}</strong>
      </div>
      <div className={styles.customer}>
        <b>{order.accountName}</b>
        <small>{order.routeName} - {order.owner} - {order.date}</small>
      </div>
      <div className={styles.metrics}>
        <span><b>{money.format(order.totalAmount)}</b><small>Gia tri</small></span>
        <span><b>{order.skuCount}</b><small>SKU</small></span>
        <span><b>{order.quantity}</b><small>SL</small></span>
      </div>
      <div className={styles.actions}>
        <button className="button primary" type="button" onClick={() => onSelect(order)}>Xem</button>
        <button className="button" type="button">Viec</button>
        <button className="button" type="button">Giao</button>
      </div>
    </article>
  );
}

function OrderDetailSheet({ order, onClose }: { order: OrderDto | null; onClose: () => void }) {
  return (
    <BottomSheet
      open={Boolean(order)}
      onClose={onClose}
      title={order ? order.code : "Chi tiet don"}
      description={order ? `${order.accountName} - ${order.routeName}` : undefined}
      footer={<div className="sheet-action-grid"><button className="button primary" type="button">Tao viec</button><button className="button" type="button" onClick={onClose}>Dong</button></div>}
    >
      {order ? (
        <div className="order-sheet-content">
          <div className="order-total-card"><span>Gia tri don</span><strong>{money.format(order.totalAmount)}</strong><small>{getStatusLabel(order.status)} - {order.source}</small></div>
          <div className="grid">
            <div className="metric-row"><span>Ngay</span><strong>{order.date}</strong></div>
            <div className="metric-row"><span>Sale</span><strong>{order.owner}</strong></div>
            <div className="metric-row"><span>SKU</span><strong>{order.skuCount}</strong></div>
            <div className="metric-row"><span>So luong</span><strong>{order.quantity}</strong></div>
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
      <PageHeader eyebrow="Orders" title="Don hang" subtitle="Quet nhanh don theo nguon, diem ban, tuyen, gia tri va trang thai."><SourceBadge source={ordersResult.source} /></PageHeader>
      <FilterBar filters={[{ label: "Ngay", value: "Gan nhat" }, { label: "Tuyen", value: "Tat ca" }, { label: "Trang thai", value: "Tat ca" }]} />
      <CompactKpiStrip items={kpis} />
      <section className={styles.section}>
        <div className="dashboard-section-head"><h2>Danh sach don</h2><span>{openOrders} can xu ly</span></div>
        <div className={styles.list}>{ordersResult.data.map((order) => <OrderCard key={order.id} order={order} onSelect={setSelectedOrder} />)}</div>
      </section>
      <section className={`card ${styles.nextCard}`}><h2 className="panel-title">Can xu ly</h2><div className="grid"><div className="metric-row"><span>Don moi</span><strong>Can chot</strong></div><div className="metric-row"><span>Giao hang</span><strong>Theo doi</strong></div><div className="metric-row"><span>Sau ban</span><strong>Cham soc</strong></div></div></section>
      <OrderDetailSheet order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </AppShell>
  );
}
