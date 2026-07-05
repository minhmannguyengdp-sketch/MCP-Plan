"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { AppShell } from "@/ui/shell/AppShell";
import { PageHeader } from "@/ui/layout/PageHeader";

type Group = { id: string; key: string; title: string; description: string; status: string; sortOrder: number; items: unknown[] };
type Draft = { title: string; description: string; sortOrder: string };
const emptyDraft: Draft = { title: "", description: "", sortOrder: "0" };

async function requestJson(path: string, init?: RequestInit) {
  const res = await fetch(path, { cache: "no-store", ...init, headers: { Accept: "application/json", "Content-Type": "application/json", ...(init?.headers || {}) } });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || "Không xử lý được nhóm mẫu");
  return payload;
}

export default function Page() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editId, setEditId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function load() {
    try {
      const payload = await requestJson("/api/mcp-report-settings?groupType=market_report&includeInactive=1");
      setGroups(payload.data?.groups || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không tải được nhóm mẫu");
    }
  }

  useEffect(() => { void load(); }, []);

  function edit(group: Group) {
    setEditId(group.id);
    setDraft({ title: group.title, description: group.description || "", sortOrder: String(group.sortOrder || 0) });
  }

  function reset() { setEditId(""); setDraft(emptyDraft); }

  function save() {
    startTransition(() => {
      void (async () => {
        try {
          const body = { groupId: editId || undefined, title: draft.title, description: draft.description, sortOrder: Number(draft.sortOrder || 0) };
          await requestJson("/api/mcp-report-setting-groups", { method: editId ? "PATCH" : "POST", body: JSON.stringify(body) });
          setMessage(editId ? "Đã cập nhật nhóm mẫu." : "Đã thêm nhóm mẫu.");
          reset();
          await load();
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Không lưu được nhóm mẫu");
        }
      })();
    });
  }

  function toggle(group: Group) {
    startTransition(() => {
      void (async () => {
        try {
          await requestJson("/api/mcp-report-setting-groups", { method: "PATCH", body: JSON.stringify({ groupId: group.id, status: group.status === "active" ? "inactive" : "active" }) });
          await load();
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Không đổi trạng thái nhóm");
        }
      })();
    });
  }

  return <AppShell activeHref="/mcp-setting"><PageHeader eyebrow="MCP Setting" title="Nhóm mẫu báo cáo" subtitle="Quản lý nhóm mẫu dùng chung toàn hệ thống."><Link className="button" href="/mcp-setting">Quay lại item mẫu</Link></PageHeader>{message ? <section className="empty-inline"><strong>{message}</strong></section> : null}<section className="card" style={{ marginBottom: 12 }}><div className="grid" style={{ gap: 10 }}><label className="form-field"><small>Tên nhóm</small><input value={draft.title} onChange={(e) => setDraft((c) => ({ ...c, title: e.target.value }))} placeholder="VD: SP đang dùng · Phụ gia" /></label><label className="form-field"><small>Mô tả</small><input value={draft.description} onChange={(e) => setDraft((c) => ({ ...c, description: e.target.value }))} placeholder="Mô tả nhóm mẫu" /></label><label className="form-field"><small>Thứ tự</small><input inputMode="numeric" value={draft.sortOrder} onChange={(e) => setDraft((c) => ({ ...c, sortOrder: e.target.value }))} /></label></div><div className="sheet-action-grid" style={{ marginTop: 12 }}><button className="button primary" type="button" onClick={save} disabled={pending || !draft.title.trim()}>{editId ? "Cập nhật nhóm" : "+ Thêm nhóm"}</button>{editId ? <button className="button" type="button" onClick={reset}>Hủy sửa</button> : null}</div></section><section className="mcp-line-list">{groups.map((group) => <article className="card" key={group.id} style={{ padding: 12 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><div><strong>{group.title}</strong><p className="page-subtitle" style={{ margin: "4px 0 0" }}>{group.description || "Không mô tả"} · {group.items.length} item · thứ tự {group.sortOrder}</p></div><span className="pill">{group.status === "active" ? "Đang bật" : "Đã tắt"}</span></div><div className="sheet-action-grid" style={{ marginTop: 10 }}><button className="button" type="button" onClick={() => edit(group)}>Sửa</button><button className={group.status === "active" ? "button danger" : "button primary"} type="button" onClick={() => toggle(group)}>{group.status === "active" ? "Tắt" : "Bật"}</button></div></article>)}</section></AppShell>;
}
