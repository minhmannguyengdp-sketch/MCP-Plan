"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/ui/overlay/BottomSheet";

type SessionRow = { id: string; routeId: string; routeName: string; sessionDate: string; status: string; note?: string; plannedCustomers: number; visitedCustomers: number };
type SessionsPayload = { sessions: SessionRow[]; routes: { id: string; name: string }[]; kpis: { label: string; value: string | number; hint: string }[] };
type EditDraft = { sessionDate: string; status: string; note: string };
const labels: Record<string, string> = { active: "Đang chạy", done: "Đã chốt", completed: "Đã chốt", cancelled: "Đã hủy" };
const actionUrl = (id: string) => `/api/backend/mcp-session-actions/${encodeURIComponent(id)}`;
const sessionExcelUrl = (id: string) => `/api/backend/exports/mcp-sessions.csv?sessionId=${encodeURIComponent(id)}`;
const sessionPdfUrl = (id: string) => `/api/backend/pdf/session-day?sessionId=${encodeURIComponent(id)}`;
function toDraft(s: SessionRow): EditDraft { return { sessionDate: s.sessionDate, status: s.status === "completed" ? "done" : s.status || "active", note: s.note || "" }; }
async function callApi(path: string, init: RequestInit) { const r = await fetch(path, { cache: "no-store", headers: { Accept: "application/json", "Content-Type": "application/json" }, ...init }); const p = await r.json().catch(() => ({})); if (!r.ok) throw new Error(p.error || p.message || "Không xử lý được phiên"); return p; }

export function McpSessionsManagerSafe({ data, filters }: { data: SessionsPayload; filters: { dateFrom: string; dateTo: string; routeId: string; status: string } }) {
  const router = useRouter();
  const [editing, setEditing] = useState<SessionRow | null>(null);
  const [draft, setDraft] = useState<EditDraft>({ sessionDate: "", status: "active", note: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function openEdit(s: SessionRow) { setEditing(s); setDraft(toDraft(s)); setMessage(null); }
  function close() { if (!pending) { setEditing(null); setMessage(null); } }
  function save() { if (!editing) return; startTransition(async () => { try { setMessage(null); await callApi(actionUrl(editing.id), { method: "PATCH", body: JSON.stringify(draft) }); setEditing(null); router.refresh(); } catch (e) { setMessage(e instanceof Error ? e.message : "Không cập nhật được phiên"); } }); }
  return <>
    <form className="filter-bar mcp-session-filter" action="/mcp/sessions"><label className="form-field"><small>Từ</small><input name="dateFrom" type="date" defaultValue={filters.dateFrom} /></label><label className="form-field"><small>Đến</small><input name="dateTo" type="date" defaultValue={filters.dateTo} /></label><label className="form-field"><small>Tuyến</small><select name="routeId" defaultValue={filters.routeId}><option value="">Tất cả tuyến</option>{data.routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}</select></label><label className="form-field"><small>TT</small><select name="status" defaultValue={filters.status}><option value="">Tất cả</option><option value="active">Đang chạy</option><option value="done">Đã chốt</option><option value="cancelled">Đã hủy</option></select></label><button className="button primary" type="submit">Lọc</button></form>
    <div className="grid cards mcp-session-kpis">{data.kpis.map((item) => <article className="card" key={item.label}><div className="card-label">{item.label}</div><div className="card-value">{item.value}</div><p className="card-hint">{item.hint}</p></article>)}</div>
    <section className="grid mcp-session-list">{data.sessions.length === 0 ? <div className="empty-inline">Chưa có phiên trong bộ lọc.</div> : data.sessions.map((s) => <article className="action-card mcp-session-card" key={s.id}><div><span className="badge">{labels[s.status] || s.status}</span><h3>{s.routeName}</h3><p>{s.sessionDate} · {s.visitedCustomers}/{s.plannedCustomers} khách đã ghé</p></div><div className="mcp-session-card-actions"><Link className="button primary" href={`/visits?routeId=${encodeURIComponent(s.routeId)}&date=${encodeURIComponent(s.sessionDate)}`} prefetch>Mở checklist</Link><a className="button" href={sessionExcelUrl(s.id)} target="_blank" rel="noreferrer">Xuất Excel</a><a className="button" href={sessionPdfUrl(s.id)} target="_blank" rel="noreferrer">Xuất PDF</a><button className="button" type="button" onClick={() => openEdit(s)}>Sửa phiên</button><span className="page-subtitle" style={{ alignSelf: "center", fontSize: 12 }}>Đang khóa xóa</span></div></article>)}</section>
    <BottomSheet open={Boolean(editing)} onClose={close} title="Sửa phiên" description={editing ? `${editing.routeName} · chỉ sửa ngày/trạng thái/ghi chú.` : undefined} footer={<div className="sheet-action-grid"><button className="button" type="button" onClick={close} disabled={pending}>Đóng</button><button className="button primary" type="button" onClick={save} disabled={pending}>{pending ? "Đang lưu..." : "Lưu phiên"}</button></div>}>{editing ? <div className="grid"><label className="form-field"><small>Ngày phiên</small><input type="date" value={draft.sessionDate} onChange={(e) => setDraft((d) => ({ ...d, sessionDate: e.target.value }))} /></label><label className="form-field"><small>Trạng thái</small><select value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}><option value="active">Đang chạy</option><option value="done">Đã chốt</option><option value="cancelled">Đã hủy</option></select></label><label className="form-field"><small>Ghi chú</small><textarea value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} /></label>{message ? <p className="page-subtitle order-message">{message}</p> : null}</div> : null}</BottomSheet>
  </>;
}
