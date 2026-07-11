"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/ui/overlay/BottomSheet";
import { ExportMenu, buildExportLink } from "@/features/exports/ExportLinks";

type SessionRow = { id: string; routeId: string; routeName: string; sessionDate: string; status: string; note?: string; plannedCustomers: number; visitedCustomers: number; orderCount?: number; testCount?: number; reportCount?: number; followupCount?: number };
type SessionsPayload = { sessions: SessionRow[]; routes: { id: string; name: string }[]; kpis: { label: string; value: string | number; hint: string }[] };
type EditDraft = { sessionDate: string; status: string; note: string };
const labels: Record<string, string> = { active: "Đang chạy", done: "Đã chốt", completed: "Đã chốt", cancelled: "Đã hủy" };
const actionUrl = (id: string) => `/api/backend/mcp-session-actions/${encodeURIComponent(id)}`;
const reportJsonUrl = (id: string) => `/api/mcp-session-report?sessionId=${encodeURIComponent(id)}`;
const sessionExcelUrl = (id: string) => `/api/backend/exports/mcp-sessions.csv?sessionId=${encodeURIComponent(id)}`;
const sessionPdfUrl = (id: string) => `/api/pdf/session-day?sessionId=${encodeURIComponent(id)}`;
function toDraft(s: SessionRow): EditDraft { return { sessionDate: s.sessionDate, status: s.status === "completed" ? "done" : s.status || "active", note: s.note || "" }; }
function branchSummary(s: SessionRow) { return `${s.orderCount || 0} đơn · ${s.testCount || 0} test · ${s.reportCount || 0} BC · ${s.followupCount || 0} follow-up`; }
function isClosedSession(s: SessionRow) { return s.status === "done" || s.status === "completed"; }
function isEditableSession(s: SessionRow) { return !isClosedSession(s) && s.status !== "cancelled"; }
async function callApi(path: string, init: RequestInit) { const r = await fetch(path, { cache: "no-store", headers: { Accept: "application/json", "Content-Type": "application/json" }, ...init }); const p = await r.json().catch(() => ({})); if (!r.ok) throw new Error(p.error || p.message || "Không xử lý được phiên"); return p; }

function SessionExportMenu({ session }: { session: SessionRow }) {
  const closed = isClosedSession(session);
  return <ExportMenu
    label={closed ? "Xuất BC" : "Xuất"}
    groups={[{ title: closed ? "BC phiên đã chốt" : "Phiên này", links: [
      buildExportLink(closed ? "JSON BC phiên" : "JSON BC tạm tính", reportJsonUrl(session.id), "primary", closed ? "Dữ liệu sạch cho AI/Gemini phân tích" : "Dữ liệu tạm tính theo phiên hiện tại"),
      buildExportLink("Excel checklist", sessionExcelUrl(session.id), undefined, "Dữ liệu dòng khách trong phiên"),
      buildExportLink("PDF báo cáo ngày", sessionPdfUrl(session.id), undefined, "Bản in theo phiên")
    ] }]}
  />;
}

export function McpSessionsManagerSafe({ data, filters }: { data: SessionsPayload; filters: { dateFrom: string; dateTo: string; routeId: string; status: string } }) {
  const router = useRouter();
  const [editing, setEditing] = useState<SessionRow | null>(null);
  const [draft, setDraft] = useState<EditDraft>({ sessionDate: "", status: "active", note: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [rebuildingId, setRebuildingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function openEdit(s: SessionRow) { if (!isEditableSession(s)) return; setEditing(s); setDraft(toDraft(s)); setMessage(null); }
  function close() { if (!pending) { setEditing(null); setMessage(null); } }
  function save() { if (!editing) return; startTransition(async () => { try { setMessage(null); await callApi(actionUrl(editing.id), { method: "PATCH", body: JSON.stringify(draft) }); setEditing(null); router.refresh(); } catch (e) { setMessage(e instanceof Error ? e.message : "Không cập nhật được phiên"); } }); }
  function rebuildReport(s: SessionRow) { startTransition(async () => { try { setMessage(null); setRebuildingId(s.id); await callApi("/api/mcp-session-report", { method: "POST", body: JSON.stringify({ sessionId: s.id, source: "manual_rebuild_from_sessions_page" }) }); setMessage(`Đã rebuild BC phiên ${s.routeName} · ${s.sessionDate}`); router.refresh(); } catch (e) { setMessage(e instanceof Error ? e.message : "Không rebuild được BC phiên"); } finally { setRebuildingId(null); } }); }
  return <>
    <form className="filter-bar mcp-session-filter" action="/mcp/sessions"><label className="form-field"><small>Từ</small><input name="dateFrom" type="date" defaultValue={filters.dateFrom} /></label><label className="form-field"><small>Đến</small><input name="dateTo" type="date" defaultValue={filters.dateTo} /></label><label className="form-field"><small>Tuyến</small><select name="routeId" defaultValue={filters.routeId}><option value="">Tất cả tuyến</option>{data.routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}</select></label><label className="form-field"><small>TT</small><select name="status" defaultValue={filters.status}><option value="">Tất cả</option><option value="active">Đang chạy</option><option value="done">Đã chốt</option><option value="cancelled">Đã hủy</option></select></label><button className="button primary" type="submit">Lọc</button></form>
    <div className="grid cards mcp-session-kpis">{data.kpis.map((item) => <article className="card" key={item.label}><div className="card-label">{item.label}</div><div className="card-value">{item.value}</div><p className="card-hint">{item.hint}</p></article>)}</div>
    {message ? <div className="empty-inline" style={{ marginTop: 12 }}>{message}</div> : null}
    <section className="grid mcp-session-list">{data.sessions.length === 0 ? <div className="empty-inline">Chưa có phiên trong bộ lọc.</div> : data.sessions.map((s) => {
      const closed = isClosedSession(s);
      const checklistHref = `/visits?routeId=${encodeURIComponent(s.routeId)}&date=${encodeURIComponent(s.sessionDate)}`;
      return <article className="action-card mcp-session-card" key={s.id}><div><span className="badge">{labels[s.status] || s.status}</span><h3>{s.routeName}</h3><p>{s.sessionDate} · {s.visitedCustomers}/{s.plannedCustomers} khách đã ghé</p><p className="page-subtitle" style={{ marginTop: 4, fontSize: 12 }}>Nhánh trong phiên: {branchSummary(s)}</p></div><div className="mcp-session-card-actions">{closed ? <><Link className="button primary" href={`/reports?sessionId=${encodeURIComponent(s.id)}`} prefetch>Xem BC phiên</Link><SessionExportMenu session={s} /><button className="button" type="button" onClick={() => rebuildReport(s)} disabled={pending || rebuildingId === s.id}>{rebuildingId === s.id ? "Đang rebuild..." : "Rebuild BC"}</button><span className="page-subtitle" style={{ alignSelf: "center", fontSize: 12 }}>Đã khóa checklist</span></> : <><Link className="button primary" href={checklistHref} prefetch>Mở checklist</Link><SessionExportMenu session={s} />{isEditableSession(s) ? <button className="button" type="button" onClick={() => openEdit(s)}>Sửa phiên</button> : null}<span className="page-subtitle" style={{ alignSelf: "center", fontSize: 12 }}>{s.status === "cancelled" ? "Phiên đã hủy" : "Đang khóa xóa"}</span></>}</div></article>;
    })}</section>
    <BottomSheet open={Boolean(editing)} onClose={close} title="Sửa phiên" description={editing ? `${editing.routeName} · chỉ sửa ngày/trạng thái/ghi chú.` : undefined} footer={<div className="sheet-action-grid"><button className="button" type="button" onClick={close} disabled={pending}>Đóng</button><button className="button primary" type="button" onClick={save} disabled={pending}>{pending ? "Đang lưu..." : "Lưu phiên"}</button></div>}>{editing ? <div className="grid"><label className="form-field"><small>Ngày phiên</small><input type="date" value={draft.sessionDate} onChange={(e) => setDraft((d) => ({ ...d, sessionDate: e.target.value }))} /></label><label className="form-field"><small>Trạng thái</small><select value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}><option value="active">Đang chạy</option><option value="done">Đã chốt</option><option value="cancelled">Đã hủy</option></select></label><label className="form-field"><small>Ghi chú</small><textarea value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} /></label>{message ? <p className="page-subtitle order-message">{message}</p> : null}</div> : null}</BottomSheet>
  </>;
}
