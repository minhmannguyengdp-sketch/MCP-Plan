"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CompactKpiStrip } from "@/ui/cards/CompactKpiStrip";
import { OperationalListCard } from "@/ui/cards/OperationalListCard";
import { FilterBar } from "@/ui/layout/FilterBar";
import { PageHeader } from "@/ui/layout/PageHeader";
import { BottomSheet } from "@/ui/overlay/BottomSheet";
import { AppShell } from "@/ui/shell/AppShell";
import type { MarketCheckItem, MarketCheckKpi, MarketCheckStatus } from "./market-checks.types";
import styles from "./MarketChecksClientPage.module.css";

function getStatusLabel(status: MarketCheckStatus) {
  if (status === "opportunity") return "Cơ hội";
  if (status === "risk") return "Rủi ro";
  return "Bình thường";
}

function getStatusClass(status: MarketCheckStatus) {
  if (status === "opportunity") return `${styles.status} ${styles.opportunity}`;
  if (status === "risk") return `${styles.status} ${styles.risk}`;
  return `${styles.status} ${styles.normal}`;
}

function buildSetupMetrics(checks: MarketCheckItem[]) {
  const products = new Set(checks.map((check) => check.productName)).size;
  const accounts = new Set(checks.map((check) => check.accountName)).size;
  const pending = checks.filter((check) => !check.resultId).length;
  return { products, accounts, pending };
}

function TestResultCard({ check, onSelect }: { check: MarketCheckItem; onSelect: (check: MarketCheckItem) => void }) {
  return (
    <OperationalListCard
      leading={<span>{check.stockStatus.slice(0, 2).toUpperCase()}</span>}
      eyebrow={`${check.date || "-"} · ${check.routeName}`}
      title={check.productName}
      description={check.accountName}
      badge={<strong className={getStatusClass(check.status)}>{getStatusLabel(check.status)}</strong>}
      meta={[check.stockStatus, check.area || check.phone || "Chưa có khu vực", check.note]}
      actions={[{ label: "Nhập", tone: "primary", onClick: () => onSelect(check) }]}
    />
  );
}

type SavePayload = {
  resultId?: string;
  fileId: string;
  customerId: string;
  productId?: string;
  productName: string;
  status: MarketCheckStatus;
  note: string;
};

function FieldCheckSheet({ check, onClose, onSaved }: { check: MarketCheckItem | null; onClose: () => void; onSaved: (check: MarketCheckItem) => void }) {
  const [productName, setProductName] = useState("");
  const [status, setStatus] = useState<MarketCheckStatus>("normal");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProductName(check?.productName || "");
    setStatus(check?.status || "normal");
    setNote(check?.note || "");
    setError(null);
  }, [check]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!check) return;
    setSaving(true);
    setError(null);

    const payload: SavePayload = {
      resultId: check.resultId,
      fileId: check.fileId,
      customerId: check.customerId,
      productId: check.productId,
      productName,
      status,
      note
    };

    try {
      const response = await fetch("/api/field-checks/result", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || `save_failed_${response.status}`);
      const saved = json.data || {};
      onSaved({
        ...check,
        resultId: String(saved.id || check.resultId || ""),
        productId: String(saved.product_id || check.productId || "") || undefined,
        productName: String(saved.product_name || productName),
        stockStatus: String(saved.status || status),
        status,
        note: String(saved.note || note)
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "save_failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet
      open={Boolean(check)}
      onClose={onClose}
      title={check ? check.productName : "Chi tiết kiểm tra"}
      description={check ? `${check.accountName} · ${check.routeName}` : undefined}
      footer={
        <div className="sheet-action-grid">
          <button className="button primary" disabled={saving} form="field-check-save-form" type="submit">{saving ? "Đang lưu..." : "Lưu kết quả"}</button>
          <button className="button" type="button" onClick={onClose}>Đóng</button>
        </div>
      }
    >
      {check ? (
        <form className="field-sheet-content" id="field-check-save-form" onSubmit={submit}>
          <div className="field-focus-card"><span>Khách</span><strong>{check.accountName}</strong><small>{check.phone || check.area || "Dữ liệu từ test thật"}</small></div>
          <div className="grid">
            <label className="metric-row"><span>Sản phẩm</span><input value={productName} onChange={(event) => setProductName(event.target.value)} required /></label>
            <label className="metric-row"><span>Kết quả</span><select value={status} onChange={(event) => setStatus(event.target.value as MarketCheckStatus)}><option value="normal">Bình thường</option><option value="opportunity">Cơ hội</option><option value="risk">Rủi ro</option></select></label>
            <div className="metric-row"><span>File test</span><strong>{check.routeName}</strong></div>
            <div className="metric-row"><span>Ngày</span><strong>{check.date || "-"}</strong></div>
          </div>
          <label className="sheet-note-card"><h3>Ghi chú kết quả</h3><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} placeholder="Nhập nhận xét, tồn kho, phản hồi khách, việc cần xử lý..." /></label>
          {error ? <p className={styles.errorText}>{error}</p> : null}
        </form>
      ) : null}
    </BottomSheet>
  );
}

export function MarketChecksClientPage({ kpis, checks }: { kpis: MarketCheckKpi[]; checks: MarketCheckItem[] }) {
  const [rows, setRows] = useState(checks);
  const [selectedCheck, setSelectedCheck] = useState<MarketCheckItem | null>(null);
  const setup = useMemo(() => buildSetupMetrics(rows), [rows]);
  const needAction = rows.filter((check) => check.status !== "normal").length;

  function handleSaved(next: MarketCheckItem) {
    setRows((current) => current.map((item) => item.id === next.id ? next : item));
    setSelectedCheck(next);
  }

  return (
    <AppShell activeHref="/field-checks">
      <PageHeader eyebrow="Product Test" title="Test sản phẩm" subtitle="Đọc dữ liệu test thật, nhập kết quả thật vào DB."><span className="badge">{needAction} cần xử lý</span></PageHeader>
      <FilterBar filters={[{ label: "Nguồn", value: "DB thật" }, { label: "Tuyến", value: "Tất cả" }, { label: "Đánh giá", value: "Tất cả" }]} />

      <section className={styles.setupGrid}>
        <div className={styles.setupCard}>
          <span>File setup</span>
          <h2>Đợt test sản phẩm</h2>
          <p>Quản lý sản phẩm test, điểm bán được gán và trạng thái nhập kết quả.</p>
          <div className={styles.setupMetrics}>
            <strong><b>{setup.products}</b><small>Sản phẩm</small></strong>
            <strong><b>{setup.accounts}</b><small>Điểm bán</small></strong>
            <strong><b>{setup.pending}</b><small>Chờ nhập</small></strong>
          </div>
        </div>

        <div className={styles.setupCard}>
          <span>Nhập kết quả</span>
          <h2>{needAction} cần xử lý</h2>
          <p>Lưu trực tiếp vào bảng test_customer_results, không còn màn mock nghiệp vụ.</p>
        </div>
      </section>

      <CompactKpiStrip items={kpis} />

      <section className={styles.section}>
        <div className="dashboard-section-head"><h2>Kết quả theo điểm bán</h2><span>{rows.length} dòng</span></div>
        <div className={styles.list}>{rows.map((check) => <TestResultCard key={check.id} check={check} onSelect={setSelectedCheck} />)}</div>
      </section>

      <section className={`card ${styles.nextCard}`}><h2 className="panel-title">Điểm cần theo dõi</h2><div className="grid"><div className="metric-row"><span>Kết quả</span><strong>Cập nhật thật</strong></div><div className="metric-row"><span>Rủi ro</span><strong>Theo dõi</strong></div><div className="metric-row"><span>Việc cần làm</span><strong>Xử lý ở gate sau</strong></div></div></section>

      <FieldCheckSheet check={selectedCheck} onClose={() => setSelectedCheck(null)} onSaved={handleSaved} />
    </AppShell>
  );
}
