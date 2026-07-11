"use client";

import { useState } from "react";
import { CompactKpiStrip } from "@/ui/cards/CompactKpiStrip";
import { OperationalListCard } from "@/ui/cards/OperationalListCard";
import { FilterBar } from "@/ui/layout/FilterBar";
import { PageHeader } from "@/ui/layout/PageHeader";
import { BottomSheet } from "@/ui/overlay/BottomSheet";
import { AppShell } from "@/ui/shell/AppShell";
import type { MarketReportItem, MarketReportKpi, MarketReportStatus, MarketReportType } from "./market-reports.types";
import styles from "./MarketReportsClientPage.module.css";

function getStatusLabel(status: MarketReportStatus) {
  if (status === "opportunity") return "Cơ hội";
  if (status === "risk") return "Rủi ro";
  return "Bình thường";
}

function getTypeLabel(type: MarketReportType) {
  if (type === "price") return "Giá";
  if (type === "competitor") return "BC phiên";
  if (type === "display") return "Trưng bày";
  return "Tồn kho";
}

function getStatusClass(status: MarketReportStatus) {
  if (status === "opportunity") return `${styles.status} ${styles.opportunity}`;
  if (status === "risk") return `${styles.status} ${styles.risk}`;
  return `${styles.status} ${styles.normal}`;
}

function ReportCard({ report, onSelect }: { report: MarketReportItem; onSelect: (report: MarketReportItem) => void }) {
  return (
    <OperationalListCard
      leading={<span>BC</span>}
      eyebrow={`BC phiên · ${report.date}`}
      title={report.subject}
      description={report.accountName}
      badge={<strong className={getStatusClass(report.status)}>{getStatusLabel(report.status)}</strong>}
      meta={[report.routeName, report.competitorName ? `Đối thủ: ${report.competitorName}` : "Chưa có đối thủ nổi bật", report.nextAction]}
      actions={[{ label: "Xem", tone: "primary", onClick: () => onSelect(report) }]}
    />
  );
}

function ReportSheet({ report, onClose }: { report: MarketReportItem | null; onClose: () => void }) {
  return (
    <BottomSheet
      open={Boolean(report)}
      onClose={onClose}
      title={report ? report.subject : "Chi tiết BC phiên"}
      description={report ? `${report.accountName} · ${report.routeName}` : undefined}
      footer={<div className="sheet-action-grid"><button className="button" type="button" onClick={onClose}>Đóng</button></div>}
    >
      {report ? (
        <div className="field-sheet-content">
          <div className="field-focus-card"><span>Đánh giá snapshot</span><strong>{getStatusLabel(report.status)}</strong><small>{report.note}</small></div>
          <div className="grid">
            <div className="metric-row"><span>Loại</span><strong>{getTypeLabel(report.reportType)}</strong></div>
            <div className="metric-row"><span>Đối thủ nổi bật</span><strong>{report.competitorName || "-"}</strong></div>
            <div className="metric-row"><span>Ngày phiên</span><strong>{report.date}</strong></div>
          </div>
          <div className="sheet-note-card"><h3>Next action</h3><p>{report.nextAction}</p></div>
        </div>
      ) : null}
    </BottomSheet>
  );
}

export function MarketReportsClientPage({ kpis, reports }: { kpis: MarketReportKpi[]; reports: MarketReportItem[] }) {
  const [selectedReport, setSelectedReport] = useState<MarketReportItem | null>(null);
  const needAction = reports.filter((report) => report.status !== "normal").length;

  return (
    <AppShell activeHref="/reports">
      <PageHeader eyebrow="BC phiên MCP" title="Báo cáo phiên" subtitle="Danh sách snapshot BC phiên được tạo khi chốt phiên MCP. Dữ liệu khách chỉ là quan sát đầu vào, không còn là báo cáo rời."><span className="badge">{needAction} cần xử lý</span></PageHeader>
      <FilterBar filters={[{ label: "Nguồn", value: "Phiên MCP" }, { label: "Trạng thái", value: "Snapshot" }, { label: "Nhóm", value: "Theo phiên" }]} />
      <CompactKpiStrip items={kpis} />

      <div className={styles.templateGrid}>
        <span>Đối thủ</span>
        <span>SP đang dùng</span>
        <span>Test</span>
        <span>Đơn</span>
      </div>

      <section className={styles.section}>
        <div className="dashboard-section-head"><h2>BC phiên đã chốt</h2><span>{reports.length} phiên</span></div>
        <div className={styles.list}>{reports.length ? reports.map((report) => <ReportCard key={report.id} report={report} onSelect={setSelectedReport} />) : <div className="empty-inline">Chưa có snapshot BC phiên. Chốt một phiên MCP để tạo báo cáo chính thức.</div>}</div>
      </section>

      <ReportSheet report={selectedReport} onClose={() => setSelectedReport(null)} />
    </AppShell>
  );
}
