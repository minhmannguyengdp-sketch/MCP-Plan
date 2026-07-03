"use client";

import { useMemo, useState } from "react";
import type { ApiResult, OrderDto } from "@/lib/api/api.types";
import { KpiCard } from "@/ui/cards/KpiCard";
import { FilterBar } from "@/ui/layout/FilterBar";
import { PageHeader } from "@/ui/layout/PageHeader";
import { BottomSheet } from "@/ui/overlay/BottomSheet";
import { AppShell } from "@/ui/shell/AppShell";
import { DataTable, type DataTableColumn } from "@/ui/table/DataTable";

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0
});

function getStatusLabel(status: string) {
  if (status === "draft") return "Nhap";
  if (status === "confirmed") return "Da chot";
  if (status === "delivered") return "Da giao";
  return "Huy";
}

function buildOrderKpis(orders: OrderDto[]) {
  const totalAmount = orders.reduce((sum, order) => sum + order.totalAmount, 0);
  const skuCount = orders.reduce((sum, order) => sum + order.skuCount, 0);
  const openOrders = orders.filter((order) => order.status !== "delivered" && order.status !== "cancelled").length;

  return [
    { label: "Don hang", value: orders.length, hint: "Trong ky hien tai" },
    { label: "Doanh so", value: money.format(totalAmount), hint: "Tong gia tri" },
    { label: "SKU", value: skuCount, hint: "Mat hang ban" },
    { label: "Cho xu ly", value: openOrders, hint: "Chua giao/huy" }
  ];
}

function buildColumns(onSelect: (order: OrderDto) => void): DataTableColumn<OrderDto>[] {
  return [
    { key: "code", header: "Ma don", render: (row) => row.code },
    { key: "date", header: "Ngay", render: (row) => row.date },
    { key: "accountName", header: "Diem ban", render: (row) => row.accountName },
    { key: "routeName", header: "Tuyen", render: (row) => row.routeName },
    { key: "owner", header: "Sale", render: (row) => row.owner },
    { key: "skuCount", header: "SKU", render: (row) => row.skuCount, align: "right" },
    { key: "quantity", header: "SL", render: (row) => row.quantity, align: "right" },
    { key: "totalAmount", header: "Gia tri", render: (row) => money.format(row.totalAmount), align: "right" },
    { key: "status", header: "Trang thai", render: (row) => <span className="badge">{getStatusLabel(row.status)}</span> },
    { key: "detail", header: "", render: (row) => <button className="button compact" type="button" onClick={() => onSelect(row)}>Xem</button> }
  ];
}

function OrderDetailSheet({ order, onClose }: { order: OrderDto | null; onClose: () => void }) {
  return (
    <BottomSheet
      open={Boolean(order)}
      onClose={onClose}
      title={order ? order.code : "Chi tiet don"}
      description={order ? `${order.accountName} · ${order.routeName}` : undefined}
      footer={
        <div className="sheet-action-grid">
          <button className="button primary" type="button">Tao viec theo doi</button>
          <button className="button" type="button" onClick={onClose}>Dong</button>
        </div>
      }
    >
      {order ? (
        <div className="order-sheet-content">
          <div className="order-total-card">
            <span>Gia tri don</span>
            <strong>{money.format(order.totalAmount)}</strong>
            <small>{getStatusLabel(order.status)} · {order.source}</small>
          </div>

          <div className="grid">
            <div className="metric-row"><span>Ngay</span><strong>{order.date}</strong></div>
            <div className="metric-row"><span>Sale</span><strong>{order.owner}</strong></div>
            <div className="metric-row"><span>SKU</span><strong>{order.skuCount}</strong></div>
            <div className="metric-row"><span>So luong</span><strong>{order.quantity}</strong></div>
          </div>

          <div className="sheet-note-card">
            <h3>Xu ly tiep theo</h3>
            <p>Theo doi giao hang, cap nhat trang thai va tao viec cham soc sau ban neu can.</p>
          </div>
        </div>
      ) : null}
    </BottomSheet>
  );
}

export function OrdersClientPage({ ordersResult }: { ordersResult: ApiResult<OrderDto[]> }) {
  const [selectedOrder, setSelectedOrder] = useState<OrderDto | null>(null);
  const kpis = useMemo(() => buildOrderKpis(ordersResult.data), [ordersResult.data]);
  const columns = useMemo(() => buildColumns(setSelectedOrder), []);

  return (
    <AppShell activeHref="/orders">
      <PageHeader
        eyebrow="Orders"
        title="Don hang"
        subtitle="Theo doi don hang theo diem ban, tuyen, sale phu trach va trang thai xu ly."
      >
        <span className="badge">Dang theo doi</span>
      </PageHeader>

      <FilterBar
        filters={[
          { label: "Ngay", value: "Gan nhat" },
          { label: "Tuyen", value: "Tat ca" },
          { label: "Trang thai", value: "Tat ca" }
        ]}
      />

      <section className="grid cards">
        {kpis.map((item) => (
          <KpiCard key={item.label} label={item.label} value={item.value} hint={item.hint} />
        ))}
      </section>

      <section className="hero-panel" style={{ marginTop: 18 }}>
        <div className="card">
          <h2 className="panel-title">Danh sach don hang</h2>
          <DataTable columns={columns} rows={ordersResult.data} getRowKey={(row) => row.id} />
        </div>

        <div className="card">
          <h2 className="panel-title">Can xu ly</h2>
          <div className="grid">
            <div className="metric-row"><span>Don moi</span><strong>Can chot</strong></div>
            <div className="metric-row"><span>Giao hang</span><strong>Theo doi</strong></div>
            <div className="metric-row"><span>Sau ban</span><strong>Cham soc</strong></div>
          </div>
        </div>
      </section>

      <OrderDetailSheet order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </AppShell>
  );
}
