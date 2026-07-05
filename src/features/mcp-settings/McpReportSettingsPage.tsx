"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AppShell } from "@/ui/shell/AppShell";
import { PageHeader } from "@/ui/layout/PageHeader";

const REPORT_SETTINGS_API = "/api/backend/mcp-report-settings";

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

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    cache: "no-store",
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", ...(init?.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || payload.message || "Không xử lý được cài đặt mẫu");
  return payload;
}

function statusText(status: string) {
  return status === "active" ? "Đang bật" : "Đã tắt";
}

export function McpReportSettingsPage({ activeHref = "/mcp-setting" }: { activeHref?: string }) {
  const [groups, setGroups] = useState<SettingGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editId, setEditId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  const activeGroup = useMemo(() => groups.find((group) => group.id === activeGroupId) || groups[0], [groups, activeGroupId]);
  const activeItems = activeGroup?.items || [];
  const activeCount = activeItems.filter((item) => item.status === "active").length;

  async function loadSettings() {
    setLoading(true);
    setMessage(null);
    try {
      const payload = await requestJson(`${REPORT_SETTINGS_API}?groupType=market_report&includeInactive=1`);
      const nextGroups = (payload.data?.groups || []) as SettingGroup[];
      setGroups(nextGroups);
      setActiveGroupId((current) => current || nextGroups[0]?.id || "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không tải được mẫu báo cáo");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  function resetForm() {
    setDraft(emptyDraft);
    setEditId("");
  }

  function editItem(item: SettingItem) {
    setEditId(item.id);
    setDraft({
      label: item.label,
      value: item.value,
      category: item.category,
      brandName: item.brandName,
      sortOrder: String(item.sortOrder || 0)
    });
  }

  function saveItem() {
    if (!activeGroup) return;
    startTransition(() => {
      void (async () => {
        try {
          setMessage(null);
          const body = {
            groupId: activeGroup.id,
            itemId: editId || undefined,
            label: draft.label,
            value: draft.value || draft.label,
            category: draft.category,
            brandName: draft.brandName,
            sortOrder: Number(draft.sortOrder || 0)
          };
          await requestJson(REPORT_SETTINGS_API, { method: editId ? "PATCH" : "POST", body: JSON.stringify(body) });
          setMessage(editId ? "Đã cập nhật mẫu." : "Đã thêm mẫu mới.");
          resetForm();
          await loadSettings();
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Không lưu được mẫu");
        }
      })();
    });
  }

  function toggleItem(item: SettingItem) {
    startTransition(() => {
      void (async () => {
        try {
          await requestJson(REPORT_SETTINGS_API, {
            method: "PATCH",
            body: JSON.stringify({ itemId: item.id, status: item.status === "active" ? "inactive" : "active" })
          });
          await loadSettings();
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Không đổi trạng thái được");
        }
      })();
    });
  }

  return (
    <AppShell activeHref={activeHref}>
      <PageHeader
        eyebrow="MCP Setting"
        title="Mẫu báo cáo thị trường"
        subtitle="Quản lý mẫu dùng chung cho toàn hệ thống: đối thủ, sản phẩm đang dùng và field báo cáo."
      />

      <section className="mcp-gate-banner">
        <strong>Global template</strong>
        <span>Không gắn mẫu riêng theo tuyến. Nút BC trong phiên sẽ dùng dữ liệu chung ở đây.</span>
      </section>

      {message ? <p className="page-subtitle order-message">{message}</p> : null}

      <div className="mcp-status-chips" role="tablist" aria-label="Nhóm mẫu báo cáo">
        {groups.map((group) => (
          <button className={activeGroup?.id === group.id ? "active" : ""} key={group.id} type="button" onClick={() => { setActiveGroupId(group.id); resetForm(); }}>
            {group.title} <b>{group.items.filter((item) => item.status === "active").length}</b>
          </button>
        ))}
      </div>

      <section className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <strong>{activeGroup?.title || "Đang tải..."}</strong>
            <p className="page-subtitle" style={{ margin: "4px 0 0" }}>{activeGroup?.description || "Chọn nhóm mẫu để chỉnh."}</p>
          </div>
          <span className="pill">{activeCount}/{activeItems.length} bật</span>
        </div>

        <div className="grid" style={{ gap: 10 }}>
          <label className="form-field">
            <small>Tên mẫu</small>
            <input value={draft.label} onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))} placeholder="VD: Mama / Golden Farm / Thu Hương" />
          </label>
          <label className="form-field">
            <small>Giá trị lưu</small>
            <input value={draft.value} onChange={(event) => setDraft((current) => ({ ...current, value: event.target.value }))} placeholder="Bỏ trống sẽ lấy theo tên mẫu" />
          </label>
          <label className="form-field">
            <small>Nhóm SP</small>
            <input value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} placeholder="Siro / Sinh tố / Trà / Sữa / Topping" />
          </label>
          <label className="form-field">
            <small>Brand</small>
            <input value={draft.brandName} onChange={(event) => setDraft((current) => ({ ...current, brandName: event.target.value }))} placeholder="Mama / Vina / Berrino..." />
          </label>
          <label className="form-field">
            <small>Thứ tự</small>
            <input inputMode="numeric" value={draft.sortOrder} onChange={(event) => setDraft((current) => ({ ...current, sortOrder: event.target.value }))} />
          </label>
        </div>

        <div className="sheet-action-grid" style={{ marginTop: 12 }}>
          <button className="button primary" type="button" onClick={saveItem} disabled={pending || loading || !activeGroup || !draft.label.trim()}>
            {pending ? "Đang lưu..." : editId ? "Cập nhật mẫu" : "+ Thêm mẫu"}
          </button>
          {editId ? <button className="button" type="button" onClick={resetForm} disabled={pending}>Hủy sửa</button> : null}
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
                  {item.category || "Không nhóm"} · {item.brandName || "Không brand"} · thứ tự {item.sortOrder}
                </p>
              </div>
              <span className="pill">{statusText(item.status)}</span>
            </div>
            <div className="sheet-action-grid" style={{ marginTop: 10 }}>
              <button className="button" type="button" onClick={() => editItem(item)} disabled={pending}>Sửa</button>
              <button className={item.status === "active" ? "button danger" : "button primary"} type="button" onClick={() => toggleItem(item)} disabled={pending}>
                {item.status === "active" ? "Tắt" : "Bật"}
              </button>
            </div>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
