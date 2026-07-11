"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { CompactKpiStrip } from "@/ui/cards/CompactKpiStrip";
import { OperationalListCard } from "@/ui/cards/OperationalListCard";
import { FilterBar } from "@/ui/layout/FilterBar";
import { PageHeader } from "@/ui/layout/PageHeader";
import { BottomSheet } from "@/ui/overlay/BottomSheet";
import { AppShell } from "@/ui/shell/AppShell";
import type { MarketCheckItem, MarketCheckSessionGroup, MarketCheckStatus } from "./market-checks.types";
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

function flatten(groups: MarketCheckSessionGroup[]) {
  return groups.flatMap((group) => group.items);
}

function buildSetupMetrics(groups: MarketCheckSessionGroup[]) {
  const rows = flatten(groups);
  const routes = new Set(groups.map((group) => group.routeId).filter(Boolean)).size;
  const customers = new Set(rows.map((check) => check.sessionCustomerId || check.customerId).filter(Boolean)).size;
  const pending = rows.filter((check) => !check.resultId || check.stockStatus === "pending").length;
  return { routes, sessions: groups.length, customers, pending };
}

function buildKpis(groups: MarketCheckSessionGroup[]) {
  const rows = flatten(groups);
  const done = rows.filter((check) => Boolean(check.resultId)).length;
  const opportunities = rows.filter((check) => check.status === "opportunity").length;
  const risks = rows.filter((check) => check.status === "risk").length;
  return [
    { label: "Phiên có test", value: groups.length, hint: "Gom theo sessionId" },
    { label: "Dòng test", value: rows.length, hint: "Trong các phiên MCP" },
    { label: "Đã nhập", value: done, hint: "Có kết quả" },
    { label: "Cơ hội / Rủi ro", value: `${opportunities}/${risks}`, hint: "Từ kết quả test" }
  ];
}

function sessionStatusLabel(status: string) {
  if (status === "done" || status === "completed") return "Đã chốt";
  if (status === "cancelled") return "Đã hủy";
  return "Đang chạy";
}

function TestSessionCard({ group, onOpen }: { group: MarketCheckSessionGroup; onOpen: (group: MarketCheckSessionGroup) => void }) {
  return (
    <OperationalListCard
      leading={<span>{group.resultCount}</span>}
      eyebrow={`${group.sessionDate || "-"} · ${group.routeName}`}
      title="Nhánh test trong phiên MCP"
      description={`${group.customerCount} khách có test · ${group.resultCount} kết quả · ${sessionStatusLabel(group.status)}`}
      badge={<strong className={styles.status}>{group.riskCount > 0 ? `${group.riskCount} rủi ro` : `${group.opportunityCount} cơ hội`}</strong>}
      meta={[`routeId: ${group.routeId || "-"}`, `sessionId: ${group.sessionId}`, `${group.visitedCustomers}/${group.plannedCustomers} khách đã ghé`]}
      actions={[{ label: "Xem nhánh", tone: "primary", onClick: () => onOpen(group) }]}
    />
  );
}

function InlineTestRow({ check, onSelect }: { check: MarketCheckItem; onSelect: (check: MarketCheckItem) => void }) {
  return (
    <article className={styles.testRow}>
      <div>
        <strong>{check.accountName}</strong>
        <small>{check.productName} · {check.area || check.phone || "Chưa có khu vực"}</small>
        <span>{check.note}</span>
      </div>
      <strong className={getStatusClass(check.status)}>{getStatusLabel(check.status)}</strong>
      <button className="button primary" type="button" onClick={() => onSelect(check)}>Nhập</button>
    </article>
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
  sessionId?: string;
  sessionCustomerId?: string;
  routeId?: string;
  sessionDate?: string;
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
      note,
      sessionId: check.sessionId,
      sessionCustomerId: check.sessionCustomerId,
      routeId: check.routeId,
      sessionDate: check.sessionDate
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
      title={check ? check.productName : "Chi tiết test"}
      description={check ? `${check.accountName} · ${check.routeName} · ${check.sessionDate || check.date}` : undefined}
      footer={
        <div className="sheet-action-grid">
          <button className="button primary" disabled={saving} form="field-check-save-form" type="submit">{saving ? "Đang lưu..." : "Lưu kết quả"}</button>
          <button className="button" type="button" onClick={onClose}>Đóng</button>
        </div>
      }
    >
      {check ? (
        <form className="field-sheet-content" id="field-check-save-form" onSubmit={submit}>
          <div className="field-focus-card"><span>Khách trong phiên</span><strong>{check.accountName}</strong><small>{check.sessionCustomerId || "Dữ liệu từ phiên MCP"}</small></div>
          <div className="grid">
            <label className="metric-row"><span>Sản phẩm</span><input value={productName} onChange={(event) => setProductName(event.target.value)} required /></label>
            <label className="metric-row"><span>Kết quả</span><select value={status} onChange={(event) => setStatus(event.target.value as MarketCheckStatus)}><option value="normal">Bình thường</option><option value="opportunity">Cơ hội</option><option value="risk">Rủi ro</option></select></label>
            <div className="metric-row"><span>Session</span><strong>{check.sessionId || "-"}</strong></div>
            <div className="metric-row"><span>Ngày</span><strong>{check.sessionDate || check.date || "-"}</strong></div>
          </div>
          <label className="sheet-note-card"><h3>Ghi chú kết quả</h3><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} placeholder="Nhập nhận xét, tồn kho, phản hồi khách, việc cần xử lý..." /></label>
          {error ? <p className={styles.errorText}>{error}</p> : null}
        </form>
      ) : null}
    </BottomSheet>
  );
}

function SessionBranchSheet({ group, onClose, onSelect }: { group: MarketCheckSessionGroup | null; onClose: () => void; onSelect: (check: MarketCheckItem) => void }) {
  return (
    <BottomSheet
      open={Boolean(group)}
      onClose={onClose}
      title={group ? `Nhánh test · ${group.routeName}` : "Nhánh test"}
      description={group ? `${group.sessionDate} · sessionId: ${group.sessionId}` : undefined}
      footer={<div className="sheet-action-grid"><Link className="button primary" href={group ? `/visits?routeId=${encodeURIComponent(group.routeId)}&date=${encodeURIComponent(group.sessionDate)}` : "/visits"}>Mở checklist phiên</Link><button className="button" type="button" onClick={onClose}>Đóng</button></div>}
    >
      {group ? (
        <div className={styles.branchSheet}>
          <div className={styles.branchMetrics}>
            <strong><b>{group.customerCount}</b><small>Khách có test</small></strong>
            <strong><b>{group.resultCount}</b><small>Kết quả</small></strong>
            <strong><b>{group.pendingCount}</b><small>Chờ nhập</small></strong>
            <strong><b>{group.riskCount}</b><small>Rủi ro</small></strong>
          </div>
          <div className={styles.detailList}>{group.items.map((check) => <InlineTestRow check={check} key={check.id} onSelect={onSelect} />)}</div>
        </div>
      ) : null}
    </BottomSheet>
  );
}

export function MarketChecksClientPage({ groups }: { groups: MarketCheckSessionGroup[] }) {
  const [sessionGroups, setSessionGroups] = useState(groups);
  const [selectedGroup, setSelectedGroup] = useState<MarketCheckSessionGroup | null>(null);
  const [selectedCheck, setSelectedCheck] = useState<MarketCheckItem | null>(null);
  const setup = useMemo(() => buildSetupMetrics(sessionGroups), [sessionGroups]);
  const liveKpis = useMemo(() => buildKpis(sessionGroups), [sessionGroups]);
  const needAction = setup.pending + sessionGroups.reduce((sum, group) => sum + group.riskCount, 0);

  function handleSaved(next: MarketCheckItem) {
    setSessionGroups((current) => current.map((group) => {
      if (group.sessionId !== next.sessionId) return group;
      const items = group.items.map((item) => item.id === next.id ? next : item);
      const pendingCount = items.filter((item) => !item.resultId || item.stockStatus === "pending").length;
      const opportunityCount = items.filter((item) => item.status === "opportunity").length;
      const riskCount = items.filter((item) => item.status === "risk").length;
      return { ...group, items, pendingCount, opportunityCount, riskCount, resultCount: items.filter((item) => item.resultId).length };
    }));
    setSelectedGroup((current) => current?.sessionId === next.sessionId ? { ...current, items: current.items.map((item) => item.id === next.id ? next : item) } : current);
  }

  return (
    <AppShell activeHref="/mcp">
      <PageHeader eyebrow="MCP / Admin phụ" title="Tổng hợp test theo phiên" subtitle="Màn phụ để rà soát test. Test vẫn được ghi từ /visits → khách → Ghi test, gom theo routeId + sessionDate + sessionId."><span className="badge">{needAction} cần xử lý</span></PageHeader>
      <FilterBar filters={[{ label: "Nguồn", value: "Phiên MCP" }, { label: "Nhóm", value: "routeId + ngày + sessionId" }, { label: "Màn", value: "Admin phụ" }]} />

      <section className={styles.setupGrid}>
        <div className={styles.setupCard}>
          <span>Session setup</span>
          <h2>Test nằm trong phiên MCP</h2>
          <p>Không còn dàn flat từng dòng như module riêng. Danh sách dưới đây là từng phiên có nhánh test.</p>
          <div className={styles.setupMetrics}>
            <strong><b>{setup.sessions}</b><small>Phiên</small></strong>
            <strong><b>{setup.routes}</b><small>Tuyến</small></strong>
            <strong><b>{setup.customers}</b><small>Khách</small></strong>
          </div>
        </div>

        <div className={styles.setupCard}>
          <span>Nhập kết quả</span>
          <h2>{needAction} cần xử lý</h2>
          <p>Vào từng phiên để xem các khách/sản phẩm test và nhập kết quả khi cần.</p>
        </div>
      </section>

      <CompactKpiStrip items={liveKpis} />

      <section className={styles.section}>
        <div className="dashboard-section-head"><h2>Phiên có nhánh test</h2><span>{sessionGroups.length} phiên</span></div>
        <div className={styles.list}>{sessionGroups.length ? sessionGroups.map((group) => <TestSessionCard key={group.sessionId} group={group} onOpen={setSelectedGroup} />) : <div className="empty-inline">Chưa có test nào được gắn với phiên MCP.</div>}</div>
      </section>

      <section className={`card ${styles.nextCard}`}><h2 className="panel-title">Vai trò màn này</h2><div className="grid"><div className="metric-row"><span>Thao tác chính</span><strong>/visits</strong></div><div className="metric-row"><span>Màn này</span><strong>Tổng hợp phụ</strong></div><div className="metric-row"><span>Logic nhóm</span><strong>routeId + ngày + sessionId</strong></div></div></section>

      <SessionBranchSheet group={selectedGroup} onClose={() => setSelectedGroup(null)} onSelect={setSelectedCheck} />
      <FieldCheckSheet check={selectedCheck} onClose={() => setSelectedCheck(null)} onSaved={handleSaved} />
    </AppShell>
  );
}
