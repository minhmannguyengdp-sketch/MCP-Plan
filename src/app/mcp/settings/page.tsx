"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { PageHeader } from "@/ui/layout/PageHeader";
import { AppShell } from "@/ui/shell/AppShell";

type RouteOption = {
  id: string;
  name: string;
  area?: string;
  salesOwner?: string;
  status?: string;
};

type TemplateItem = {
  productName: string;
  quantity: string;
  unitPrice: string;
  unit: string;
  note: string;
};

type OrderTemplate = {
  id?: string;
  routeId: string;
  title: string;
  note: string;
  items: TemplateItem[];
};

type SettingsPayload = {
  routes: RouteOption[];
  selectedRouteId: string;
  template: OrderTemplate | null;
};

const emptyItem = (): TemplateItem => ({
  productName: "",
  quantity: "1",
  unitPrice: "0",
  unit: "",
  note: ""
});

const emptyTemplate = (routeId = ""): OrderTemplate => ({
  routeId,
  title: "Mẫu đơn hàng",
  note: "",
  items: [emptyItem()]
});

function toTemplateItems(items: TemplateItem[]) {
  return items
    .map((item) => ({
      productName: item.productName.trim(),
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unitPrice || 0),
      unit: item.unit.trim(),
      note: item.note.trim()
    }))
    .filter((item) => item.productName);
}

async function fetchSettings(routeId?: string): Promise<SettingsPayload> {
  const params = new URLSearchParams();
  if (routeId) params.set("routeId", routeId);
  const response = await fetch(`/api/backend/mcp-settings/order-template${params.toString() ? `?${params}` : ""}`, {
    cache: "no-store",
    headers: { Accept: "application/json" }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || payload.detail || "Không tải được cài đặt mẫu đơn");
  return payload.data as SettingsPayload;
}

async function saveSettings(template: OrderTemplate) {
  const response = await fetch("/api/backend/mcp-settings/order-template", {
    method: "POST",
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      routeId: template.routeId,
      title: template.title,
      note: template.note,
      items: toTemplateItems(template.items)
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || payload.detail || "Không lưu được mẫu đơn");
  return payload.data;
}

export default function McpSettingsPage() {
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [template, setTemplate] = useState<OrderTemplate>(emptyTemplate());
  const [message, setMessage] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();

  const selectedRoute = useMemo(() => routes.find((route) => route.id === selectedRouteId) || null, [routes, selectedRouteId]);

  function load(routeId?: string) {
    startLoading(async () => {
      try {
        setMessage(null);
        const data = await fetchSettings(routeId);
        setRoutes(data.routes || []);
        const resolvedRouteId = data.selectedRouteId || data.routes?.[0]?.id || "";
        setSelectedRouteId(resolvedRouteId);
        setTemplate(data.template || emptyTemplate(resolvedRouteId));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Không tải được cài đặt");
      }
    });
  }

  useEffect(() => {
    load();
  }, []);

  function selectRoute(routeId: string) {
    setSelectedRouteId(routeId);
    load(routeId);
  }

  function updateTemplate(field: "title" | "note", value: string) {
    setTemplate((current) => ({ ...current, [field]: value }));
  }

  function updateItem(index: number, field: keyof TemplateItem, value: string) {
    setTemplate((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item)
    }));
  }

  function addItem() {
    setTemplate((current) => ({ ...current, items: [...current.items, emptyItem()] }));
  }

  function removeItem(index: number) {
    setTemplate((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }));
  }

  function submit() {
    startSaving(async () => {
      try {
        setMessage(null);
        const items = toTemplateItems(template.items);
        if (!template.routeId && !selectedRouteId) throw new Error("Cần chọn tuyến");
        if (items.length === 0) throw new Error("Cần nhập ít nhất một sản phẩm mẫu");
        const result = await saveSettings({ ...template, routeId: template.routeId || selectedRouteId, items: template.items });
        setMessage(`Đã lưu mẫu đơn ${result.itemCount || items.length} sản phẩm`);
        load(template.routeId || selectedRouteId);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Không lưu được mẫu đơn");
      }
    });
  }

  return (
    <AppShell activeHref="/mcp">
      <PageHeader
        eyebrow="Cài đặt tuyến"
        title="Mẫu đơn hàng"
        subtitle="Thiết lập sản phẩm mẫu theo từng tuyến để dùng lại khi tạo đơn MCP."
      />

      <section className="card">
        <div className="section-heading">
          <div>
            <h2 className="panel-title">Mẫu đơn theo tuyến</h2>
            <p className="page-subtitle">Một tuyến có một mẫu đơn đang hoạt động. Mẫu này chưa tự áp vào popup đơn cho tới gate tiếp theo.</p>
          </div>
          <button className="button primary" type="button" onClick={submit} disabled={saving || loading}>
            {saving ? "Đang lưu..." : "Lưu mẫu đơn"}
          </button>
        </div>

        <div className="grid">
          <label className="form-field">
            <small>Chọn tuyến</small>
            <select value={selectedRouteId} onChange={(event) => selectRoute(event.target.value)} disabled={loading || saving}>
              {routes.map((route) => (
                <option key={route.id} value={route.id}>{route.name}</option>
              ))}
            </select>
          </label>

          <div className="metric-row">
            <span>Tuyến đang chọn</span>
            <strong>{selectedRoute ? `${selectedRoute.name} · ${selectedRoute.area || "-"}` : "Chưa chọn"}</strong>
          </div>

          <label className="form-field">
            <small>Tên mẫu</small>
            <input value={template.title} onChange={(event) => updateTemplate("title", event.target.value)} placeholder="VD: Mẫu đơn trà sữa tuyến Thứ 6" />
          </label>

          <label className="form-field">
            <small>Ghi chú mẫu</small>
            <textarea value={template.note} onChange={(event) => updateTemplate("note", event.target.value)} placeholder="Ghi chú cách dùng mẫu / nhóm khách / điều kiện áp dụng" />
          </label>
        </div>

        <div className="mcp-line-list">
          {template.items.map((item, index) => (
            <div className="visit-focus-card" key={`template-item-${index}`}>
              <span>Sản phẩm mẫu {index + 1}</span>
              <label className="form-field"><small>Tên sản phẩm</small><input value={item.productName} onChange={(event) => updateItem(index, "productName", event.target.value)} placeholder="VD: Trà sữa truyền thống" /></label>
              <label className="form-field"><small>Số lượng mặc định</small><input inputMode="decimal" value={item.quantity} onChange={(event) => updateItem(index, "quantity", event.target.value)} /></label>
              <label className="form-field"><small>Giá mặc định</small><input inputMode="decimal" value={item.unitPrice} onChange={(event) => updateItem(index, "unitPrice", event.target.value)} /></label>
              <label className="form-field"><small>Đơn vị</small><input value={item.unit} onChange={(event) => updateItem(index, "unit", event.target.value)} placeholder="ly / gói / thùng" /></label>
              <label className="form-field"><small>Ghi chú dòng</small><input value={item.note} onChange={(event) => updateItem(index, "note", event.target.value)} placeholder="Ghi chú riêng cho sản phẩm" /></label>
              {template.items.length > 1 ? <button className="button" type="button" onClick={() => removeItem(index)} disabled={saving}>Xóa sản phẩm</button> : null}
            </div>
          ))}
        </div>

        <div className="sheet-action-grid">
          <button className="button" type="button" onClick={addItem} disabled={saving}>Thêm sản phẩm mẫu</button>
          <button className="button primary" type="button" onClick={submit} disabled={saving || loading}>{saving ? "Đang lưu..." : "Lưu mẫu đơn"}</button>
        </div>

        {message ? <p className="page-subtitle">{message}</p> : null}
      </section>
    </AppShell>
  );
}
