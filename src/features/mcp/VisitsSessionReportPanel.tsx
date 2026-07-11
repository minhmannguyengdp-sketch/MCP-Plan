"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/ui/overlay/BottomSheet";
import type { McpDayData } from "@/features/mcp-day/mcp-day.types";

type CountItem = { label: string; count: number };
type Summary = {
  session: { id: string; routeName: string; sessionDate: string; status: string };
  kpis: Array<{ label: string; value: string | number; hint: string }>;
  sections: {
    overview: Record<string, number>;
    competitors: CountItem[];
    usedProducts: CountItem[];
    opportunities: string[];
    risks: string[];
    nextActions: string[];
    observations: Array<{ id: string; customerName: string; note: string; competitors?: string[]; usedProducts?: string[] }>;
    orders: Array<{ id: string; code: string; customerName: string; status: string; total: number; note: string }>;
    tests: Array<{ id: string; customerName: string; productName: string; status: string; note: string }>;
    followups: Array<{ id: string; customerName: string; title: string; dueDate: string; status: string; priority: string; note: string }>;
    skipped: Array<{ id: string; customerName: string; reason: string }>;
  };
};

type ApiPayload = { data?: Summary; error?: string };

function money(value: number) { return `${Math.round(value || 0).toLocaleString("vi-VN")}đ`; }
function buildUrl(mcpDayData: McpDayData) { const params = new URLSearchParams(); if (mcpDayData.run.id) params.set("sessionId", mcpDayData.run.id); if (mcpDayData.run.routeId) params.set("routeId", mcpDayData.run.routeId); if (mcpDayData.run.date) params.set("date", mcpDayData.run.date); return `/api/mcp-session-report?${params.toString()}`; }

function CountList({ items, empty }: { items: CountItem[]; empty: string }) {
  if (!items.length) return <p className="page-subtitle">{empty}</p>;
  return <div className="grid">{items.map((item) => <div className="metric-row" key={item.label}><span>{item.label}</span><strong>{item.count}</strong></div>)}</div>;
}
function TextList({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <p className="page-subtitle">{empty}</p>;
  return <div className="grid">{items.map((item, index) => <div className="metric-row" key={`${item}-${index}`}><span>{item}</span></div>)}</div>;
}
function ObservationList({ items }: { items: Summary["sections"]["observations"] }) {
  if (!items.length) return <p className="page-subtitle">Chưa có quan sát khách trong phiên.</p>;
  return <div className="grid">{items.map((item) => <article className="action-card" key={item.id}><div><span className="badge">Quan sát</span><h3>{item.customerName}</h3><p className="page-subtitle">{item.note || [...(item.competitors || []), ...(item.usedProducts || [])].join(", ") || "Đã ghi quan sát"}</p></div></article>)}</div>;
}
function OrderList({ items }: { items: Summary["sections"]["orders"] }) {
  if (!items.length) return <p className="page-subtitle">Chưa có đơn trong phiên.</p>;
  return <div className="grid">{items.map((item) => <div className="metric-row" key={item.id}><span>{item.code} · {item.customerName}</span><strong>{money(item.total)}</strong></div>)}</div>;
}
function TestList({ items }: { items: Summary["sections"]["tests"] }) {
  if (!items.length) return <p className="page-subtitle">Chưa có test trong phiên.</p>;
  return <div className="grid">{items.map((item) => <div className="metric-row" key={item.id}><span>{item.customerName} · {item.productName || "Sản phẩm test"}</span><strong>{item.status || "tested"}</strong></div>)}</div>;
}
function FollowupList({ items }: { items: Summary["sections"]["followups"] }) {
  if (!items?.length) return <p className="page-subtitle">Chưa có follow-up trong phiên.</p>;
  return <div className="grid">{items.map((item) => <div className="metric-row" key={item.id}><span>{item.customerName} · {item.title}</span><strong>{item.dueDate || item.priority || item.status}</strong></div>)}</div>;
}

export function VisitsSessionReportPanel({ mcpDayData, children }: { mcpDayData: McpDayData; children?: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = useMemo(() => buildUrl(mcpDayData), [mcpDayData]);

  useEffect(() => {
    if (!open || summary || loading) return;
    let active = true;
    setLoading(true);
    fetch(url, { cache: "no-store", headers: { Accept: "application/json" } })
      .then(async (response) => { const payload = await response.json().catch(() => ({})) as ApiPayload; if (!response.ok) throw new Error(payload.error || `report_summary_${response.status}`); if (active) { setSummary(payload.data || null); setError(null); } })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Không tải được BC phiên"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loading, open, summary, url]);

  async function closeSession() {
    if (!mcpDayData.run.id || closing) return;
    if (!window.confirm("Chốt phiên và tạo snapshot BC phiên chính thức?")) return;
    setClosing(true);
    setError(null);
    try {
      const response = await fetch(`/api/backend/mcp-session-actions/${encodeURIComponent(mcpDayData.run.id)}`, { method: "PATCH", cache: "no-store", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ status: "done", sessionDate: mcpDayData.run.date }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `close_session_${response.status}`);
      setSummary(null);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không chốt được phiên");
      setOpen(true);
    } finally {
      setClosing(false);
    }
  }

  const shellStyle = { position: "fixed", right: 14, top: 74, zIndex: 90, display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: "calc(100vw - 28px)" } as const;
  const baseButtonStyle = { minHeight: 34, borderRadius: 999, fontSize: 13, fontWeight: 900, padding: "0 12px", boxShadow: "0 6px 16px rgba(15, 23, 42, 0.08)", backdropFilter: "blur(10px)", cursor: "pointer" } as const;
  const reportButtonStyle = { ...baseButtonStyle, border: "1px solid rgba(37, 99, 235, 0.20)", background: "rgba(239, 246, 255, 0.96)", color: "#1d4ed8" } as const;
  const closeButtonStyle = { ...baseButtonStyle, border: "1px solid rgba(22, 163, 74, 0.22)", background: "rgba(240, 253, 244, 0.96)", color: "#166534" } as const;

  return <>
    <div aria-label="Điều khiển phiên MCP" style={shellStyle}>
      <button type="button" style={reportButtonStyle} onClick={() => { setOpen(true); setSummary(null); }}>BC phiên</button>
      {children}
      <button type="button" style={closeButtonStyle} disabled={closing} onClick={closeSession}>{closing ? "Đang chốt..." : "Chốt phiên"}</button>
    </div>
    <BottomSheet open={open} onClose={() => setOpen(false)} title="BC phiên" description={`${mcpDayData.run.routeName} · ${mcpDayData.run.date}`} footer={<div className="sheet-action-grid"><button className="button" type="button" onClick={() => setOpen(false)}>Đóng</button><button className="button primary" type="button" onClick={() => { setSummary(null); setError(null); }}>Tải lại</button><button className="button" type="button" onClick={closeSession} disabled={closing}>{closing ? "Đang chốt..." : "Chốt phiên"}</button></div>}>
      {loading ? <p className="page-subtitle">Đang tổng hợp dữ liệu phiên...</p> : null}
      {error ? <p className="page-subtitle order-message">{error}</p> : null}
      {summary ? <div className="grid">
        <section className="grid cards">{summary.kpis.map((item) => <article className="card" key={item.label}><div className="card-label">{item.label}</div><div className="card-value">{item.value}</div><p className="card-hint">{item.hint}</p></article>)}</section>
        <section className="card"><h2 className="panel-title">Tổng quan phiên</h2><div className="grid"><div className="metric-row"><span>Khách kế hoạch</span><strong>{summary.sections.overview.planned}</strong></div><div className="metric-row"><span>Đã ghé / Chờ / Bỏ qua</span><strong>{summary.sections.overview.visited}/{summary.sections.overview.pending}/{summary.sections.overview.skipped}</strong></div><div className="metric-row"><span>Quan sát / Đơn / Test / Follow-up</span><strong>{summary.sections.overview.observations}/{summary.sections.overview.orders}/{summary.sections.overview.tests}/{summary.sections.overview.followups}</strong></div></div></section>
        <section className="card"><h2 className="panel-title">Đối thủ</h2><CountList items={summary.sections.competitors} empty="Chưa có dữ liệu đối thủ trong phiên." /></section>
        <section className="card"><h2 className="panel-title">Sản phẩm khách đang dùng</h2><CountList items={summary.sections.usedProducts} empty="Chưa có dữ liệu sản phẩm khách đang dùng." /></section>
        <section className="card"><h2 className="panel-title">Test</h2><TestList items={summary.sections.tests} /></section>
        <section className="card"><h2 className="panel-title">Đơn hàng</h2><OrderList items={summary.sections.orders} /></section>
        <section className="card"><h2 className="panel-title">Follow-up</h2><FollowupList items={summary.sections.followups || []} /></section>
        <section className="card"><h2 className="panel-title">Quan sát chi tiết</h2><ObservationList items={summary.sections.observations} /></section>
        <section className="card"><h2 className="panel-title">Cơ hội</h2><TextList items={summary.sections.opportunities} empty="Chưa ghi cơ hội." /></section>
        <section className="card"><h2 className="panel-title">Rủi ro</h2><TextList items={summary.sections.risks} empty="Chưa ghi rủi ro." /></section>
        <section className="card"><h2 className="panel-title">Next action</h2><TextList items={summary.sections.nextActions} empty="Chưa có next action." /></section>
      </div> : null}
    </BottomSheet>
  </>;
}
