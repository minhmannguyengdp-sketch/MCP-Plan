"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { PageHeader } from "@/ui/layout/PageHeader";
import { AppShell } from "@/ui/shell/AppShell";

type RouteOption = { id: string; name: string; area?: string; salesOwner?: string; status?: string };
type OrderItem = { productName: string; quantity: string; unitPrice: string; unit: string; note: string };
type TestItem = { productName: string; defaultStatus: string; note: string };
type SkipReasonItem = { reasonType: string; reasonText: string; note: string };
type OrderTemplate = { routeId: string; title: string; note: string; items: OrderItem[] };
type TestTemplate = { routeId: string; title: string; note: string; items: TestItem[] };
type ReportTemplate = { routeId: string; title: string; reportType: string; content: string; priceSummary: string; competitorSummary: string; displaySummary: string; stockSummary: string; demandSummary: string; opportunitySummary: string; riskSummary: string; nextAction: string; note: string };
type FollowupTemplate = { routeId: string; title: string; dueDays: string; priority: string; owner: string; note: string; followupType: string };
type SkipReasonTemplate = { routeId: string; title: string; note: string; items: SkipReasonItem[] };
type CustomerAddRule = { routeId: string; addMode: string; note: string };
type RouteSessionStatus = { id: string; routeId: string; routeName?: string; sessionDate: string; status: string; note: string; plannedCustomers: number; visitedCustomers: number };
type SettingsData = { routes: RouteOption[]; selectedRouteId: string; orderTemplate: OrderTemplate | null; testTemplate: TestTemplate | null; reportTemplate: ReportTemplate | null; followupTemplate: FollowupTemplate | null };
type SkipReasonData = { routes: RouteOption[]; selectedRouteId: string; skipReasonTemplate: SkipReasonTemplate | null };
type CustomerAddRuleData = { routes: RouteOption[]; selectedRouteId: string; customerAddRule: CustomerAddRule | null };
type SessionStatusData = { routes: RouteOption[]; selectedRouteId: string; sessions: RouteSessionStatus[] };

const emptyOrderItem = (): OrderItem => ({ productName: "", quantity: "1", unitPrice: "0", unit: "", note: "" });
const emptyTestItem = (): TestItem => ({ productName: "", defaultStatus: "tested", note: "" });
const emptySkipReasonItem = (): SkipReasonItem => ({ reasonType: "skip", reasonText: "", note: "" });
const emptyOrderTemplate = (routeId = ""): OrderTemplate => ({ routeId, title: "Mẫu đơn hàng", note: "", items: [emptyOrderItem()] });
const emptyTestTemplate = (routeId = ""): TestTemplate => ({ routeId, title: "Mẫu test sản phẩm", note: "", items: [emptyTestItem()] });
const emptyReportTemplate = (routeId = ""): ReportTemplate => ({ routeId, title: "Mẫu báo cáo thị trường", reportType: "price", content: "", priceSummary: "", competitorSummary: "", displaySummary: "", stockSummary: "", demandSummary: "", opportunitySummary: "", riskSummary: "", nextAction: "", note: "" });
const emptyFollowupTemplate = (routeId = "", owner = ""): FollowupTemplate => ({ routeId, title: "Mẫu follow-up", dueDays: "1", priority: "medium", owner, note: "", followupType: "general" });
const emptySkipReasonTemplate = (routeId = ""): SkipReasonTemplate => ({ routeId, title: "Mẫu lý do bỏ qua/không mua", note: "", items: [{ reasonType: "skip", reasonText: "Khách đóng cửa", note: "" }, { reasonType: "no_buy", reasonText: "Còn tồn hàng", note: "" }] });
const emptyCustomerAddRule = (routeId = ""): CustomerAddRule => ({ routeId, addMode: "session_only", note: "" });

const addModeLabels: Record<string, string> = { session_only: "Chỉ thêm vào phiên", route_only: "Thêm vào tuyến cố định", both: "Thêm cả hai" };
const sessionStatusLabels: Record<string, string> = { active: "Đang hoạt động", done: "Đã hoàn tất", cancelled: "Đã hủy" };

function cleanOrderItems(items: OrderItem[]) { return items.map((item) => ({ productName: item.productName.trim(), quantity: Number(item.quantity || 0), unitPrice: Number(item.unitPrice || 0), unit: item.unit.trim(), note: item.note.trim() })).filter((item) => item.productName); }
function cleanTestItems(items: TestItem[]) { return items.map((item) => ({ productName: item.productName.trim(), defaultStatus: item.defaultStatus || "tested", note: item.note.trim() })).filter((item) => item.productName); }
function cleanSkipReasonItems(items: SkipReasonItem[]) { return items.map((item) => ({ reasonType: item.reasonType || "skip", reasonText: item.reasonText.trim(), note: item.note.trim() })).filter((item) => item.reasonText); }

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store", headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || payload.detail || "Không tải được cài đặt tuyến");
  return payload.data as T;
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
  const [skipReasonTemplate, setSkipReasonTemplate] = useState<SkipReasonTemplate>(emptySkipReasonTemplate());
  const [customerAddRule, setCustomerAddRule] = useState<CustomerAddRule>(emptyCustomerAddRule());
  const [sessions, setSessions] = useState<RouteSessionStatus[]>([]);
  const [selectedSessionDate, setSelectedSessionDate] = useState("");
  const [sessionStatus, setSessionStatus] = useState("active");
  const [sessionStatusNote, setSessionStatusNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();
  const selectedRoute = useMemo(() => routes.find((route) => route.id === selectedRouteId) || null, [routes, selectedRouteId]);
  const selectedSession = useMemo(() => sessions.find((session) => session.sessionDate === selectedSessionDate) || null, [sessions, selectedSessionDate]);

  function applyData(data: SettingsData, skipData: SkipReasonData, addRuleData: CustomerAddRuleData, sessionData: SessionStatusData) {
    const routeId = data.selectedRouteId || skipData.selectedRouteId || addRuleData.selectedRouteId || sessionData.selectedRouteId || data.routes?.[0]?.id || skipData.routes?.[0]?.id || addRuleData.routes?.[0]?.id || sessionData.routes?.[0]?.id || "";
    const routeList = data.routes?.length ? data.routes : skipData.routes?.length ? skipData.routes : addRuleData.routes?.length ? addRuleData.routes : sessionData.routes || [];
    const owner = routeList.find((route) => route.id === routeId)?.salesOwner || "";
    const nextSessions = sessionData.sessions || [];
    const firstSession = nextSessions[0] || null;
    setRoutes(routeList);
    setSelectedRouteId(routeId);
    setOrderTemplate(data.orderTemplate || emptyOrderTemplate(routeId));
    setTestTemplate(data.testTemplate || emptyTestTemplate(routeId));
    setReportTemplate(data.reportTemplate || emptyReportTemplate(routeId));
    setFollowupTemplate(data.followupTemplate || emptyFollowupTemplate(routeId, owner));
    setSkipReasonTemplate(skipData.skipReasonTemplate || emptySkipReasonTemplate(routeId));
    setCustomerAddRule(addRuleData.customerAddRule || emptyCustomerAddRule(routeId));
    setSessions(nextSessions);
    setSelectedSessionDate(firstSession?.sessionDate || "");
    setSessionStatus(firstSession?.status || "active");
    setSessionStatusNote(firstSession?.note || "");
  }

  function load(routeId?: string) {
    startLoading(async () => {
      try {
        setMessage(null);
        const suffix = routeId ? `?routeId=${encodeURIComponent(routeId)}` : "";
        const [data, skipData, addRuleData, sessionData] = await Promise.all([
          getJson<SettingsData>(`/api/backend/mcp-settings/templates${suffix}`),
          getJson<SkipReasonData>(`/api/backend/mcp-settings/skip-reason-template${suffix}`),
          getJson<CustomerAddRuleData>(`/api/backend/mcp-settings/customer-add-rule${suffix}`),
          getJson<SessionStatusData>(`/api/backend/mcp-settings/session-status${suffix}`)
        ]);
        applyData(data, skipData, addRuleData, sessionData);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Không tải được cài đặt");
      }
    });
  }

  useEffect(() => { load(); }, []);

  function chooseSession(sessionDate: string) {
    const session = sessions.find((item) => item.sessionDate === sessionDate) || null;
    setSelectedSessionDate(sessionDate);
    setSessionStatus(session?.status || "active");
    setSessionStatusNote(session?.note || "");
  }

  function save(kind: "order" | "test" | "report" | "followup" | "skip" | "add_rule" | "session_status") {
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
        if (kind === "skip") {
          const items = cleanSkipReasonItems(skipReasonTemplate.items);
          if (!items.length) throw new Error("Cần nhập ít nhất một lý do");
          const result = await postSetting("/api/backend/mcp-settings/skip-reason-template", { ...skipReasonTemplate, routeId, items });
          setMessage(`Đã lưu mẫu lý do ${result.itemCount || items.length} dòng`);
        }
        if (kind === "add_rule") {
          const result = await postSetting("/api/backend/mcp-settings/customer-add-rule", { ...customerAddRule, routeId });
          setMessage(`Đã lưu luật thêm khách: ${addModeLabels[result.addMode || customerAddRule.addMode] || customerAddRule.addMode}`);
        }
        if (kind === "session_status") {
          if (!selectedSessionDate) throw new Error("Cần chọn phiên");
          const result = await postSetting("/api/backend/mcp-settings/session-status", { routeId, sessionDate: selectedSessionDate, status: sessionStatus, note: sessionStatusNote });
          setMessage(`Đã cập nhật phiên ${result.sessionDate}: ${sessionStatusLabels[result.status || sessionStatus] || sessionStatus}`);
        }

        load(routeId);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Không lưu được cài đặt");
      }
    });
  }

  return (
    <AppShell activeHref="/mcp">
      <PageHeader eyebrow="Cài đặt tuyến" title="Mẫu nghiệp vụ tuyến" subtitle="Thiết lập mẫu và luật theo từng tuyến cho quy trình MCP." />

      <section className="card"><div className="section-heading"><div><h2 className="panel-title">Tuyến áp dụng</h2><p className="page-subtitle">Mỗi mẫu và luật được lưu riêng theo tuyến đang chọn.</p></div></div><div className="grid"><label className="form-field"><small>Chọn tuyến</small><select value={selectedRouteId} onChange={(event) => { setSelectedRouteId(event.target.value); load(event.target.value); }} disabled={loading || saving}>{routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}</select></label><div className="metric-row"><span>Tuyến đang chọn</span><strong>{selectedRoute ? `${selectedRoute.name} · ${selectedRoute.area || "-"}` : "Chưa chọn"}</strong></div></div></section>

      <section className="card"><div className="section-heading"><div><h2 className="panel-title">1. Mẫu đơn hàng</h2><p className="page-subtitle">Sản phẩm, số lượng, giá và ghi chú mặc định.</p></div><button className="button primary" type="button" onClick={() => save("order")} disabled={saving}>Lưu mẫu đơn</button></div><div className="grid"><label className="form-field"><small>Tên mẫu</small><input value={orderTemplate.title} onChange={(event) => setOrderTemplate((current) => ({ ...current, title: event.target.value }))} /></label><label className="form-field"><small>Ghi chú mẫu</small><textarea value={orderTemplate.note} onChange={(event) => setOrderTemplate((current) => ({ ...current, note: event.target.value }))} /></label></div><div className="mcp-line-list">{orderTemplate.items.map((item, index) => <div className="visit-focus-card" key={`order-${index}`}><span>Sản phẩm mẫu {index + 1}</span><label className="form-field"><small>Tên sản phẩm</small><input value={item.productName} onChange={(event) => setOrderTemplate((current) => ({ ...current, items: current.items.map((row, rowIndex) => rowIndex === index ? { ...row, productName: event.target.value } : row) }))} /></label><label className="form-field"><small>Số lượng mặc định</small><input inputMode="decimal" value={item.quantity} onChange={(event) => setOrderTemplate((current) => ({ ...current, items: current.items.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: event.target.value } : row) }))} /></label><label className="form-field"><small>Giá mặc định</small><input inputMode="decimal" value={item.unitPrice} onChange={(event) => setOrderTemplate((current) => ({ ...current, items: current.items.map((row, rowIndex) => rowIndex === index ? { ...row, unitPrice: event.target.value } : row) }))} /></label><label className="form-field"><small>Đơn vị</small><input value={item.unit} onChange={(event) => setOrderTemplate((current) => ({ ...current, items: current.items.map((row, rowIndex) => rowIndex === index ? { ...row, unit: event.target.value } : row) }))} /></label><label className="form-field"><small>Ghi chú dòng</small><input value={item.note} onChange={(event) => setOrderTemplate((current) => ({ ...current, items: current.items.map((row, rowIndex) => rowIndex === index ? { ...row, note: event.target.value } : row) }))} /></label>{orderTemplate.items.length > 1 ? <button className="button" type="button" onClick={() => setOrderTemplate((current) => ({ ...current, items: current.items.filter((_, rowIndex) => rowIndex !== index) }))}>Xóa sản phẩm</button> : null}</div>)}</div><button className="button" type="button" onClick={() => setOrderTemplate((current) => ({ ...current, items: [...current.items, emptyOrderItem()] }))}>Thêm sản phẩm mẫu</button></section>

      <section className="card"><div className="section-heading"><div><h2 className="panel-title">2. Mẫu test sản phẩm</h2><p className="page-subtitle">Danh sách sản phẩm test và kết quả mặc định.</p></div><button className="button primary" type="button" onClick={() => save("test")} disabled={saving}>Lưu mẫu test</button></div><div className="grid"><label className="form-field"><small>Tên mẫu test</small><input value={testTemplate.title} onChange={(event) => setTestTemplate((current) => ({ ...current, title: event.target.value }))} /></label><label className="form-field"><small>Ghi chú mẫu test</small><textarea value={testTemplate.note} onChange={(event) => setTestTemplate((current) => ({ ...current, note: event.target.value }))} /></label></div><div className="mcp-line-list">{testTemplate.items.map((item, index) => <div className="visit-focus-card" key={`test-${index}`}><span>Sản phẩm test mẫu {index + 1}</span><label className="form-field"><small>Tên sản phẩm test</small><input value={item.productName} onChange={(event) => setTestTemplate((current) => ({ ...current, items: current.items.map((row, rowIndex) => rowIndex === index ? { ...row, productName: event.target.value } : row) }))} /></label><label className="form-field"><small>Kết quả mặc định</small><select value={item.defaultStatus} onChange={(event) => setTestTemplate((current) => ({ ...current, items: current.items.map((row, rowIndex) => rowIndex === index ? { ...row, defaultStatus: event.target.value } : row) }))}><option value="tested">Đã test</option><option value="ok">Khách thích</option><option value="retry">Cần thử lại</option><option value="not_suitable">Chưa phù hợp</option><option value="follow_up">Cần theo dõi</option></select></label><label className="form-field"><small>Ghi chú dòng</small><input value={item.note} onChange={(event) => setTestTemplate((current) => ({ ...current, items: current.items.map((row, rowIndex) => rowIndex === index ? { ...row, note: event.target.value } : row) }))} /></label>{testTemplate.items.length > 1 ? <button className="button" type="button" onClick={() => setTestTemplate((current) => ({ ...current, items: current.items.filter((_, rowIndex) => rowIndex !== index) }))}>Xóa sản phẩm</button> : null}</div>)}</div><button className="button" type="button" onClick={() => setTestTemplate((current) => ({ ...current, items: [...current.items, emptyTestItem()] }))}>Thêm sản phẩm test</button></section>

      <section className="card"><div className="section-heading"><div><h2 className="panel-title">3. Mẫu báo cáo thị trường</h2><p className="page-subtitle">Nội dung gợi ý cho popup báo cáo.</p></div><button className="button primary" type="button" onClick={() => save("report")} disabled={saving}>Lưu mẫu báo cáo</button></div><div className="grid"><label className="form-field"><small>Tên mẫu báo cáo</small><input value={reportTemplate.title} onChange={(event) => setReportTemplate((current) => ({ ...current, title: event.target.value }))} /></label><label className="form-field"><small>Loại báo cáo</small><select value={reportTemplate.reportType} onChange={(event) => setReportTemplate((current) => ({ ...current, reportType: event.target.value }))}><option value="price">Giá</option><option value="competitor">Đối thủ</option><option value="display">Trưng bày</option><option value="stock">Tồn kho</option><option value="demand">Nhu cầu</option></select></label><label className="form-field"><small>Nội dung mẫu</small><textarea value={reportTemplate.content} onChange={(event) => setReportTemplate((current) => ({ ...current, content: event.target.value }))} /></label><label className="form-field"><small>Giá mẫu</small><input value={reportTemplate.priceSummary} onChange={(event) => setReportTemplate((current) => ({ ...current, priceSummary: event.target.value }))} /></label><label className="form-field"><small>Đối thủ mẫu</small><input value={reportTemplate.competitorSummary} onChange={(event) => setReportTemplate((current) => ({ ...current, competitorSummary: event.target.value }))} /></label><label className="form-field"><small>Trưng bày mẫu</small><input value={reportTemplate.displaySummary} onChange={(event) => setReportTemplate((current) => ({ ...current, displaySummary: event.target.value }))} /></label><label className="form-field"><small>Tồn kho mẫu</small><input value={reportTemplate.stockSummary} onChange={(event) => setReportTemplate((current) => ({ ...current, stockSummary: event.target.value }))} /></label><label className="form-field"><small>Nhu cầu mẫu</small><input value={reportTemplate.demandSummary} onChange={(event) => setReportTemplate((current) => ({ ...current, demandSummary: event.target.value }))} /></label><label className="form-field"><small>Cơ hội mẫu</small><input value={reportTemplate.opportunitySummary} onChange={(event) => setReportTemplate((current) => ({ ...current, opportunitySummary: event.target.value }))} /></label><label className="form-field"><small>Rủi ro mẫu</small><input value={reportTemplate.riskSummary} onChange={(event) => setReportTemplate((current) => ({ ...current, riskSummary: event.target.value }))} /></label><label className="form-field"><small>Next action mẫu</small><input value={reportTemplate.nextAction} onChange={(event) => setReportTemplate((current) => ({ ...current, nextAction: event.target.value }))} /></label><label className="form-field"><small>Ghi chú mẫu</small><textarea value={reportTemplate.note} onChange={(event) => setReportTemplate((current) => ({ ...current, note: event.target.value }))} /></label></div></section>

      <section className="card"><div className="section-heading"><div><h2 className="panel-title">4. Mẫu follow-up</h2><p className="page-subtitle">Tiêu đề, ngày hẹn tương đối, ưu tiên, owner và ghi chú.</p></div><button className="button primary" type="button" onClick={() => save("followup")} disabled={saving}>Lưu mẫu follow-up</button></div><div className="grid"><label className="form-field"><small>Tiêu đề mẫu</small><input value={followupTemplate.title} onChange={(event) => setFollowupTemplate((current) => ({ ...current, title: event.target.value }))} /></label><label className="form-field"><small>Hẹn sau số ngày</small><input inputMode="numeric" value={followupTemplate.dueDays} onChange={(event) => setFollowupTemplate((current) => ({ ...current, dueDays: event.target.value }))} /></label><label className="form-field"><small>Ưu tiên mặc định</small><select value={followupTemplate.priority} onChange={(event) => setFollowupTemplate((current) => ({ ...current, priority: event.target.value }))}><option value="low">Thấp</option><option value="medium">Trung bình</option><option value="high">Cao</option><option value="urgent">Khẩn cấp</option></select></label><label className="form-field"><small>Owner mặc định</small><input value={followupTemplate.owner} onChange={(event) => setFollowupTemplate((current) => ({ ...current, owner: event.target.value }))} /></label><label className="form-field"><small>Ghi chú mẫu</small><textarea value={followupTemplate.note} onChange={(event) => setFollowupTemplate((current) => ({ ...current, note: event.target.value }))} /></label></div></section>

      <section className="card"><div className="section-heading"><div><h2 className="panel-title">5. Mẫu lý do bỏ qua/không mua</h2><p className="page-subtitle">Danh sách lý do chuẩn để dùng khi khách bị bỏ qua hoặc đã ghé nhưng không mua.</p></div><button className="button primary" type="button" onClick={() => save("skip")} disabled={saving}>Lưu mẫu lý do</button></div><div className="grid"><label className="form-field"><small>Tên mẫu lý do</small><input value={skipReasonTemplate.title} onChange={(event) => setSkipReasonTemplate((current) => ({ ...current, title: event.target.value }))} /></label><label className="form-field"><small>Ghi chú mẫu</small><textarea value={skipReasonTemplate.note} onChange={(event) => setSkipReasonTemplate((current) => ({ ...current, note: event.target.value }))} /></label></div><div className="mcp-line-list">{skipReasonTemplate.items.map((item, index) => <div className="visit-focus-card" key={`skip-${index}`}><span>Lý do mẫu {index + 1}</span><label className="form-field"><small>Loại lý do</small><select value={item.reasonType} onChange={(event) => setSkipReasonTemplate((current) => ({ ...current, items: current.items.map((row, rowIndex) => rowIndex === index ? { ...row, reasonType: event.target.value } : row) }))}><option value="skip">Bỏ qua</option><option value="no_buy">Không mua</option></select></label><label className="form-field"><small>Nội dung lý do</small><input value={item.reasonText} onChange={(event) => setSkipReasonTemplate((current) => ({ ...current, items: current.items.map((row, rowIndex) => rowIndex === index ? { ...row, reasonText: event.target.value } : row) }))} placeholder="VD: Khách đóng cửa / còn tồn hàng" /></label><label className="form-field"><small>Ghi chú dòng</small><input value={item.note} onChange={(event) => setSkipReasonTemplate((current) => ({ ...current, items: current.items.map((row, rowIndex) => rowIndex === index ? { ...row, note: event.target.value } : row) }))} /></label>{skipReasonTemplate.items.length > 1 ? <button className="button" type="button" onClick={() => setSkipReasonTemplate((current) => ({ ...current, items: current.items.filter((_, rowIndex) => rowIndex !== index) }))}>Xóa lý do</button> : null}</div>)}</div><button className="button" type="button" onClick={() => setSkipReasonTemplate((current) => ({ ...current, items: [...current.items, emptySkipReasonItem()] }))}>Thêm lý do mẫu</button></section>

      <section className="card"><div className="section-heading"><div><h2 className="panel-title">6. Luật thêm khách</h2><p className="page-subtitle">Quy định khách phát sinh được lưu vào phiên, tuyến cố định hoặc cả hai.</p></div><button className="button primary" type="button" onClick={() => save("add_rule")} disabled={saving}>Lưu luật thêm khách</button></div><div className="grid"><label className="form-field"><small>Cách lưu khách phát sinh</small><select value={customerAddRule.addMode} onChange={(event) => setCustomerAddRule((current) => ({ ...current, addMode: event.target.value }))}><option value="session_only">Chỉ thêm vào phiên</option><option value="route_only">Thêm vào tuyến cố định</option><option value="both">Thêm cả hai</option></select></label><div className="metric-row"><span>Luật hiện tại</span><strong>{addModeLabels[customerAddRule.addMode] || customerAddRule.addMode}</strong></div><label className="form-field"><small>Ghi chú luật</small><textarea value={customerAddRule.note} onChange={(event) => setCustomerAddRule((current) => ({ ...current, note: event.target.value }))} placeholder="Ghi chú cách áp dụng luật thêm khách cho tuyến này" /></label></div></section>

      <section className="card"><div className="section-heading"><div><h2 className="panel-title">7. Trạng thái phiên</h2><p className="page-subtitle">Đổi trạng thái phiên hiện có theo tuyến và ngày: active, done hoặc cancelled.</p></div><button className="button primary" type="button" onClick={() => save("session_status")} disabled={saving || !selectedSessionDate}>Lưu trạng thái phiên</button></div><div className="grid"><label className="form-field"><small>Chọn phiên</small><select value={selectedSessionDate} onChange={(event) => chooseSession(event.target.value)} disabled={loading || saving}>{sessions.map((session) => <option key={session.id} value={session.sessionDate}>{session.sessionDate} · {sessionStatusLabels[session.status] || session.status}</option>)}</select></label><label className="form-field"><small>Trạng thái phiên</small><select value={sessionStatus} onChange={(event) => setSessionStatus(event.target.value)} disabled={!selectedSessionDate}><option value="active">active</option><option value="done">done</option><option value="cancelled">cancelled</option></select></label><div className="metric-row"><span>Phiên đang chọn</span><strong>{selectedSession ? `${selectedSession.sessionDate} · ${selectedSession.visitedCustomers}/${selectedSession.plannedCustomers} khách` : "Chưa có phiên"}</strong></div><label className="form-field"><small>Ghi chú trạng thái</small><textarea value={sessionStatusNote} onChange={(event) => setSessionStatusNote(event.target.value)} placeholder="Ghi chú khi hoàn tất hoặc hủy phiên" /></label></div></section>

      {message ? <section className="card"><p className="page-subtitle">{message}</p></section> : null}
    </AppShell>
  );
}
