"use client";

import { useMemo, useState } from "react";
import { KpiCard } from "@/ui/cards/KpiCard";
import { FilterBar } from "@/ui/layout/FilterBar";
import { PageHeader } from "@/ui/layout/PageHeader";
import { BottomSheet } from "@/ui/overlay/BottomSheet";
import { AppShell } from "@/ui/shell/AppShell";
import { DataTable, type DataTableColumn } from "@/ui/table/DataTable";
import type { MarketCheckItem, MarketCheckKpi, MarketCheckStatus } from "./market-checks.types";

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0
});

function getStatusLabel(status: MarketCheckStatus) {
  if (status === "opportunity") return "Co hoi";
  if (status === "risk") return "Rui ro";
  return "Binh thuong";
}

function buildColumns(onSelect: (check: MarketCheckItem) => void): DataTableColumn<MarketCheckItem>[] {
  return [
    { key: "date", header: "Ngay", render: (row) => row.date },
    { key: "routeName", header: "Tuyen", render: (row) => row.routeName },
    { key: "accountName", header: "Diem ban", render: (row) => row.accountName },
    { key: "productName", header: "San pham", render: (row) => row.productName },
    { key: "competitorName", header: "Doi thu", render: (row) => row.competitorName },
    { key: "shelfPrice", header: "Gia ke", render: (row) => money.format(row.shelfPrice), align: "right" },
    { key: "stockStatus", header: "Ton kho", render: (row) => row.stockStatus },
    { key: "status", header: "Danh gia", render: (row) => <span className="badge">{getStatusLabel(row.status)}</span> },
    { key: "detail", header: "", render: (row) => <button className="button compact" type="button" onClick={() => onSelect(row)}>Xem</button> }
  ];
}

function FieldCheckSheet({ check, onClose }: { check: MarketCheckItem | null; onClose: () => void }) {
  return (
    <BottomSheet
      open={Boolean(check)}
      onClose={onClose}
      title={check ? check.productName : "Chi tiet kiem tra"}
      description={check ? `${check.accountName} · ${check.routeName}` : undefined}
      footer={
        <div className="sheet-action-grid">
          <button className="button primary" type="button">Tao viec xu ly</button>
          <button className="button" type="button" onClick={onClose}>Dong</button>
        </div>
      }
    >
      {check ? (
        <div className="field-sheet-content">
          <div className="field-focus-card">
            <span>Danh gia</span>
            <strong>{getStatusLabel(check.status)}</strong>
            <small>{check.note}</small>
          </div>

          <div className="grid">
            <div className="metric-row"><span>Gia ke</span><strong>{money.format(check.shelfPrice)}</strong></div>
            <div className="metric-row"><span>Doi thu</span><strong>{check.competitorName}</strong></div>
            <div className="metric-row"><span>Ton kho</span><strong>{check.stockStatus}</strong></div>
            <div className="metric-row"><span>Ngay</span><strong>{check.date}</strong></div>
          </div>

          <div className="sheet-note-card">
            <h3>Huong xu ly</h3>
            <p>Kiem tra lai gia, ton kho, doi thu va tao viec cho sale/giam sat neu phat hien co hoi hoac rui ro.</p>
          </div>
        </div>
      ) : null}
    </BottomSheet>
  );
}

export function MarketChecksClientPage({ kpis, checks }: { kpis: MarketCheckKpi[]; checks: MarketCheckItem[] }) {
  const [selectedCheck, setSelectedCheck] = useState<MarketCheckItem | null>(null);
  const columns = useMemo(() => buildColumns(setSelectedCheck), []);

  return (
    <AppShell activeHref="/field-checks">
      <PageHeader
        eyebrow="Field Checks"
        title="Kiem tra thi truong"
        subtitle="Ghi nhan gia ke, doi thu, ton kho va co hoi xu ly tai tung diem ban."
      >
        <span className="badge">Dang theo doi</span>
      </PageHeader>

      <FilterBar
        filters={[
          { label: "Ngay", value: "Gan nhat" },
          { label: "Tuyen", value: "Tat ca" },
          { label: "Danh gia", value: "Tat ca" }
        ]}
      />

      <section className="grid cards">
        {kpis.map((item) => (
          <KpiCard key={item.label} label={item.label} value={item.value} hint={item.hint} />
        ))}
      </section>

      <section className="hero-panel" style={{ marginTop: 18 }}>
        <div className="card">
          <h2 className="panel-title">Bang kiem tra thi truong</h2>
          <DataTable columns={columns} rows={checks} getRowKey={(row) => row.id} />
        </div>

        <div className="card">
          <h2 className="panel-title">Diem can theo doi</h2>
          <div className="grid">
            <div className="metric-row"><span>Gia</span><strong>Cap nhat</strong></div>
            <div className="metric-row"><span>Doi thu</span><strong>Theo doi</strong></div>
            <div className="metric-row"><span>Viec can lam</span><strong>Xu ly</strong></div>
          </div>
        </div>
      </section>

      <FieldCheckSheet check={selectedCheck} onClose={() => setSelectedCheck(null)} />
    </AppShell>
  );
}
