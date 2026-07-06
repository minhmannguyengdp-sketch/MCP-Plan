"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AppShell } from "@/ui/shell/AppShell";
import { PageHeader } from "@/ui/layout/PageHeader";

const API = "/api/backend/mcp-report-settings";
type Item = { id: string; label: string; value: string; category: string; brandName: string; status: string; sortOrder: number };
type Group = { id: string; key?: string; title: string; description: string; items: Item[] };
type Draft = { label: string; value: string; category: string; brandName: string; sortOrder: string };
const emptyDraft: Draft = { label: "", value: "", category: "", brandName: "", sortOrder: "0" };

async function json(path: string, init?: RequestInit) {
  const res = await fetch(path, { cache: "no-store", ...init, headers: { Accept: "application/json", "Content-Type": "application/json", ...(init?.headers || {}) } });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || payload.message || "Không xử lý được mẫu");
  return payload;
}
function norm(v: string) { return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d"); }
function kind(group?: Group) { const t = norm(`${group?.key || ""} ${group?.title || ""}`); if (t.includes("doi thu") || t.includes("competitor")) return "competitor"; if (t.includes("field")) return "field"; return "product"; }
function groupCategory(group?: Group) { const title = group?.title || ""; return title.includes("·") ? title.split("·").pop()?.trim() || "" : title.includes("-") ? title.split("-").pop()?.trim() || "" : ""; }
function copyHint(k: string) { if (k === "competitor") return { title: "Tạo chip đối thủ", label: "Tên đối thủ để sales tick", labelPh: "VD: Thu Hương / Đại lý gần nhà / Nguồn chợ", value: "Ghi chú ngắn", valuePh: "VD: giá thấp, đang phủ kệ, chiết khấu mạnh" }; if (k === "field") return { title: "Tạo chip ghi chú nhanh", label: "Nội dung cần tick", labelPh: "VD: Cần báo giá / Thiếu hàng / Muốn test", value: "Gợi ý", valuePh: "VD: hiện khi sales bấm BC" }; return { title: "Nhóm sản phẩm cũ", label: "Không nên thêm brand mới ở đây", labelPh: "Popup BC mới lấy sản phẩm từ catalog thật", value: "Ghi chú", valuePh: "Chỉ dùng khi cần giữ mẫu cũ" }; }

export function McpReportSettingsPageInternal({ activeHref = "/mcp-setting" }: { activeHref?: string }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editId, setEditId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, start] = useTransition();
  const group = useMemo(() => groups.find((g) => g.id === groupId) || groups[0], [groups, groupId]);
  const items = group?.items || [];
  const k = kind(group);
  const hint = copyHint(k);

  async function load() { setLoading(true); setMsg(null); try { const payload = await json(`${API}?groupType=market_report&includeInactive=1`); const next = (payload.data?.groups || []) as Group[]; setGroups(next); setGroupId((cur) => cur || next[0]?.id || ""); } catch (e) { setMsg(e instanceof Error ? e.message : "Không tải được mẫu"); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  function reset() { setDraft(emptyDraft); setEditId(""); }
  function edit(item: Item) { setEditId(item.id); setDraft({ label: item.label, value: item.value, category: item.category, brandName: item.brandName, sortOrder: String(item.sortOrder || 0) }); }
  function save() { if (!group) return; const cat = draft.category || (k === "product" ? groupCategory(group) : ""); start(async () => { try { await json(API, { method: editId ? "PATCH" : "POST", body: JSON.stringify({ groupId: group.id, itemId: editId || undefined, label: draft.label, value: draft.value || draft.label, category: cat, brandName: k === "product" ? draft.brandName : "", sortOrder: Number(draft.sortOrder || 0) }) }); setMsg(editId ? "Đã cập nhật chip tick." : "Đã thêm chip tick mới."); reset(); await load(); } catch (e) { setMsg(e instanceof Error ? e.message : "Không lưu được chip tick"); } }); }
  function toggle(item: Item) { start(async () => { try { await json(API, { method: "PATCH", body: JSON.stringify({ itemId: item.id, status: item.status === "active" ? "inactive" : "active" }) }); await load(); } catch (e) { setMsg(e instanceof Error ? e.message : "Không đổi trạng thái được"); } }); }

  return <AppShell activeHref={activeHref}>
    <PageHeader eyebrow="MCP Setting" title="Mẫu tick báo cáo thị trường" subtitle="Quản lý chip thủ công: đối thủ và ghi chú nhanh. Thương hiệu/sản phẩm trong popup BC lấy từ product catalog thật." />
    <section className="mcp-gate-banner"><strong>Nguyên tắc</strong><span>Đối thủ và ghi chú nhanh có thể tạo ở đây. Các nhóm sản phẩm cũ vẫn giữ lại, nhưng popup BC mới ưu tiên catalog sản phẩm.</span></section>
    {msg ? <p className="page-subtitle order-message">{msg}</p> : null}
    <div className="mcp-status-chips">{groups.map((g) => <button key={g.id} type="button" className={group?.id === g.id ? "active" : ""} onClick={() => { setGroupId(g.id); reset(); }}>{g.title} <b>{g.items.filter((i) => i.status === "active").length}</b></button>)}</div>
    <section className="card" style={{ marginBottom: 12 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}><div><strong>{hint.title}</strong><p className="page-subtitle" style={{ margin: "4px 0 0" }}>{group?.title || "Đang tải"} · {items.filter((i) => i.status === "active").length}/{items.length} đang bật</p></div><span className="pill">{editId ? "Đang sửa" : "Thêm mới"}</span></div><div className="grid" style={{ gap: 10 }}><label className="form-field"><small>{hint.label}</small><input value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} placeholder={hint.labelPh} /></label><label className="form-field"><small>{hint.value}</small><input value={draft.value} onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))} placeholder={hint.valuePh} /></label>{k === "product" ? <label className="form-field"><small>Brand / nguồn hàng nếu cần</small><input value={draft.brandName} onChange={(e) => setDraft((d) => ({ ...d, brandName: e.target.value }))} placeholder="VD: Mama / Vina / Chợ / Nhà cung cấp A" /></label> : null}<label className="form-field"><small>Thứ tự hiển thị</small><input inputMode="numeric" value={draft.sortOrder} onChange={(e) => setDraft((d) => ({ ...d, sortOrder: e.target.value }))} /></label></div><div className="sheet-action-grid" style={{ marginTop: 12 }}><button className="button primary" type="button" onClick={save} disabled={pending || loading || !group || !draft.label.trim()}>{pending ? "Đang lưu..." : editId ? "Cập nhật chip" : "+ Thêm chip tick"}</button>{editId ? <button className="button" type="button" onClick={reset}>Hủy sửa</button> : null}<button className="button" type="button" onClick={() => void load()} disabled={pending || loading}>Tải lại</button></div></section>
    <section className="mcp-line-list">{loading ? <div className="empty-inline"><strong>Đang tải mẫu...</strong></div> : null}{!loading && items.length === 0 ? <div className="empty-inline"><strong>Chưa có chip tick</strong><p className="page-subtitle">Thêm chip đầu tiên cho mục tiêu này.</p></div> : null}{items.map((item) => <article className="card" key={item.id} style={{ padding: 12 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><div><strong>{item.label}</strong><p className="page-subtitle" style={{ margin: "4px 0 0" }}>{item.value || "Không ghi chú"}{item.brandName ? ` · ${item.brandName}` : ""} · thứ tự {item.sortOrder}</p></div><span className="pill">{item.status === "active" ? "Đang bật" : "Đã tắt"}</span></div><div className="sheet-action-grid" style={{ marginTop: 10 }}><button className="button" type="button" onClick={() => edit(item)}>Sửa</button><button className={item.status === "active" ? "button danger" : "button primary"} type="button" onClick={() => toggle(item)}>{item.status === "active" ? "Tắt" : "Bật"}</button></div></article>)}</section>
  </AppShell>;
}
