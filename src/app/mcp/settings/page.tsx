"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { PageHeader } from "@/ui/layout/PageHeader";
import { AppShell } from "@/ui/shell/AppShell";

type RouteOption = { id: string; name: string; area?: string; salesOwner?: string; status?: string };
type OrderItem = { productName: string; quantity: string; unitPrice: string; unit: string; note: string };
type TestItem = { productName: string; defaultStatus: string; note: string };
type OrderTemplate = { routeId: string; title: string; note: string; items: OrderItem[] };
type TestTemplate = { routeId: string; title: string; note: string; items: TestItem[] };
type ReportTemplate = { routeId: string; title: string; reportType: string; content: string; priceSummary: string; competitorSummary: string; displaySummary: string; stockSummary: string; demandSummary: string; opportunitySummary: string; riskSummary: string; nextAction: string; note: string };
type FollowupTemplate = { routeId: string; title: string; dueDays: string; priority: string; owner: string; note: string; followupType: string };
type SettingsData = { routes: RouteOption[]; selectedRouteId: string; orderTemplate: OrderTemplate | null; testTemplate: TestTemplate | null; reportTemplate: ReportTemplate | null; followupTemplate: FollowupTemplate | null };

const emptyOrderItem = (): OrderItem => ({ productName: "", quantity: "1", unitPrice: "0", unit: "", note: "" });
const emptyTestItem = (): TestItem => ({ productName: "", defaultStatus: "tested", note: "" });
const emptyOrderTemplate = (routeId = ""): OrderTemplate => ({ routeId, title: "Mẫu đơn hàng", note: "", items: [emptyOrderItem()] });
const emptyTestTemplate = (routeId = ""): TestTemplate => ({ routeId, title: "Mẫu test sản phẩm", note: "", items: [emptyTestItem()] });
const emptyReportTemplate = (routeId = ""): ReportTemplate => ({ routeId, title: "Mẫu báo cáo thị trường", reportType: "price", content: "", priceSummary: "", competitorSummary: "", displaySummary: "", stockSummary: "", demandSummary: "", opportunitySummary: "", riskSummary: "", nextAction: "", note: "" });
const emptyFollowupTemplate = (routeId = "", owner = ""): FollowupTemplate => ({ routeId, title: "Mẫu follow-up", dueDays: "1", priority: "medium", owner, note: "", followupType: "general" });

function cleanOrderItems(items: OrderItem[]) {
  return items.map((item) => ({ productName: item.productName.trim(), quantity: Number(item.quantity || 0), unitPrice: Number(item.unitPrice || 0), unit: item.unit.trim(), note: item.note.trim() })).filter((item) => item.productName);
}

function cleanTestItems(items: TestItem[]) {
  return items.map((item) => ({ productName: item.productName.trim(), defaultStatus: item.defaultStatus || "tested", note: item.note.trim() })).filter((item) => item.productName);
}

async function getSettings(routeId?: string): Promise<SettingsData> {
  const params = new URLSearchParams();
  if (routeId) params.set("routeId", routeId);
  const response = await fetch(`/api/backend/mcp-settings/templates${params.toString() ? `?${params}` : ""}`, { cache: "no-store", headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || payload.detail || "Không tải được cài đặt tuyến");
  return payload.data as SettingsData;
}

async function postSetting(path: string, body: unknown) {
  const response = await fetch(path, { method: "POST", cache: "no-store", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || payload.detail || "Không lưu được cài đặt");
  return payload.data;
}

export default function McpSettingsPage() {
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [orderTemplate, setOrderTemplate] = useState<OrderTemplate>(emptyOrderTemplate());
  const [testTemplate, setTestTemplate] = useState<TestTemplate>(emptyTestTemplate());
  const [reportTemplate, setReportTemplate] = useState<ReportTemplate>(emptyReportTemplate());
  const [followupTemplate, setFollowupTemplate] = useState<FollowupTemplate>(emptyFollowupTemplate());
  const [message, setMessage] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();
  const selectedRoute = useMemo(() => routes.find((route) => route.id === selectedRouteId) || null, [routes, selectedRouteId]);

  function applyData(data: SettingsData) {
    const routeId = data.selectedRouteId || data.routes?.[0]?.id || "";
    const owner = data.routes?.find((route) => route.id === routeId)?.salesOwner || "";
    setRoutes(data.routes || []);
    setSelectedRouteId(routeId);
    setOrderTemplate(data.orderTemplate || emptyOrderTemplate(routeId));
    setTestTemplate(data.testTemplate || emptyTestTemplate(routeId));
    setReportTemplate(data.reportTemplate || emptyReportTemplate(routeId));
    setFollowupTemplate(data.followupTemplate || emptyFollowupTemplate(routeId, owner));
  }

  function load(routeId?: string) {
    startLoading(async () => {
      try {
        setMessage(null);
        applyData(await getSettings(routeId));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Không tải được cài đặt");
      }
    });
  }

  useEffect(() => { load(); }, []);

  function save(kind: "order" | "test" | "report" | "followup") {
    startSaving(async () => {
      try {
        setMessage(null);
        const routeId = selectedRouteId;
        if (!routeId) throw new Error("Cần chọn tuyến");
        if (kind === "order") {
          const items = cleanOrderItems(orderTemplate.items);
          if (!items.length) throw new Error("Cần nhập ít nhất một sản phẩm mẫu");
          const result = await postSetting("/api/backend/mcp-settings/order-template", { ...orderTemplate, routeId, items });
          setMessage(`Đã lưu mẫu đơn ${result.itemCount || items.length} sản phẩm`);
        }
        if (kind === "test") {
          const items = cleanTestItems(testTemplate.items);
          if (!items.length) throw new Error("Cần nhập ít nhất một sản phẩm test mẫu");
          const result = await postSetting("/api/backend/mcp-settings/test-template", { ...testTemplate, routeId, items });
          setMessage(`Đã lưu mẫu test ${result.itemCount || items.length} sản phẩm`);
        }
        if (kind === "report") {
          const result = await postSetting("/api/backend/mcp-settings/report-template", { ...reportTemplate, routeId });
          setMessage(`Đã lưu mẫu báo cáo ${result.reportType || reportTemplate.reportType}`);
        }
        if (kind === "followup") {
          const result = await postSetting("/api/backend/mcp-settings/followup-template", { ...followupTemplate, routeId });
          setMessage(`Đã lưu mẫu follow-up ${result.priority || followupTemplate.priority}`);
        }
        load(routeId);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Không lưu được cài đặt");
      }
    });
  }

  return (
    <AppShell activeHref="/mcp">
      <PageHeader eyebrow="Cài đặt tuyến" title="Mẫu nghiệp vụ tuyến" subtitle="Thiết lập mẫu theo từng tuyến cho đơn hàng, test sản phẩm, báo cáo thị trường và follow-up." />
      <section className="card"><div className="section-heading"><div><h2 className="panel-title">Tuyến áp dụng</h2><p className="page-subtitle">Mỗi mẫu được lưu riêng theo tuyến đang chọn.</p></div></div><div className="grid"><label className="form-field"><small>Chọn tuyến</small><select value={selectedRouteId} onChange={(event) => { setSelectedRouteId(event.target.value); load(event.target.value); }} disabled={loading || saving}>{routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}</select></label><div className="metric-row"><span>Tuyến đang chọn</span><strong>{selectedRoute ? `${selectedRoute.name} · ${selectedRoute.area || "-"}` : "Chưa chọn"}</strong></div></div></section>
      <section className="card"><div className="section-heading"><div><h2 className="panel-title">1. Mẫu đơn hàng</h2><p className="page-subtitle">Sản phẩm, số lượng, giá và ghi chú mặc định.</p></div><button className="button primary" type="button" onClick={() => save("order")} disabled={saving}>Lưu mẫu đơn</button></div><div className="grid"><label className="form-field"><small>Tên mẫu</small><input value={orderTemplate.title} onChange={(event) => setOrderTemplate((current) => ({ ...current, title: event.target.value }))} /></label><label className="form-field"><small>Ghi chú mẫu</small><textarea value={orderTemplate.note} onChange={(event) => setOrderTemplate((current) => ({ ...current, note: event.target.value }))} /></label></div><div className="mcp-line-list">{orderTemplate.items.map((item, index) => <div className="visit-focus-card" key={`order-${index}`}><span>Sản phẩm mẫu {index + 1}</span><label className="form-field"><small>Tên sản phẩm</small><input value={item.productName} onChange={(event) => setOrderTemplate((current) => ({ ...current, items: current.items.map((row, rowIndex) => rowIndex === index ? { ...row, productName: event.target.value } : row) }))} /></label><label className="form-field"><small>Số lượng mặc định</small><input inputMode="decimal" value={item.quantity} onChange={(event) => setOrderTemplate((current) => ({ ...current, items: current.items.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: event.target.value } : row) }))} /></label><label className="form-field"><small>Giá mặc định</small><input inputMode="decimal" value={item.unitPrice} onChange={(event) => setOrderTemplate((current) => ({ ...current, items: current.items.map((row, rowIndex) => rowIndex === index ? { ...row, unitPrice: event.target.value } : row) }))} /></label><label className="form-field"><small>Đơn vị</small><input value={item.unit} onChange={(event) => setOrderTemplate((current) => ({ ...current, items: current.items.map((row, rowIndex) => rowIndex === index ? { ...row, unit: event.target.value } : row) }))} /></label><label className="form-field"><small>Ghi chú dòng</small><input value={item.note} onChange={(event) => setOrderTemplate((current) => ({ ...current, items: current.items.map((row, rowIndex) => rowIndex === index ? { ...row, note: event.target.value } : row) }))} /></label>{orderTemplate.items.length > 1 ? <button className="button" type="button" onClick={() => setOrderTemplate((current) => ({ ...current, items: current.items.filter((_, rowIndex) => rowIndex !== index) }))}>Xóa sản phẩm</button> : null}</div>)}</div><button className="button" type="button" onClick={() => setOrderTemplate((current) => ({ ...current, items: [...current.items, emptyOrderItem()] }))}>Thêm sản phẩm mẫu</button></section>
      <section className="card"><div className="section-heading"><div><h2 className="panel-title">2. Mẫu test sản phẩm</h2><p className="page-subtitle">Danh sách sản phẩm test và kết quả mặc định.</p></div><button className="button primary" type="button" onClick={() => save("test")} disabled={saving}>Lưu mẫu test</button></div><div className="grid"><label className="form-field"><small>Tên mẫu test</small><input value={testTemplate.title} onChange={(event) => setTestTemplate((current) => ({ ...current, title: event.target.value }))} /></label><label className="form-field"><small>Ghi chú mẫu test</small><textarea value={testTemplate.note} onChange={(event) => setTestTemplate((current) => ({ ...current, note: event.target.value }))} /></label></div><div className="mcp-line-list">{testTemplate.items.map((item, index) => <div className="visit-focus-card" key={`test-${index}`}><span>Sản phẩm test mẫu {index + 1}</span><label className="form-field"><small>Tên sản phẩm test</small><input value={item.productName} onChange={(event) => setTestTemplate((current) => ({ ...current, items: current.items.map((row, rowIndex) => rowIndex === index ? { ...row, productName: event.target.value } : row) }))} /></label><label className="form-field"><small>Kết quả mặc định</small><select value={item.defaultStatus} onChange={(event) => setTestTemplate((current) => ({ ...current, items: current.items.map((row, rowIndex) => rowIndex === index ? { ...row, defaultStatus: event.target.value } : row) }))}><option value="tested">Đã test</option><option value="ok">Khách thích</option><option value="retry">Cần thử lại</option><option value="not_suitable">Chưa phù hợp</option><option value="follow_up">Cần theo dõi</option></select></label><label className="form-field"><small>Ghi chú dòng</small><input value={item.note} onChange={(event) => setTestTemplate((current) => ({ ...current, items: current.items.map((row, rowIndex) => rowIndex === index ? { ...row, note: event.target.value } : row) }))} /></label>{testTemplate.items.length > 1 ? <button className="button" type="button" onClick={() => setTestTemplate((current) => ({ ...current, items: current.items.filter((_, rowIndex) => rowIndex !== index) }))}>Xóa sản phẩm</button> : null}</div>)}</div><button className="button" type="button" onClick={() => setTestTemplate((current) => ({ ...current, items: [...current.items, emptyTestItem()] }))}>Thêm sản phẩm test</button></section>
      <section className="card"><div className="section-heading"><div><h2 className="panel-title">3. Mẫu báo cáo thị trường</h2><p className="page-subtitle">Nội dung gợi ý cho popup báo cáo.</p></div><button className="button primary" type="button" onClick={() => save("report")} disabled={saving}>Lưu mẫu báo cáo</button></div><div className="grid"><label className="form-field"><small>Tên mẫu báo cáo</small><input value={reportTemplate.title} onChange={(event) => setReportTemplate((current) => ({ ...current, title: event.target.value }))} /></label><label className="form-field"><small>Loại báo cáo</small><select value={reportTemplate.reportType} onChange={(event) => setReportTemplate((current) => ({ ...current, reportType: event.target.value }))}><option value="price">Giá</option><option value="competitor">Đối thủ</option><option value="display">Trưng bày</option><option value="stock">Tồn kho</option><option value="demand">Nhu cầu</option></select></label><label className="form-field"><small>Nội dung mẫu</small><textarea value={reportTemplate.content} onChange={(event) => setReportTemplate((current) => ({ ...current, content: event.target.value }))} /></label><label className="form-field"><small>Giá mẫu</small><input value={reportTemplate.priceSummary} onChange={(event) => setReportTemplate((current) => ({ ...current, priceSummary: event.target.value }))} /></label><label className="form-field"><small>Đối thủ mẫu</small><input value={reportTemplate.competitorSummary} onChange={(event) => setReportTemplate((current) => ({ ...current, competitorSummary: event.target.value }))} /></label><label className="form-field"><small>Trưng bày mẫu</small><input value={reportTemplate.displaySummary} onChange={(event) => setReportTemplate((current) => ({ ...current, displaySummary: event.target.value }))} /></label><label className="form-field"><small>Tồn kho mẫu</small><input value={reportTemplate.stockSummary} onChange={(event) => setReportTemplate((current) => ({ ...current, stockSummary: event.target.value }))} /></label><label className="form-field"><small>Nhu cầu mẫu</small><input value={reportTemplate.demandSummary} onChange={(event) => setReportTemplate((current) => ({ ...current, demandSummary: event.target.value }))} /></label><label className="form-field"><small>Cơ hội mẫu</small><input value={reportTemplate.opportunitySummary} onChange={(event) => setReportTemplate((current) => ({ ...current, opportunitySummary: event.target.value }))} /></label><label className="form-field"><small>Rủi ro mẫu</small><input value={reportTemplate.riskSummary} onChange={(event) => setReportTemplate((current) => ({ ...current, riskSummary: event.target.value }))} /></label><label className="form-field"><small>Next action mẫu</small><input value={reportTemplate.nextAction} onChange={(event) => setReportTemplate((current) => ({ ...current, nextAction: event.target.value }))} /></label><label className="form-field"><small>Ghi chú mẫu</small><textarea value={reportTemplate.note} onChange={(event) => setReportTemplate((current) => ({ ...current, note: event.target.value }))} /></label></div></section>
      <section className="card"><div className="section-heading"><div><h2 className="panel-title">4. Mẫu follow-up</h2><p className="page-subtitle">Tiêu đề, ngày hẹn tương đối, ưu tiên, owner và ghi chú.</p></div><button className="button primary" type="button" onClick={() => save("followup")} disabled={saving}>Lưu mẫu follow-up</button></div><div className="grid"><label className="form-field"><small>Tiêu đề mẫu</small><input value={followupTemplate.title} onChange={(event) => setFollowupTemplate((current) => ({ ...current, title: event.target.value }))} /></label><label className="form-field"><small>Hẹn sau số ngày</small><input inputMode="numeric" value={followupTemplate.dueDays} onChange={(event) => setFollowupTemplate((current) => ({ ...current, dueDays: event.target.value }))} /></label><label className="form-field"><small>Ưu tiên mặc định</small><select value={followupTemplate.priority} onChange={(event) => setFollowupTemplate((current) => ({ ...current, priority: event.target.value }))}><option value="low">Thấp</option><option value="medium">Trung bình</option><option value="high">Cao</option><option value="urgent">Khẩn cấp</option></select></label><label className="form-field"><small>Owner mặc định</small><input value={followupTemplate.owner} onChange={(event) => setFollowupTemplate((current) => ({ ...current, owner: event.target.value }))} /></label><label className="form-field"><small>Ghi chú mẫu</small><textarea value={followupTemplate.note} onChange={(event) => setFollowupTemplate((current) => ({ ...current, note: event.target.value }))} /></label></div></section>
      {message ? <section className="card"><p className="page-subtitle">{message}</p></section> : null}
    </AppShell>
  );
}
