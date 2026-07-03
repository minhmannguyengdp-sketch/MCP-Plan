"use client";

import { useMemo, useState } from "react";
import { KpiCard } from "@/ui/cards/KpiCard";
import { FilterBar } from "@/ui/layout/FilterBar";
import { PageHeader } from "@/ui/layout/PageHeader";
import { BottomSheet } from "@/ui/overlay/BottomSheet";
import { AppShell } from "@/ui/shell/AppShell";
import { DataTable, type DataTableColumn } from "@/ui/table/DataTable";
import type { AccountItem, AccountKpi, AccountStatus } from "./accounts.types";

function formatMoney(value: number) {
  if (value === 0) return "-";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}

function statusLabel(status: AccountStatus) {
  if (status === "active") return "Dang cham soc";
  if (status === "need_visit") return "Can ghe lai";
  return "Chua du lieu";
}

function buildColumns(onSelect: (item: AccountItem) => void): DataTableColumn<AccountItem>[] {
  return [
    { key: "name", header: "Diem ban", render: (row) => row.name },
    { key: "contactName", header: "Lien he", render: (row) => row.contactName },
    { key: "area", header: "Khu vuc", render: (row) => row.area },
    { key: "routeName", header: "Tuyen", render: (row) => row.routeName },
    { key: "tier", header: "Hang", render: (row) => <span className="badge">Tier {row.tier}</span> },
    { key: "lastVisitDate", header: "Ghe gan nhat", render: (row) => row.lastVisitDate },
    { key: "lastOrderDate", header: "Don gan nhat", render: (row) => row.lastOrderDate },
    { key: "monthlyRevenue", header: "Doanh so", render: (row) => formatMoney(row.monthlyRevenue), align: "right" },
    { key: "status", header: "Trang thai", render: (row) => <span className="badge">{statusLabel(row.status)}</span> },
    { key: "detail", header: "", render: (row) => <button className="button compact" type="button" onClick={() => onSelect(row)}>Ho so</button> }
  ];
}

function OutletSheet({ item, onClose }: { item: AccountItem | null; onClose: () => void }) {
  return (
    <BottomSheet
      open={Boolean(item)}
      onClose={onClose}
      title={item ? item.name : "Ho so diem ban"}
      description={item ? `${item.area} · ${item.routeName}` : undefined}
      footer={
        <div className="sheet-action-grid">
          <button className="button primary" type="button">Len lich ghe lai</button>
          <button className="button" type="button">Tao don nhanh</button>
          <button className="button" type="button">Ghi field check</button>
          <button className="button" type="button">Tao viec theo doi</button>
          <button className="button" type="button" onClick={onClose}>Dong</button>
        </div>
      }
    >
      {item ? (
        <div className="outlet-sheet-content">
          <div className="outlet-focus-card">
            <span>Doanh so thang</span>
            <strong>{formatMoney(item.monthlyRevenue)}</strong>
            <small>Tier {item.tier} · {statusLabel(item.status)}</small>
          </div>
          <div className="grid">
            <div className="metric-row"><span>Nguoi lien he</span><strong>{item.contactName}</strong></div>
            <div className="metric-row"><span>Tuyen</span><strong>{item.routeName}</strong></div>
            <div className="metric-row"><span>Ghe gan nhat</span><strong>{item.lastVisitDate}</strong></div>
            <div className="metric-row"><span>Don gan nhat</span><strong>{item.lastOrderDate}</strong></div>
          </div>
          <div className="sheet-note-card">
            <h3>Ho so diem ban</h3>
            <p>Day la noi noi visit, order, field check va plan. Sau nay them lich su mua hang, cong no, anh cua hang va ghi chu cham soc.</p>
          </div>
        </div>
      ) : null}
    </BottomSheet>
  );
}

export function OutletsClientPage({ kpis, items }: { kpis: AccountKpi[]; items: AccountItem[] }) {
  const [selected, setSelected] = useState<AccountItem | null>(null);
  const columns = useMemo(() => buildColumns(setSelected), []);

  return (
    <AppShell activeHref="/customers">
      <PageHeader eyebrow="Customers" title="Khach hang / diem ban" subtitle="Ho so diem ban noi visit, order, field check va plan trong mot popup mobile-first.">
        <span className="badge">Mock data</span>
      </PageHeader>

      <FilterBar filters={[{ label: "Khu vuc", value: "Tat ca" }, { label: "Hang diem ban", value: "A/B/C" }, { label: "Trang thai", value: "Dang cham soc + Can ghe lai" }]} />

      <section className="grid cards">
        {kpis.map((row) => <KpiCard key={row.label} label={row.label} value={row.value} hint={row.hint} />)}
      </section>

      <section className="hero-panel" style={{ marginTop: 18 }}>
        <div className="card">
          <h2 className="panel-title">Danh sach diem ban</h2>
          <DataTable columns={columns} rows={items} getRowKey={(row) => row.id} emptyMessage="Chua co diem ban" />
        </div>
        <div className="card">
          <h2 className="panel-title">Can chuan hoa</h2>
          <div className="grid">
            <div className="metric-row"><span>Can ghe lai</span><strong>2</strong></div>
            <div className="metric-row"><span>Thieu thong tin</span><strong>1</strong></div>
            <div className="metric-row"><span>Chua co don</span><strong>3</strong></div>
            <div className="metric-row"><span>Tier A</span><strong>2</strong></div>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="panel-title">Goi y module diem ban</h2>
        <article className="action-card">
          <div>
            <span className="badge">Uu tien</span>
            <h3>Tap trung diem ban tier cao nhung chua co don moi</h3>
            <p className="page-subtitle">Nhom nay nen duoc ghe lai truoc de kiem tra ton kho, doi thu va nhu cau dat them hang.</p>
          </div>
          <strong>Sale</strong>
        </article>
      </section>

      <OutletSheet item={selected} onClose={() => setSelected(null)} />
    </AppShell>
  );
}
