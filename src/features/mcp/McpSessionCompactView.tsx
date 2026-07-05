"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/ui/layout/PageHeader";
import { BottomSheet } from "@/ui/overlay/BottomSheet";
import { AppShell } from "@/ui/shell/AppShell";
import type { McpDayData, McpDayLine } from "@/features/mcp-day/mcp-day.types";
import type { RouteCustomersData } from "@/features/mcp/route-customers.types";
import type { RoutesData } from "@/features/routes/routes.types";
import { McpLineCard } from "./McpLineCard";
import { mcpCustomerActionDescription, type McpCustomerAction } from "./mcp-customer-actions";

type SessionTab = "all" | "pending" | "visited" | "skipped" | "added" | "followups";

type OrderDraftItem = {
  productName: string;
  quantity: string;
  unitPrice: string;
  unit: string;
  note: string;
};

type TestProductOption = {
  id: string;
  productName: string;
};

type TestFileOption = {
  id: string;
  title: string;
  testDate?: string;
  products: TestProductOption[];
};

type TestDraftResult = {
  productId: string;
  productName: string;
  status: string;
  note: string;
};

type ReportDraft = {
  reportType: string;
  content: string;
  priceSummary: string;
  competitorSummary: string;
  displaySummary: string;
  stockSummary: string;
  demandSummary: string;
  opportunitySummary: string;
  riskSummary: string;
  nextAction: string;
};

type FollowupDraft = {
  title: string;
  dueDate: string;
  priority: string;
  owner: string;
  note: string;
};

const emptyOrderItem = (): OrderDraftItem => ({ productName: "", quantity: "1", unitPrice: "0", unit: "", note: "" });
const emptyTestResult = (): TestDraftResult => ({ productId: "", productName: "", status: "tested", note: "" });
const emptyReportDraft = (): ReportDraft => ({ reportType: "price", content: "", priceSummary: "", competitorSummary: "", displaySummary: "", stockSummary: "", demandSummary: "", opportunitySummary: "", riskSummary: "", nextAction: "" });
const emptyFollowupDraft = (owner = ""): FollowupDraft => ({ title: "", dueDate: "", priority: "medium", owner, note: "" });

function toOrderPayloadItems(items: OrderDraftItem[]) {
  return items.map((item) => ({ productName: item.productName.trim(), quantity: Number(item.quantity || 0), unitPrice: Number(item.unitPrice || 0), unit: item.unit.trim(), note: item.note.trim() })).filter((item) => item.productName);
}

function toTestPayloadResults(results: TestDraftResult[]) {
  return results.map((item) => ({ productId: item.productId || undefined, productName: item.productName.trim(), status: item.status || "tested", note: item.note.trim() })).filter((item) => item.productId || item.productName);
}

function reportHasContent(report: ReportDraft) {
  return Boolean(report.content.trim() || report.priceSummary.trim() || report.competitorSummary.trim() || report.displaySummary.trim() || report.stockSummary.trim() || report.demandSummary.trim() || report.opportunitySummary.trim() || report.riskSummary.trim() || report.nextAction.trim());
}

function sourceLabel(source: McpDayLine["source"]) {
  if (source === "planned") return "Tuyến gốc";
  if (source === "added") return "Phát sinh";
  return "Đồng bộ";
}

function statusLabel(status: McpDayLine["status"]) {
  if (status === "pending") return "Chờ ghé";
  if (status === "visited") return "Đã ghé";
  if (status === "skipped") return "Bỏ qua / không mua";
  return "Hủy";
}

function actionTitle(action: McpCustomerAction) {
  if (action === "order") return "Tạo đơn hàng";
  if (action === "test") return "Ghi test sản phẩm";
  if (action === "market_report") return "Ghi báo cáo thị trường";
  if (action === "skip") return "Bỏ qua / không mua";
  return "Tạo việc follow-up";
}

function actionSaveLabel(action?: McpCustomerAction) {
  if (action === "order") return "Lưu đơn hàng";
  if (action === "test") return "Lưu test";
  if (action === "market_report") return "Lưu báo cáo";
  if (action === "skip") return "Lưu lý do bỏ qua";
  if (action === "follow_up") return "Lưu follow-up";
  return "Lưu kết quả";
}

async function postMcpBackend(path: string, body: unknown) {
  const response = await fetch(path, { method: "POST", cache: "no-store", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorPayload = payload as { error?: string; detail?: string };
    throw new Error(errorPayload.error || errorPayload.detail || "Không lưu được hành động MCP");
  }
  return payload;
}

async function getMcpBackend(path: string) {
  const response = await fetch(path, { method: "GET", cache: "no-store", headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorPayload = payload as { error?: string; detail?: string };
    throw new Error(errorPayload.error || errorPayload.detail || "Không tải được dữ liệu MCP");
  }
  return payload;
}

function EmptyPanel({ title, hint }: { title: string; hint: string }) {
  return <div className="empty-inline"><strong>{title}</strong><p className="page-subtitle">{hint}</p></div>;
}

function LineList({ lines, onOpen, onAction }: { lines: McpDayLine[]; onOpen: (line: McpDayLine) => void; onAction: (line: McpDayLine, action: McpCustomerAction) => void }) {
  if (lines.length === 0) return <EmptyPanel title="Chưa có dữ liệu" hint="Tab này sẽ có dữ liệu khi checklist phiên phát sinh đúng trạng thái." />;
  return <div className="mcp-line-list">{lines.map((line) => <McpLineCard key={line.id} line={line} onOpen={onOpen} onAction={onAction} />)}</div>;
}

function CustomerSheet({ line, onClose, onAction }: { line: McpDayLine | null; onClose: () => void; onAction: (line: McpDayLine, action: McpCustomerAction) => void }) {
  return (
    <BottomSheet open={Boolean(line)} onClose={onClose} title={line ? line.accountName : "Khách trong checklist"} description={line ? `${line.area} · ${sourceLabel(line.source)}` : undefined} footer={line ? <div className="sheet-action-grid"><button className="button primary" type="button" onClick={() => onAction(line, "order")}>Tạo đơn</button><button className="button" type="button" onClick={() => onAction(line, "test")}>Ghi test</button><button className="button" type="button" onClick={() => onAction(line, "market_report")}>Báo cáo</button><button className="button" type="button" onClick={() => onAction(line, "follow_up")}>Follow-up</button><button className="button" type="button" onClick={() => onAction(line, "skip")}>Bỏ qua / không mua</button><button className="button" type="button" onClick={onClose}>Đóng</button></div> : undefined}>
      {line ? <div className="visit-sheet-content"><div className="visit-focus-card"><span>Trạng thái</span><strong>{statusLabel(line.status)}</strong><small>{line.result || line.note || "Chưa ghi kết quả chi tiết"}</small></div><div className="grid"><div className="metric-row"><span>Nguồn khách</span><strong>{sourceLabel(line.source)}</strong></div><div className="metric-row"><span>Khu vực</span><strong>{line.area}</strong></div><div className="metric-row"><span>Đơn hàng</span><strong>{line.hasOrder ? "Đã ghi đơn" : "Chưa ghi đơn"}</strong></div><div className="metric-row"><span>Test sản phẩm</span><strong>{line.hasTest ? "Đã ghi test" : "Chưa ghi test"}</strong></div><div className="metric-row"><span>Báo cáo</span><strong>{line.hasReport ? "Đã ghi báo cáo" : "Chưa ghi báo cáo"}</strong></div><div className="metric-row"><span>Follow-up</span><strong>{Number(line.followupCount || 0)} việc</strong></div></div></div> : null}
    </BottomSheet>
  );
}

function CustomerActionSheet({
  selection,
  saving,
  message,
  orderItems,
  orderNote,
  testFiles,
  testFilesLoading,
  testFileId,
  quickTestFileTitle,
  testResults,
  testNote,
  reportDraft,
  followupDraft,
  skipReason,
  skipNote,
  onOrderItemChange,
  onAddOrderItem,
  onRemoveOrderItem,
  onOrderNoteChange,
  onTestFileChange,
  onQuickTestFileTitleChange,
  onTestResultChange,
  onAddTestResult,
  onRemoveTestResult,
  onTestNoteChange,
  onReportChange,
  onFollowupChange,
  onSkipReasonChange,
  onSkipNoteChange,
  onClose,
  onSubmit
}: {
  selection: { line: McpDayLine; action: McpCustomerAction } | null;
  saving: boolean;
  message: string | null;
  orderItems: OrderDraftItem[];
  orderNote: string;
  testFiles: TestFileOption[];
  testFilesLoading: boolean;
  testFileId: string;
  quickTestFileTitle: string;
  testResults: TestDraftResult[];
  testNote: string;
  reportDraft: ReportDraft;
  followupDraft: FollowupDraft;
  skipReason: string;
  skipNote: string;
  onOrderItemChange: (index: number, field: keyof OrderDraftItem, value: string) => void;
  onAddOrderItem: () => void;
  onRemoveOrderItem: (index: number) => void;
  onOrderNoteChange: (value: string) => void;
  onTestFileChange: (value: string) => void;
  onQuickTestFileTitleChange: (value: string) => void;
  onTestResultChange: (index: number, field: keyof TestDraftResult, value: string) => void;
  onAddTestResult: () => void;
  onRemoveTestResult: (index: number) => void;
  onTestNoteChange: (value: string) => void;
  onReportChange: (field: keyof ReportDraft, value: string) => void;
  onFollowupChange: (field: keyof FollowupDraft, value: string) => void;
  onSkipReasonChange: (value: string) => void;
  onSkipNoteChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const action = selection?.action;
  const isOrder = action === "order";
  const isTest = action === "test";
  const isReport = action === "market_report";
  const isFollowup = action === "follow_up";
  const isSkip = action === "skip";
  const selectedTestFile = testFiles.find((file) => file.id === testFileId) || null;

  return (
    <BottomSheet open={Boolean(selection)} onClose={onClose} title={selection ? actionTitle(selection.action) : "Hành động checklist"} description={selection ? selection.line.accountName : undefined} footer={<div className="sheet-action-grid"><button className="button primary" type="button" onClick={onSubmit} disabled={saving}>{saving ? "Đang lưu..." : actionSaveLabel(action)}</button><button className="button" type="button" onClick={onClose} disabled={saving}>Đóng</button></div>}>
      {selection ? (
        <div className="visit-sheet-content">
          <div className="visit-focus-card"><span>Khách</span><strong>{selection.line.accountName}</strong><small>{mcpCustomerActionDescription(selection.action)}</small></div>

          {isOrder ? <div className="grid">{orderItems.map((item, index) => <div className="visit-focus-card" key={`order-item-${index}`}><span>Sản phẩm {index + 1}</span><label className="form-field"><small>Tên sản phẩm</small><input value={item.productName} onChange={(event) => onOrderItemChange(index, "productName", event.target.value)} placeholder="VD: Trà sữa truyền thống" /></label><label className="form-field"><small>Số lượng</small><input inputMode="decimal" value={item.quantity} onChange={(event) => onOrderItemChange(index, "quantity", event.target.value)} /></label><label className="form-field"><small>Giá</small><input inputMode="decimal" value={item.unitPrice} onChange={(event) => onOrderItemChange(index, "unitPrice", event.target.value)} /></label><label className="form-field"><small>Đơn vị</small><input value={item.unit} onChange={(event) => onOrderItemChange(index, "unit", event.target.value)} placeholder="ly / gói / thùng" /></label><label className="form-field"><small>Ghi chú dòng</small><input value={item.note} onChange={(event) => onOrderItemChange(index, "note", event.target.value)} /></label>{orderItems.length > 1 ? <button className="button" type="button" onClick={() => onRemoveOrderItem(index)} disabled={saving}>Xóa dòng</button> : null}</div>)}<button className="button" type="button" onClick={onAddOrderItem} disabled={saving}>Thêm sản phẩm</button><label className="form-field"><small>Ghi chú đơn</small><textarea value={orderNote} onChange={(event) => onOrderNoteChange(event.target.value)} placeholder="Ghi chú giao hàng / công nợ / yêu cầu khách" /></label></div> : null}

          {isTest ? <div className="grid"><label className="form-field"><small>File test</small><select value={testFileId} onChange={(event) => onTestFileChange(event.target.value)} disabled={saving || testFilesLoading}><option value="">{testFilesLoading ? "Đang tải file test..." : "Tạo file test nhanh"}</option>{testFiles.map((file) => <option key={file.id} value={file.id}>{file.title}</option>)}</select></label>{!testFileId ? <label className="form-field"><small>Tên file test nhanh</small><input value={quickTestFileTitle} onChange={(event) => onQuickTestFileTitleChange(event.target.value)} placeholder="VD: Test mẫu hôm nay" /></label> : null}{testResults.map((item, index) => <div className="visit-focus-card" key={`test-result-${index}`}><span>Kết quả sản phẩm {index + 1}</span>{selectedTestFile?.products.length ? <label className="form-field"><small>Chọn sản phẩm test</small><select value={item.productId} onChange={(event) => { const product = selectedTestFile.products.find((candidate) => candidate.id === event.target.value); onTestResultChange(index, "productId", event.target.value); onTestResultChange(index, "productName", product?.productName || ""); }}><option value="">Nhập sản phẩm nhanh</option>{selectedTestFile.products.map((product) => <option key={product.id} value={product.id}>{product.productName}</option>)}</select></label> : null}<label className="form-field"><small>Tên sản phẩm test</small><input value={item.productName} onChange={(event) => onTestResultChange(index, "productName", event.target.value)} disabled={Boolean(item.productId)} /></label><label className="form-field"><small>Kết quả</small><select value={item.status} onChange={(event) => onTestResultChange(index, "status", event.target.value)}><option value="tested">Đã test</option><option value="ok">Khách thích</option><option value="retry">Cần thử lại</option><option value="not_suitable">Chưa phù hợp</option><option value="follow_up">Cần theo dõi</option></select></label><label className="form-field"><small>Ghi chú kết quả</small><input value={item.note} onChange={(event) => onTestResultChange(index, "note", event.target.value)} /></label>{testResults.length > 1 ? <button className="button" type="button" onClick={() => onRemoveTestResult(index)} disabled={saving}>Xóa kết quả</button> : null}</div>)}<button className="button" type="button" onClick={onAddTestResult} disabled={saving}>Thêm sản phẩm test</button><label className="form-field"><small>Ghi chú test chung</small><textarea value={testNote} onChange={(event) => onTestNoteChange(event.target.value)} /></label></div> : null}

          {isReport ? <div className="grid"><label className="form-field"><small>Loại báo cáo</small><select value={reportDraft.reportType} onChange={(event) => onReportChange("reportType", event.target.value)} disabled={saving}><option value="price">Giá</option><option value="competitor">Đối thủ</option><option value="display">Trưng bày</option><option value="stock">Tồn kho</option><option value="demand">Nhu cầu</option></select></label><label className="form-field"><small>Nội dung</small><textarea value={reportDraft.content} onChange={(event) => onReportChange("content", event.target.value)} placeholder="Nội dung chính của báo cáo" /></label><label className="form-field"><small>Giá nếu có</small><input value={reportDraft.priceSummary} onChange={(event) => onReportChange("priceSummary", event.target.value)} /></label><label className="form-field"><small>Đối thủ nếu có</small><input value={reportDraft.competitorSummary} onChange={(event) => onReportChange("competitorSummary", event.target.value)} /></label><label className="form-field"><small>Trưng bày</small><input value={reportDraft.displaySummary} onChange={(event) => onReportChange("displaySummary", event.target.value)} /></label><label className="form-field"><small>Tồn kho</small><input value={reportDraft.stockSummary} onChange={(event) => onReportChange("stockSummary", event.target.value)} /></label><label className="form-field"><small>Nhu cầu</small><input value={reportDraft.demandSummary} onChange={(event) => onReportChange("demandSummary", event.target.value)} /></label><label className="form-field"><small>Cơ hội</small><input value={reportDraft.opportunitySummary} onChange={(event) => onReportChange("opportunitySummary", event.target.value)} /></label><label className="form-field"><small>Rủi ro</small><input value={reportDraft.riskSummary} onChange={(event) => onReportChange("riskSummary", event.target.value)} /></label><label className="form-field"><small>Next action</small><input value={reportDraft.nextAction} onChange={(event) => onReportChange("nextAction", event.target.value)} /></label></div> : null}

          {isFollowup ? <div className="grid"><label className="form-field"><small>Tiêu đề</small><input value={followupDraft.title} onChange={(event) => onFollowupChange("title", event.target.value)} placeholder="VD: Gọi lại chốt đơn / hẹn test lại" /></label><label className="form-field"><small>Ngày hẹn</small><input type="date" value={followupDraft.dueDate} onChange={(event) => onFollowupChange("dueDate", event.target.value)} /></label><label className="form-field"><small>Ưu tiên</small><select value={followupDraft.priority} onChange={(event) => onFollowupChange("priority", event.target.value)}><option value="low">Thấp</option><option value="medium">Trung bình</option><option value="high">Cao</option><option value="urgent">Khẩn cấp</option></select></label><label className="form-field"><small>Owner</small><input value={followupDraft.owner} onChange={(event) => onFollowupChange("owner", event.target.value)} placeholder="Người phụ trách" /></label><label className="form-field"><small>Ghi chú</small><textarea value={followupDraft.note} onChange={(event) => onFollowupChange("note", event.target.value)} /></label></div> : null}

          {isSkip ? <div className="grid"><label className="form-field"><small>Lý do bỏ qua / không mua</small><select value={skipReason} onChange={(event) => onSkipReasonChange(event.target.value)} disabled={saving}><option value="">Chọn lý do</option><option value="closed">Đóng cửa</option><option value="busy">Khách bận</option><option value="no_demand">Không có nhu cầu</option><option value="price">Chê giá</option><option value="competitor">Đang dùng đối thủ</option><option value="stock_enough">Còn tồn hàng</option><option value="other">Lý do khác</option></select></label><label className="form-field"><small>Ghi chú</small><textarea value={skipNote} onChange={(event) => onSkipNoteChange(event.target.value)} placeholder="Ghi rõ lý do để quản lý phiên xem lại" /></label></div> : null}

          {message ? <p className="page-subtitle">{message}</p> : null}
        </div>
      ) : null}
    </BottomSheet>
  );
}

export function McpSessionCompactView({ activeHref = "/visits", mcpDayData }: { activeHref?: string; routesData: RoutesData; mcpDayData: McpDayData; routeCustomersData: RouteCustomersData }) {
  const [tab, setTab] = useState<SessionTab>("all");
  const [selectedLine, setSelectedLine] = useState<McpDayLine | null>(null);
  const [selectedAction, setSelectedAction] = useState<{ line: McpDayLine; action: McpCustomerAction } | null>(null);
  const [orderItems, setOrderItems] = useState<OrderDraftItem[]>([emptyOrderItem()]);
  const [orderNote, setOrderNote] = useState("");
  const [testFiles, setTestFiles] = useState<TestFileOption[]>([]);
  const [testFilesLoading, setTestFilesLoading] = useState(false);
  const [testFileId, setTestFileId] = useState("");
  const [quickTestFileTitle, setQuickTestFileTitle] = useState("");
  const [testResults, setTestResults] = useState<TestDraftResult[]>([emptyTestResult()]);
  const [testNote, setTestNote] = useState("");
  const [reportDraft, setReportDraft] = useState<ReportDraft>(emptyReportDraft());
  const [followupDraft, setFollowupDraft] = useState<FollowupDraft>(emptyFollowupDraft());
  const [skipReason, setSkipReason] = useState("");
  const [skipNote, setSkipNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const router = useRouter();
  const run = mcpDayData.run;

  const allLines = mcpDayData.lines;
  const pendingLines = allLines.filter((line) => line.status === "pending");
  const visitedLines = allLines.filter((line) => line.status === "visited");
  const skippedLines = allLines.filter((line) => line.status === "skipped");
  const addedLines = allLines.filter((line) => line.source === "added");
  const followupLines = allLines.filter((line) => Number(line.followupCount || 0) > 0);
  const counters = { all: allLines.length, pending: pendingLines.length, visited: visitedLines.length, skipped: skippedLines.length, added: addedLines.length, followups: followupLines.length };

  const linesByTab: Record<SessionTab, McpDayLine[]> = { all: allLines, pending: pendingLines, visited: visitedLines, skipped: skippedLines, added: addedLines, followups: followupLines };

  async function loadTestOptions() {
    setTestFilesLoading(true);
    try {
      const payload = await getMcpBackend("/api/backend/mcp-day/test-options");
      const files = (payload as { data?: { files?: TestFileOption[] } }).data?.files;
      setTestFiles(Array.isArray(files) ? files : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không tải được file test");
    } finally {
      setTestFilesLoading(false);
    }
  }

  function openCustomerAction(line: McpDayLine, action: McpCustomerAction) {
    setMessage(null);
    setSelectedLine(null);
    if (action === "order") { setOrderItems([emptyOrderItem()]); setOrderNote(""); }
    if (action === "test") { setTestFileId(""); setQuickTestFileTitle(""); setTestResults([emptyTestResult()]); setTestNote(""); void loadTestOptions(); }
    if (action === "market_report") setReportDraft(emptyReportDraft());
    if (action === "follow_up") setFollowupDraft(emptyFollowupDraft(run.owner || ""));
    if (action === "skip") { setSkipReason(line.status === "skipped" ? line.result || "" : ""); setSkipNote(line.note || ""); }
    setSelectedAction({ line, action });
  }

  function updateOrderItem(index: number, field: keyof OrderDraftItem, value: string) { setOrderItems((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item)); }
  function updateTestResult(index: number, field: keyof TestDraftResult, value: string) { setTestResults((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item)); }
  function updateReportDraft(field: keyof ReportDraft, value: string) { setReportDraft((current) => ({ ...current, [field]: value })); }
  function updateFollowupDraft(field: keyof FollowupDraft, value: string) { setFollowupDraft((current) => ({ ...current, [field]: value })); }

  function submitAction() {
    if (!selectedAction) return;
    const sessionCustomerId = selectedAction.line.sessionCustomerId || selectedAction.line.id;
    startSaving(async () => {
      try {
        setMessage(null);
        if (selectedAction.action === "order") {
          const items = toOrderPayloadItems(orderItems);
          if (items.length === 0) throw new Error("Cần nhập ít nhất một sản phẩm");
          await postMcpBackend("/api/backend/mcp-day/session-customer/order", { sessionCustomerId, items, note: orderNote, status: "confirmed" });
        } else if (selectedAction.action === "test") {
          const results = toTestPayloadResults(testResults);
          if (results.length === 0) throw new Error("Cần nhập ít nhất một kết quả test");
          await postMcpBackend("/api/backend/mcp-day/session-customer/test", { sessionCustomerId, fileId: testFileId || undefined, fileTitle: quickTestFileTitle || undefined, results, note: testNote, status: "tested" });
        } else if (selectedAction.action === "market_report") {
          if (!reportHasContent(reportDraft)) throw new Error("Cần nhập nội dung báo cáo");
          await postMcpBackend("/api/backend/mcp-day/session-customer/report", { sessionCustomerId, reportType: reportDraft.reportType, content: reportDraft.content, priceSummary: reportDraft.priceSummary, competitorSummary: reportDraft.competitorSummary, displaySummary: reportDraft.displaySummary, stockSummary: reportDraft.stockSummary, demandSummary: reportDraft.demandSummary, opportunitySummary: reportDraft.opportunitySummary, riskSummary: reportDraft.riskSummary, nextAction: reportDraft.nextAction });
        } else if (selectedAction.action === "follow_up") {
          if (!followupDraft.title.trim()) throw new Error("Cần nhập tiêu đề follow-up");
          await postMcpBackend("/api/backend/mcp-day/session-customer/followup", { sessionCustomerId, title: followupDraft.title, dueDate: followupDraft.dueDate || undefined, priority: followupDraft.priority, owner: followupDraft.owner, note: followupDraft.note, followupType: "general" });
        } else if (selectedAction.action === "skip") {
          if (!skipReason.trim()) throw new Error("Cần chọn lý do bỏ qua / không mua");
          await postMcpBackend("/api/backend/mcp-day/session-customer/status", { sessionCustomerId, visitStatus: "skipped", statusReason: skipReason, note: skipNote || skipReason });
        }
        setSelectedAction(null);
        setSelectedLine(null);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Không lưu được hành động MCP");
      }
    });
  }

  return (
    <AppShell activeHref={activeHref}>
      <PageHeader eyebrow="Checklist phiên" title="Checklist phiên" subtitle={`Tuyến gốc: ${run.routeName} · Ngày: ${run.date} · Sale: ${run.owner}`} />
      <section className="mcp-gate-banner mcp-session-compact-head"><strong>{counters.pending} chờ ghé</strong><span>{counters.visited} đã ghé · {counters.skipped} bỏ qua · {counters.added} phát sinh · {counters.followups} follow-up · mở lúc {run.openedAt}</span></section>
      <div className="mcp-status-chips" role="tablist" aria-label="Checklist phiên"><button className={tab === "all" ? "active" : ""} type="button" onClick={() => setTab("all")}>Tất cả khách <b>{counters.all}</b></button><button className={tab === "pending" ? "active" : ""} type="button" onClick={() => setTab("pending")}>Chờ ghé <b>{counters.pending}</b></button><button className={tab === "visited" ? "active" : ""} type="button" onClick={() => setTab("visited")}>Đã ghé <b>{counters.visited}</b></button><button className={tab === "skipped" ? "active" : ""} type="button" onClick={() => setTab("skipped")}>Bỏ qua <b>{counters.skipped}</b></button><button className={tab === "added" ? "active" : ""} type="button" onClick={() => setTab("added")}>Phát sinh <b>{counters.added}</b></button><button className={tab === "followups" ? "active" : ""} type="button" onClick={() => setTab("followups")}>Có follow-up <b>{counters.followups}</b></button></div>
      <LineList lines={linesByTab[tab]} onOpen={setSelectedLine} onAction={openCustomerAction} />
      <CustomerSheet line={selectedLine} onClose={() => setSelectedLine(null)} onAction={openCustomerAction} />
      <CustomerActionSheet selection={selectedAction} saving={saving} message={message} orderItems={orderItems} orderNote={orderNote} testFiles={testFiles} testFilesLoading={testFilesLoading} testFileId={testFileId} quickTestFileTitle={quickTestFileTitle} testResults={testResults} testNote={testNote} reportDraft={reportDraft} followupDraft={followupDraft} skipReason={skipReason} skipNote={skipNote} onOrderItemChange={updateOrderItem} onAddOrderItem={() => setOrderItems((items) => [...items, emptyOrderItem()])} onRemoveOrderItem={(index) => setOrderItems((items) => items.filter((_, itemIndex) => itemIndex !== index))} onOrderNoteChange={setOrderNote} onTestFileChange={setTestFileId} onQuickTestFileTitleChange={setQuickTestFileTitle} onTestResultChange={updateTestResult} onAddTestResult={() => setTestResults((items) => [...items, emptyTestResult()])} onRemoveTestResult={(index) => setTestResults((items) => items.filter((_, itemIndex) => itemIndex !== index))} onTestNoteChange={setTestNote} onReportChange={updateReportDraft} onFollowupChange={updateFollowupDraft} onSkipReasonChange={setSkipReason} onSkipNoteChange={setSkipNote} onClose={() => { if (!saving) setSelectedAction(null); }} onSubmit={submitAction} />
    </AppShell>
  );
}
