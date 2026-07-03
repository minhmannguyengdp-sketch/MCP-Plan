"use client";

import { useMemo, useState } from "react";
import { CompactKpiStrip } from "@/ui/cards/CompactKpiStrip";
import { FilterBar } from "@/ui/layout/FilterBar";
import { PageHeader } from "@/ui/layout/PageHeader";
import { BottomSheet } from "@/ui/overlay/BottomSheet";
import { AppShell } from "@/ui/shell/AppShell";
import type { MarketCheckItem, MarketCheckKpi, MarketCheckStatus } from "./market-checks.types";
import styles from "./MarketChecksClientPage.module.css";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

function getStatusLabel(status: MarketCheckStatus) {
  if (status === "opportunity") return "Co hoi";
  if (status === "risk") return "Rui ro";
  return "Binh thuong";
}

function getStatusClass(status: MarketCheckStatus) {
  if (status === "opportunity") return `${styles.status} ${styles.opportunity}`;
  if (status === "risk") return `${styles.status} ${styles.risk}`;
  return `${styles.status} ${styles.normal}`;
}

function buildSetupMetrics(checks: MarketCheckItem[]) {
  const products = new Set(checks.map((check) => check.productName)).size;
  const accounts = new Set(checks.map((check) => check.accountName)).size;
  const pending = checks.filter((check) => check.status === "normal").length;
  return { products, accounts, pending };
}

function TestResultCard({ check, onSelect }: { check: MarketCheckItem; onSelect: (check: MarketCheckItem) => void }) {
  return (
    <article className={styles.card}>
      <div className={styles.head}>
        <div>
          <span>{check.date}</span>
          <h3>{check.productName}</h3>
        </div>
        <strong className={getStatusClass(check.status)}>{getStatusLabel(check.status)}</strong>
      </div>

      <div className={styles.context}>
        <b>{check.accountName}</b>
        <small>{check.routeName} - {check.note}</small>
      </div>

      <div className={styles.metrics}>
        <span><b>{money.format(check.shelfPrice)}</b><small>Gia ke</small></span>
        <span><b>{check.competitorName}</b><small>Doi thu</small></span>
        <span><b>{check.stockStatus}</b><small>Ton kho</small></span>
      </div>

      <div className={styles.actions}>
        <button className="button primary" type="button" onClick={() => onSelect(check)}>Nhap</button>
        <button className="button" type="button">Anh</button>
        <button className="button" type="button">Viec</button>
      </div>
    </article>
  );
}

function FieldCheckSheet({ check, onClose }: { check: MarketCheckItem | null; onClose: () => void }) {
  return (
    <BottomSheet
      open={Boolean(check)}
      onClose={onClose}
      title={check ? check.productName : "Chi tiet kiem tra"}
      description={check ? `${check.accountName} - ${check.routeName}` : undefined}
      footer={<div className="sheet-action-grid"><button className="button primary" type="button">Tao viec xu ly</button><button className="button" type="button" onClick={onClose}>Dong</button></div>}
    >
      {check ? (
        <div className="field-sheet-content">
          <div className="field-focus-card"><span>Danh gia</span><strong>{getStatusLabel(check.status)}</strong><small>{check.note}</small></div>
          <div className="grid">
            <div className="metric-row"><span>Gia ke</span><strong>{money.format(check.shelfPrice)}</strong></div>
            <div className="metric-row"><span>Doi thu</span><strong>{check.competitorName}</strong></div>
            <div className="metric-row"><span>Ton kho</span><strong>{check.stockStatus}</strong></div>
            <div className="metric-row"><span>Ngay</span><strong>{check.date}</strong></div>
          </div>
          <div className="sheet-note-card"><h3>Nhap ket qua</h3><p>Cap nhat gia ke, ton kho, doi thu va tao viec neu phat hien co hoi hoac rui ro.</p></div>
        </div>
      ) : null}
    </BottomSheet>
  );
}

export function MarketChecksClientPage({ kpis, checks }: { kpis: MarketCheckKpi[]; checks: MarketCheckItem[] }) {
  const [selectedCheck, setSelectedCheck] = useState<MarketCheckItem | null>(null);
  const setup = useMemo(() => buildSetupMetrics(checks), [checks]);
  const needAction = checks.filter((check) => check.status !== "normal").length;

  return (
    <AppShell activeHref="/field-checks">
      <PageHeader eyebrow="Product Test" title="Test san pham" subtitle="Tach rieng file test, diem ban can nhap ket qua va viec can xu ly."><span className="badge">Dang theo doi</span></PageHeader>
      <FilterBar filters={[{ label: "Ngay", value: "Gan nhat" }, { label: "Tuyen", value: "Tat ca" }, { label: "Danh gia", value: "Tat ca" }]} />

      <section className={styles.setupGrid}>
        <div className={styles.setupCard}>
          <span>File setup</span>
          <h2>Dot test san pham</h2>
          <p>Quan ly san pham test, diem ban duoc gan va trang thai nhap ket qua.</p>
          <div className={styles.setupMetrics}>
            <strong><b>{setup.products}</b><small>San pham</small></strong>
            <strong><b>{setup.accounts}</b><small>Diem ban</small></strong>
            <strong><b>{setup.pending}</b><small>Cho nhap</small></strong>
          </div>
        </div>

        <div className={styles.setupCard}>
          <span>Nhap ket qua</span>
          <h2>{needAction} can xu ly</h2>
          <p>Uu tien cac ket qua co co hoi hoac rui ro de tao viec cho sale/giam sat.</p>
        </div>
      </section>

      <CompactKpiStrip items={kpis} />

      <section className={styles.section}>
        <div className="dashboard-section-head"><h2>Ket qua theo diem ban</h2><span>{checks.length} dong</span></div>
        <div className={styles.list}>{checks.map((check) => <TestResultCard key={check.id} check={check} onSelect={setSelectedCheck} />)}</div>
      </section>

      <section className={`card ${styles.nextCard}`}><h2 className="panel-title">Diem can theo doi</h2><div className="grid"><div className="metric-row"><span>Gia</span><strong>Cap nhat</strong></div><div className="metric-row"><span>Doi thu</span><strong>Theo doi</strong></div><div className="metric-row"><span>Viec can lam</span><strong>Xu ly</strong></div></div></section>

      <FieldCheckSheet check={selectedCheck} onClose={() => setSelectedCheck(null)} />
    </AppShell>
  );
}
