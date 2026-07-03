"use client";

import { useMemo, useState } from "react";
import { KpiCard } from "@/ui/cards/KpiCard";
import { FilterBar } from "@/ui/layout/FilterBar";
import { PageHeader } from "@/ui/layout/PageHeader";
import { BottomSheet } from "@/ui/overlay/BottomSheet";
import { AppShell } from "@/ui/shell/AppShell";
import { DataTable, type DataTableColumn } from "@/ui/table/DataTable";
import type { DayLineSource, DayLineStatus, McpDayData, McpDayLine, McpDayResult } from "./mcp-day.types";

function getSourceLabel(source: DayLineSource) {
  if (source === "planned") return "Ke hoach";
  if (source === "added") return "Phat sinh";
  return "Dong bo";
}

function getStatusLabel(status: DayLineStatus) {
  if (status === "pending") return "Cho ghe";
  if (status === "visited") return "Da ghe";
  if (status === "skipped") return "Bo qua";
  return "Huy";
}

function buildLineColumns(onSelect: (line: McpDayLine) => void): DataTableColumn<McpDayLine>[] {
  return [
    { key: "sortOrder", header: "STT", render: (row) => row.sortOrder, align: "right" },
    { key: "accountName", header: "Diem ban", render: (row) => row.accountName },
    { key: "area", header: "Khu vuc", render: (row) => row.area },
    { key: "source", header: "Nguon", render: (row) => <span className="badge">{getSourceLabel(row.source)}</span> },
    { key: "status", header: "Trang thai", render: (row) => <span className="badge">{getStatusLabel(row.status)}</span> },
    { key: "hasOrder", header: "Don", render: (row) => (row.hasOrder ? "Co" : "Khong"), align: "center" },
    { key: "detail", header: "", render: (row) => <button className="button compact" type="button" onClick={() => onSelect(row)}>Xu ly</button> }
  ];
}

const resultColumns: DataTableColumn<McpDayResult>[] = [
  { key: "accountName", header: "Diem ban", render: (row) => row.accountName },
  { key: "startTime", header: "Bat dau", render: (row) => row.startTime },
  { key: "endTime", header: "Ket thuc", render: (row) => row.endTime },
  { key: "result", header: "Ket qua", render: (row) => row.result },
  { key: "hasOrder", header: "Don", render: (row) => (row.hasOrder ? "Co" : "Khong"), align: "center" },
  { key: "nextAction", header: "Viec tiep", render: (row) => row.nextAction }
];

function VisitSheet({ line, onClose }: { line: McpDayLine | null; onClose: () => void }) {
  return (
    <BottomSheet
      open={Boolean(line)}
      onClose={onClose}
      title={line ? line.accountName : "Xu ly diem ban"}
      description={line ? `${line.area} · ${getSourceLabel(line.source)}` : undefined}
      footer={
        <div className="sheet-action-grid">
          <button className="button primary" type="button">Bat dau check-in</button>
          <button className="button" type="button">Ghi ket qua ghe</button>
          <button className="button" type="button">Bo qua co ly do</button>
          <button className="button" type="button" onClick={onClose}>Dong</button>
        </div>
      }
    >
      {line ? (
        <div className="visit-sheet-content">
          <div className="visit-focus-card">
            <span>Trang thai</span>
            <strong>{getStatusLabel(line.status)}</strong>
            <small>{line.hasOrder ? "Da co don" : "Chua co don"}</small>
          </div>

          <div className="grid">
            <div className="metric-row"><span>Thu tu ghe</span><strong>{line.sortOrder}</strong></div>
            <div className="metric-row"><span>Nguon</span><strong>{getSourceLabel(line.source)}</strong></div>
            <div className="metric-row"><span>Ket qua</span><strong>{line.result ?? "Chua ghi"}</strong></div>
            <div className="metric-row"><span>Ghi chu</span><strong>{line.note}</strong></div>
          </div>

          <div className="sheet-note-card">
            <h3>Logic MCP</h3>
            <p>Popup nay xu ly snapshot khach trong phien ngay. Thay doi o day khong tu dong sua tuyen goc neu chua co buoc dong bo rieng.</p>
          </div>
        </div>
      ) : null}
    </BottomSheet>
  );
}

export function McpDayClientPage({ data }: { data: McpDayData }) {
  const [selectedLine, setSelectedLine] = useState<McpDayLine | null>(null);
  const lineColumns = useMemo(() => buildLineColumns(setSelectedLine), []);
  const run = data.run;

  return (
    <AppShell activeHref="/visits">
      <PageHeader
        eyebrow="MCP Daily Session"
        title="Phien MCP ngay"
        subtitle="Xu ly khach trong phien bang popup: check-in, ghi ket qua, bo qua co ly do."
      >
        <span className="badge">{run.status}</span>
      </PageHeader>

      <FilterBar
        filters={[
          { label: "Ngay", value: run.date },
          { label: "Tuyen", value: run.routeName },
          { label: "Sale", value: run.owner },
          { label: "Mo luc", value: run.openedAt }
        ]}
      />

      <section className="grid cards">
        {data.kpis.map((item) => (
          <KpiCard key={item.label} label={item.label} value={item.value} hint={item.hint} />
        ))}
      </section>

      <section className="hero-panel" style={{ marginTop: 18 }}>
        <div className="card">
          <h2 className="panel-title">Snapshot khach trong phien</h2>
          <DataTable columns={lineColumns} rows={data.lines} getRowKey={(row) => row.id} />
        </div>

        <div className="card">
          <h2 className="panel-title">MCP mobile flow</h2>
          <div className="grid">
            <div className="metric-row"><span>Check-in</span><strong>Bat dau</strong></div>
            <div className="metric-row"><span>Ket qua</span><strong>Ghi nhan</strong></div>
            <div className="metric-row"><span>Bo qua</span><strong>Co ly do</strong></div>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="panel-title">Ket qua da ghe</h2>
        <DataTable columns={resultColumns} rows={data.results} getRowKey={(row) => row.id} />
      </section>

      <VisitSheet line={selectedLine} onClose={() => setSelectedLine(null)} />
    </AppShell>
  );
}
