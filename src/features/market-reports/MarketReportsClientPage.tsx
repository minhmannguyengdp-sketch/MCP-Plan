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

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

function getStatusLabel(status: MarketReportStatus) {
  if (status === "opportunity") return "Cơ hội";
  if (status === "risk") return "Rủi ro";
  return "Bình thường";
}

function getTypeLabel(type: MarketReportType) {
  if (type === "price") return "Giá";
  if (type === "competitor") return "Đối thủ";
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
      leading={<span>{getTypeLabel(report.reportType).slice(0, 2)}</span>}
      eyebrow={`${getTypeLabel(report.reportType)} · ${report.date}`}
      title={report.subject}
      description={report.accountName}
      badge={<strong className={getStatusClass(report.status)}>{getStatusLabel(report.status)}</strong>}
      meta={[report.routeName, report.price ? money.format(report.price) : "Chưa có giá", report.nextAction]}
      actions={[
        { label: "Xem", tone: "primary", onClick: () => onSelect(report) },
        { label: "Việc" }
      ]}
    />
  );
}

function ReportSheet({ report, onClose }: { report: MarketReportItem | null; onClose: () => void }) {
  return (
    <BottomSheet
      open={Boolean(report)}
      onClose={onClose}
      title={report ? report.subject : "Chi tiết báo cáo"}
      description={report ? `${report.accountName} · ${report.routeName}` : undefined}
      footer={<div className="sheet-action-grid"><button className="button primary" type="button">Tạo việc xử lý</button><button className="button" type="button" onClick={onClose}>Đóng</button></div>}
    >
      {report ? (
        <div className="field-sheet-content">
          <div className="field-focus-card"><span>Đánh giá</span><strong>{getStatusLabel(report.status)}</strong><small>{report.note}</small></div>
          <div className="grid">
            <div className="metric-row"><span>Loại</span><strong>{getTypeLabel(report.reportType)}</strong></div>
            <div className="metric-row"><span>Đối thủ</span><strong>{report.competitorName || "-"}</strong></div>
            <div className="metric-row"><span>Giá</span><strong>{report.price ? money.format(report.price) : "-"}</strong></div>
            <div className="metric-row"><span>Ngày</span><strong>{report.date}</strong></div>
          </div>
          <div className="sheet-note-card"><h3>Hướng xử lý</h3><p>{report.nextAction}</p></div>
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
      <PageHeader eyebrow="Market Reports" title="Báo cáo thị trường" subtitle="Ghi nhận giá, đối thủ, trưng bày, tồn kho và việc cần xử lý ngoài thị trường."><span className="badge">{needAction} cần xử lý</span></PageHeader>
      <FilterBar filters={[{ label: "Ngày", value: "Gần nhất" }, { label: "Tuyến", value: "Tất cả" }, { label: "Loại", value: "Tất cả" }]} />
      <CompactKpiStrip items={kpis} />

      <div className={styles.templateGrid}>
        <span>Giá</span>
        <span>Đối thủ</span>
        <span>Trưng bày</span>
        <span>Tồn kho</span>
      </div>

      <section className={styles.section}>
        <div className="dashboard-section-head"><h2>Báo cáo mới</h2><span>{reports.length} dòng</span></div>
        <div className={styles.list}>{reports.map((report) => <ReportCard key={report.id} report={report} onSelect={setSelectedReport} />)}</div>
      </section>

      <ReportSheet report={selectedReport} onClose={() => setSelectedReport(null)} />
    </AppShell>
  );
}
