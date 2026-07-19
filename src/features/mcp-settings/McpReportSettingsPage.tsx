"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AppShell } from "@/ui/shell/AppShell";
import { PageHeader } from "@/ui/layout/PageHeader";
import { userFacingError } from "@/lib/ui/user-facing-error";
import { idempotentMutationFetch } from "@/lib/api/idempotent-fetch";
import styles from "./McpReportSettingsPage.module.css";

const REPORT_SETTINGS_API = "/api/mcp-report-settings";

type SettingItem = {
  id: string;
  key: string;
  label: string;
  value: string;
  category: string;
  brandName: string;
  status: string;
  sortOrder: number;
};

type SettingGroup = {
  id: string;
  key: string;
  title: string;
  description: string;
  status: string;
  sortOrder: number;
  items: SettingItem[];
};

type Draft = {
  label: string;
  value: string;
  category: string;
  brandName: string;
  sortOrder: string;
};

const emptyDraft: Draft = { label: "", value: "", category: "", brandName: "", sortOrder: "0" };

function draftFor(item: SettingItem): Draft {
  return {
    label: item.label,
    value: item.value,
    category: item.category,
    brandName: item.brandName,
    sortOrder: String(item.sortOrder || 0)
  };
}

async function requestJson(path: string, init?: RequestInit) {
  const method = String(init?.method || "GET").toUpperCase();
  const requestInit = {
    cache: "no-store" as const,
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", ...(init?.headers || {}) }
  };
  const response = method === "POST" || method === "PATCH"
    ? await idempotentMutationFetch(path, requestInit, { operation: `report-setting-item.${method.toLowerCase()}` })
    : await fetch(path, requestInit);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || payload.error || payload.message || "Không xử lý được cài đặt mẫu");
  return payload;
}

function statusText(status: string) {
  return status === "active" ? "Đang bật" : "Đã tắt";
}

export function McpReportSettingsPage({ activeHref = "/mcp-setting" }: { activeHref?: string }) {
  const [groups, setGroups] = useState<SettingGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState("");
  const [createDraft, setCreateDraft] = useState<Draft>(emptyDraft);
  const [editingItem, setEditingItem] = useState<SettingItem | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  const activeGroup = useMemo(() => groups.find((group) => group.id === activeGroupId) || groups[0], [groups, activeGroupId]);
  const activeItems = activeGroup?.items || [];
  const activeCount = activeItems.filter((item) => item.status === "active").length;

  async function loadSettings() {
    setLoading(true);
    try {
      const payload = await requestJson(`${REPORT_SETTINGS_API}?groupType=market_report&includeInactive=1`);
      const nextGroups = (payload.data?.groups || []) as SettingGroup[];
      setGroups(nextGroups);
      setActiveGroupId((current) => nextGroups.some((group) => group.id === current) ? current : nextGroups[0]?.id || "");
    } catch (error) {
      setMessage(userFacingError(error, "Không tải được cài đặt báo cáo. Vui lòng thử lại."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  useEffect(() => {
    if (!editingItem) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) setEditingItem(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [editingItem, pending]);

  function openEditor(item: SettingItem) {
    setMessage(null);
    setEditingItem(item);
    setEditDraft(draftFor(item));
  }

  function closeEditor() {
    if (pending) return;
    setEditingItem(null);
    setEditDraft(emptyDraft);
  }

  function saveNewItem() {
    if (!activeGroup) return;
    startTransition(() => {
      void (async () => {
        try {
          setMessage(null);
          await requestJson(REPORT_SETTINGS_API, {
            method: "POST",
            body: JSON.stringify({
              groupId: activeGroup.id,
              label: createDraft.label,
              value: createDraft.value || createDraft.label,
              category: createDraft.category,
              brandName: createDraft.brandName,
              sortOrder: Number(createDraft.sortOrder || 0)
            })
          });
          setCreateDraft(emptyDraft);
          await loadSettings();
          setMessage("Đã thêm mẫu mới.");
        } catch (error) {
          setMessage(userFacingError(error, "Không thêm được lựa chọn. Vui lòng thử lại."));
        }
      })();
    });
  }

  function saveEditedItem() {
    if (!editingItem) return;
    startTransition(() => {
      void (async () => {
        try {
          setMessage(null);
          await requestJson(REPORT_SETTINGS_API, {
            method: "PATCH",
            body: JSON.stringify({
              itemId: editingItem.id,
              label: editDraft.label,
              value: editDraft.value || editDraft.label,
              category: editDraft.category,
              brandName: editDraft.brandName,
              sortOrder: Number(editDraft.sortOrder || 0)
            })
          });
          await loadSettings();
          setEditingItem(null);
          setEditDraft(emptyDraft);
          setMessage("Đã cập nhật mẫu.");
        } catch (error) {
          setMessage(userFacingError(error, "Không cập nhật được lựa chọn. Vui lòng thử lại."));
        }
      })();
    });
  }

  function toggleItem(item: SettingItem) {
    startTransition(() => {
      void (async () => {
        try {
          setMessage(null);
          const nextStatus = item.status === "active" ? "inactive" : "active";
          await requestJson(REPORT_SETTINGS_API, {
            method: "PATCH",
            body: JSON.stringify({ itemId: item.id, status: nextStatus })
          });
          await loadSettings();
          setMessage(nextStatus === "active" ? "Đã bật lựa chọn." : "Đã tắt lựa chọn.");
        } catch (error) {
          setMessage(userFacingError(error, "Không thay đổi được trạng thái. Vui lòng thử lại."));
        }
      })();
    });
  }

  return (
    <AppShell activeHref={activeHref}>
      <PageHeader
        eyebrow="Cài đặt MCP"
        title="Lựa chọn nhanh cho báo cáo thị trường"
        subtitle="Quản lý đối thủ, sản phẩm đang dùng và nội dung ghi nhận để nhân viên sử dụng thống nhất."
      />

      <section className="mcp-gate-banner">
        <strong>Mẫu dùng chung</strong>
        <span>Các lựa chọn đang bật sẽ xuất hiện trong biểu mẫu báo cáo của mọi tuyến.</span>
      </section>

      {message ? <p className="page-subtitle order-message" role="status">{message}</p> : null}

      <div className="mcp-status-chips" role="tablist" aria-label="Nhóm mẫu báo cáo">
        {groups.map((group) => (
          <button className={activeGroup?.id === group.id ? "active" : ""} key={group.id} type="button" onClick={() => { setActiveGroupId(group.id); closeEditor(); }}>
            {group.title} <b>{group.items.filter((item) => item.status === "active").length}</b>
          </button>
        ))}
      </div>

      <section className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <strong>{activeGroup?.title || "Đang tải..."}</strong>
            <p className="page-subtitle" style={{ margin: "4px 0 0" }}>{activeGroup?.description || "Chọn nhóm mẫu để thêm lựa chọn."}</p>
          </div>
          <span className="pill">{activeCount}/{activeItems.length} bật</span>
        </div>

        <div className="grid" style={{ gap: 10 }}>
          <label className="form-field">
            <small>Tên mẫu</small>
            <input value={createDraft.label} onChange={(event) => setCreateDraft((current) => ({ ...current, label: event.target.value }))} placeholder="Nhập tên đối thủ, thương hiệu hoặc lựa chọn" />
          </label>
          <label className="form-field">
            <small>Giá trị lưu</small>
            <input value={createDraft.value} onChange={(event) => setCreateDraft((current) => ({ ...current, value: event.target.value }))} placeholder="Bỏ trống sẽ lấy theo tên mẫu" />
          </label>
          <label className="form-field">
            <small>Nhóm sản phẩm</small>
            <input value={createDraft.category} onChange={(event) => setCreateDraft((current) => ({ ...current, category: event.target.value }))} placeholder="Siro / Sinh tố / Trà / Sữa / Topping" />
          </label>
          <label className="form-field">
            <small>Thương hiệu</small>
            <input value={createDraft.brandName} onChange={(event) => setCreateDraft((current) => ({ ...current, brandName: event.target.value }))} placeholder="Mama / Vina / Berrino..." />
          </label>
          <label className="form-field">
            <small>Thứ tự</small>
            <input inputMode="numeric" value={createDraft.sortOrder} onChange={(event) => setCreateDraft((current) => ({ ...current, sortOrder: event.target.value }))} />
          </label>
        </div>

        <div className="sheet-action-grid" style={{ marginTop: 12 }}>
          <button className="button primary" type="button" onClick={saveNewItem} disabled={pending || loading || !activeGroup || !createDraft.label.trim()}>
            {pending ? "Đang lưu..." : "+ Thêm mẫu"}
          </button>
          <button className="button" type="button" onClick={() => void loadSettings()} disabled={pending || loading}>Tải lại</button>
        </div>
      </section>

      <section className="mcp-line-list">
        {loading ? <div className="empty-inline"><strong>Đang tải mẫu...</strong></div> : null}
        {!loading && activeItems.length === 0 ? <div className="empty-inline"><strong>Chưa có mẫu</strong><p className="page-subtitle">Thêm mẫu đầu tiên cho nhóm này.</p></div> : null}
        {activeItems.map((item) => (
          <article className="card" key={item.id} style={{ padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <strong>{item.label}</strong>
                <p className="page-subtitle" style={{ margin: "4px 0 0" }}>
                  {item.category || "Không nhóm"} · {item.brandName || "Chưa có thương hiệu"} · thứ tự {item.sortOrder}
                </p>
              </div>
              <span className="pill">{statusText(item.status)}</span>
            </div>
            <div className="sheet-action-grid" style={{ marginTop: 10 }}>
              <button className="button" type="button" onClick={() => openEditor(item)} disabled={pending}>Sửa</button>
              <button className={item.status === "active" ? "button danger" : "button primary"} type="button" onClick={() => toggleItem(item)} disabled={pending}>
                {item.status === "active" ? "Tắt" : "Bật"}
              </button>
            </div>
          </article>
        ))}
      </section>

      {editingItem ? (
        <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditor(); }}>
          <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="mcp-setting-edit-title" aria-describedby="mcp-setting-edit-description">
            <header className={styles.header}>
              <div>
                <h2 id="mcp-setting-edit-title">Sửa lựa chọn</h2>
                <p id="mcp-setting-edit-description">Chỉnh trực tiếp “{editingItem.label}”, không làm thay đổi vị trí đang xem.</p>
              </div>
              <button className={styles.close} type="button" onClick={closeEditor} disabled={pending} aria-label="Đóng cửa sổ sửa">×</button>
            </header>

            <div className={styles.body}>
              <label className="form-field">
                <small>Tên mẫu</small>
                <input autoFocus value={editDraft.label} onChange={(event) => setEditDraft((current) => ({ ...current, label: event.target.value }))} />
              </label>
              <label className="form-field">
                <small>Giá trị lưu</small>
                <input value={editDraft.value} onChange={(event) => setEditDraft((current) => ({ ...current, value: event.target.value }))} placeholder="Bỏ trống sẽ lấy theo tên mẫu" />
              </label>
              <label className="form-field">
                <small>Nhóm sản phẩm</small>
                <input value={editDraft.category} onChange={(event) => setEditDraft((current) => ({ ...current, category: event.target.value }))} />
              </label>
              <label className="form-field">
                <small>Thương hiệu</small>
                <input value={editDraft.brandName} onChange={(event) => setEditDraft((current) => ({ ...current, brandName: event.target.value }))} />
              </label>
              <label className="form-field">
                <small>Thứ tự</small>
                <input inputMode="numeric" value={editDraft.sortOrder} onChange={(event) => setEditDraft((current) => ({ ...current, sortOrder: event.target.value }))} />
              </label>
            </div>

            <footer className={styles.actions}>
              <button className="button primary" type="button" onClick={saveEditedItem} disabled={pending || !editDraft.label.trim()} aria-busy={pending}>
                {pending ? "Đang cập nhật..." : "Cập nhật"}
              </button>
              <button className="button" type="button" onClick={closeEditor} disabled={pending}>Hủy</button>
            </footer>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}
