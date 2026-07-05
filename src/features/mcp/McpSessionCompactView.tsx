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

type ActionDraft = {
  productName: string;
  quantity: string;
  unitPrice: string;
  unit: string;
  note: string;
  reportType: string;
  dueDate: string;
  priority: string;
  owner: string;
  skipReason: string;
};

function emptyDraft(owner = ""): ActionDraft {
  return {
    productName: "",
    quantity: "1",
    unitPrice: "0",
    unit: "",
    note: "",
    reportType: "price",
    dueDate: "",
    priority: "medium",
    owner,
    skipReason: ""
  };
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
  const response = await fetch(path, {
    method: "POST",
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorPayload = payload as { error?: string; detail?: string };
    throw new Error(errorPayload.error || errorPayload.detail || "Không lưu được hành động MCP");
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
  if (!line) return null;

  return (
    <BottomSheet
      open={Boolean(line)}
      onClose={onClose}
      title={line.accountName}
      description={`${line.area} · ${sourceLabel(line.source)}`}
      footer={
        <div className="sheet-action-grid">
          <button className="button primary" type="button" onClick={() => onAction(line, "order")}>Tạo đơn</button>
          <button className="button" type="button" onClick={() => onAction(line, "test")}>Ghi test</button>
          <button className="button" type="button" onClick={() => onAction(line, "market_report")}>Báo cáo</button>
          <button className="button" type="button" onClick={() => onAction(line, "follow_up")}>Follow-up</button>
          <button className="button" type="button" onClick={() => onAction(line, "skip")}>Bỏ qua / không mua</button>
          <button className="button" type="button" onClick={onClose}>Đóng</button>
        </div>
      }
    >
      <div className="visit-sheet-content">
        <div className="visit-focus-card"><span>Trạng thái</span><strong>{statusLabel(line.status)}</strong><small>{line.result || line.note || "Chưa ghi kết quả chi tiết"}</small></div>
        <div className="grid">
          <div className="metric-row"><span>Nguồn khách</span><strong>{sourceLabel(line.source)}</strong></div>
          <div className="metric-row"><span>Khu vực</span><strong>{line.area}</strong></div>
          <div className="metric-row"><span>Đơn hàng</span><strong>{line.hasOrder ? "Đã ghi đơn" : "Chưa ghi đơn"}</strong></div>
          <div className="metric-row"><span>Test sản phẩm</span><strong>{line.hasTest ? "Đã ghi test" : "Chưa ghi test"}</strong></div>
          <div className="metric-row"><span>Báo cáo</span><strong>{line.hasReport ? "Đã ghi báo cáo" : "Chưa ghi báo cáo"}</strong></div>
          <div className="metric-row"><span>Follow-up</span><strong>{Number(line.followupCount || 0)} việc</strong></div>
        </div>
      </div>
    </BottomSheet>
  );
}

function ActionFields({ action, draft, saving, onChange }: { action: McpCustomerAction; draft: ActionDraft; saving: boolean; onChange: (field: keyof ActionDraft, value: string) => void }) {
  if (action === "order") {
    return (
      <div className="grid">
        <label className="form-field"><small>Tên sản phẩm</small><input value={draft.productName} onChange={(event) => onChange("productName", event.target.value)} placeholder="VD: Trà sữa truyền thống" /></label>
        <label className="form-field"><small>Số lượng</small><input inputMode="decimal" value={draft.quantity} onChange={(event) => onChange("quantity", event.target.value)} /></label>
        <label className="form-field"><small>Giá</small><input inputMode="decimal" value={draft.unitPrice} onChange={(event) => onChange("unitPrice", event.target.value)} /></label>
        <label className="form-field"><small>Đơn vị</small><input value={draft.unit} onChange={(event) => onChange("unit", event.target.value)} placeholder="ly / gói / thùng" /></label>
        <label className="form-field"><small>Ghi chú đơn</small><textarea value={draft.note} onChange={(event) => onChange("note", event.target.value)} /></label>
      </div>
    );
  }

  if (action === "test") {
    return (
      <div className="grid">
        <label className="form-field"><small>Sản phẩm test</small><input value={draft.productName} onChange={(event) => onChange("productName", event.target.value)} placeholder="VD: Trà ô long / topping / syrup" /></label>
        <label className="form-field"><small>Kết quả</small><select value={draft.priority} onChange={(event) => onChange("priority", event.target.value)} disabled={saving}><option value="tested">Đã test</option><option value="ok">Khách thích</option><option value="retry">Cần thử lại</option><option value="not_suitable">Chưa phù hợp</option><option value="follow_up">Cần theo dõi</option></select></label>
        <label className="form-field"><small>Ghi chú test</small><textarea value={draft.note} onChange={(event) => onChange("note", event.target.value)} /></label>
      </div>
    );
  }

  if (action === "market_report") {
    return (
      <div className="grid">
        <label className="form-field"><small>Loại báo cáo</small><select value={draft.reportType} onChange={(event) => onChange("reportType", event.target.value)} disabled={saving}><option value="price">Giá</option><option value="competitor">Đối thủ</option><option value="display">Trưng bày</option><option value="stock">Tồn kho</option><option value="demand">Nhu cầu</option></select></label>
        <label className="form-field"><small>Nội dung báo cáo</small><textarea value={draft.note} onChange={(event) => onChange("note", event.target.value)} placeholder="Nội dung chính của báo cáo" /></label>
      </div>
    );
  }

  if (action === "follow_up") {
    return (
      <div className="grid">
        <label className="form-field"><small>Tiêu đề</small><input value={draft.productName} onChange={(event) => onChange("productName", event.target.value)} placeholder="VD: Gọi lại chốt đơn / hẹn test lại" /></label>
        <label className="form-field"><small>Ngày hẹn</small><input type="date" value={draft.dueDate} onChange={(event) => onChange("dueDate", event.target.value)} /></label>
        <label className="form-field"><small>Ưu tiên</small><select value={draft.priority} onChange={(event) => onChange("priority", event.target.value)} disabled={saving}><option value="low">Thấp</option><option value="medium">Trung bình</option><option value="high">Cao</option></select></label>
        <label className="form-field"><small>Owner</small><input value={draft.owner} onChange={(event) => onChange("owner", event.target.value)} /></label>
        <label className="form-field"><small>Ghi chú</small><textarea value={draft.note} onChange={(event) => onChange("note", event.target.value)} /></label>
      </div>
    );
  }

  return (
    <div className="grid">
      <label className="form-field"><small>Lý do bỏ qua / không mua</small><select value={draft.skipReason} onChange={(event) => onChange("skipReason", event.target.value)} disabled={saving}><option value="">Chọn lý do</option><option value="closed">Đóng cửa</option><option value="busy">Khách bận</option><option value="no_demand">Không có nhu cầu</option><option value="price">Chê giá</option><option value="competitor">Đang dùng đối thủ</option><option value="stock_enough">Còn tồn hàng</option><option value="other">Lý do khác</option></select></label>
      <label className="form-field"><small>Ghi chú</small><textarea value={draft.note} onChange={(event) => onChange("note", event.target.value)} placeholder="Ghi rõ lý do để quản lý phiên xem lại" /></label>
    </div>
  );
}

function CustomerActionSheet({ selection, draft, saving, message, onChange, onClose, onSubmit }: { selection: { line: McpDayLine; action: McpCustomerAction } | null; draft: ActionDraft; saving: boolean; message: string | null; onChange: (field: keyof ActionDraft, value: string) => void; onClose: () => void; onSubmit: () => void }) {
  return (
    <BottomSheet open={Boolean(selection)} onClose={onClose} title={selection ? actionTitle(selection.action) : "Hành động checklist"} description={selection ? selection.line.accountName : undefined} footer={<div className="sheet-action-grid"><button className="button primary" type="button" onClick={onSubmit} disabled={saving}>{saving ? "Đang lưu..." : actionSaveLabel(selection?.action)}</button><button className="button" type="button" onClick={onClose} disabled={saving}>Đóng</button></div>}>
      {selection ? <div className="visit-sheet-content"><div className="visit-focus-card"><span>Khách</span><strong>{selection.line.accountName}</strong><small>{mcpCustomerActionDescription(selection.action)}</small></div><ActionFields action={selection.action} draft={draft} saving={saving} onChange={onChange} />{message ? <p className="page-subtitle">{message}</p> : null}</div> : null}
    </BottomSheet>
  );
}

export function McpSessionCompactView({ activeHref = "/visits", mcpDayData }: { activeHref?: string; routesData: RoutesData; mcpDayData: McpDayData; routeCustomersData: RouteCustomersData }) {
  const [tab, setTab] = useState<SessionTab>("all");
  const [selectedLine, setSelectedLine] = useState<McpDayLine | null>(null);
  const [selectedAction, setSelectedAction] = useState<{ line: McpDayLine; action: McpCustomerAction } | null>(null);
  const [draft, setDraft] = useState<ActionDraft>(emptyDraft());
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

  function updateDraft(field: keyof ActionDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function openCustomerAction(line: McpDayLine, action: McpCustomerAction) {
    setMessage(null);
    setSelectedLine(null);
    setDraft(emptyDraft(run.owner || ""));
    setSelectedAction({ line, action });
  }

  function submitAction() {
    if (!selectedAction) return;
    const sessionCustomerId = selectedAction.line.sessionCustomerId || selectedAction.line.id;
    startSaving(async () => {
      try {
        setMessage(null);
        if (selectedAction.action === "order") {
          if (!draft.productName.trim()) throw new Error("Cần nhập sản phẩm");
          await postMcpBackend("/api/backend/mcp-day/session-customer/order", { sessionCustomerId, items: [{ productName: draft.productName, quantity: Number(draft.quantity || 1), unitPrice: Number(draft.unitPrice || 0), unit: draft.unit, note: draft.note }], note: draft.note, status: "confirmed" });
        } else if (selectedAction.action === "test") {
          if (!draft.productName.trim()) throw new Error("Cần nhập sản phẩm test");
          await postMcpBackend("/api/backend/mcp-day/session-customer/test", { sessionCustomerId, fileTitle: "Test nhanh từ checklist", results: [{ productName: draft.productName, status: draft.priority || "tested", note: draft.note }], note: draft.note, status: "tested" });
        } else if (selectedAction.action === "market_report") {
          if (!draft.note.trim()) throw new Error("Cần nhập nội dung báo cáo");
          await postMcpBackend("/api/backend/mcp-day/session-customer/report", { sessionCustomerId, reportType: draft.reportType, content: draft.note, nextAction: draft.note });
        } else if (selectedAction.action === "follow_up") {
          if (!draft.productName.trim()) throw new Error("Cần nhập tiêu đề follow-up");
          await postMcpBackend("/api/backend/mcp-day/session-customer/followup", { sessionCustomerId, title: draft.productName, dueDate: draft.dueDate || undefined, priority: draft.priority, owner: draft.owner, note: draft.note, followupType: "general" });
        } else if (selectedAction.action === "skip") {
          if (!draft.skipReason.trim()) throw new Error("Cần chọn lý do bỏ qua / không mua");
          await postMcpBackend("/api/backend/mcp-day/session-customer/status", { sessionCustomerId, visitStatus: "skipped", statusReason: draft.skipReason, note: draft.note || draft.skipReason });
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
      <CustomerActionSheet selection={selectedAction} draft={draft} saving={saving} message={message} onChange={updateDraft} onClose={() => { if (!saving) setSelectedAction(null); }} onSubmit={submitAction} />
    </AppShell>
  );
}
